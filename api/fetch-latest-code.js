const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const COMMON_HOST_CONFIG = {
  host: "leader.herosite.pro",
  port: 993,
  secure: true,
};

// Google Sheet CSV URL - auto-fetches credentials
const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQmQAUePtmS_c9laszhSSbPNFs_xr0yBsMf5k2bhHNKBjG0akqNK4mxgoOHj8TFXPMvGpXRwzfy2c5F/pub?output=csv';

let ACCOUNTS_DB = {};
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // Cache for 60 seconds

// Fetch and parse credentials from Google Sheet
async function fetchAccountsFromSheet() {
  try {
    const now = Date.now();
    // Use cache if fresh (less than 60 seconds old)
    if (Object.keys(ACCOUNTS_DB).length > 0 && now - lastFetchTime < CACHE_DURATION) {
      return ACCOUNTS_DB;
    }

    const response = await fetch(GOOGLE_SHEET_URL);
    const csv = await response.text();
    const lines = csv.trim().split('\n');
    
    // Parse CSV (skip header row)
    const newAccounts = {};
    for (let i = 1; i < lines.length; i++) {
      const [email, password] = lines[i].split(',').map(v => v.trim());
      if (email && password) {
        newAccounts[email.toLowerCase()] = {
          ...COMMON_HOST_CONFIG,
          auth: { user: email, pass: password }
        };
      }
    }

    if (Object.keys(newAccounts).length > 0) {
      ACCOUNTS_DB = newAccounts;
      lastFetchTime = now;
      console.log(`[v0] Loaded ${Object.keys(ACCOUNTS_DB).length} accounts from Google Sheet`);
    }

    return ACCOUNTS_DB;
  } catch (error) {
    console.error('[v0] Error fetching Google Sheet:', error.message);
    // Return cached version if available
    if (Object.keys(ACCOUNTS_DB).length > 0) {
      console.log('[v0] Using cached accounts');
      return ACCOUNTS_DB;
    }
    throw new Error('Could not load email credentials. Please check the Google Sheet.');
  }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { email } = req.body || {};

  // Fetch latest accounts from Google Sheet
  try {
    await fetchAccountsFromSheet();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Failed to load email credentials from configuration." 
    });
  }

  if (!email || !ACCOUNTS_DB[email.toLowerCase().trim()]) {
    return res.status(400).json({ 
      success: false, 
      message: "Selected email ID is not configured in the system." 
    });
  }

  const config = ACCOUNTS_DB[email.toLowerCase().trim()];
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.auth,
    logger: false,
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000
  });

  // ImapFlow emits an 'error' event on socket timeouts/disconnects. Without a
  // listener Node treats it as an unhandled error and crashes the function,
  // which surfaced to users as a generic "Command failed".
  client.on('error', () => {});

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let payload;
    try {
      const status = await client.status('INBOX', { messages: true });
      if (status.messages === 0) {
        payload = { statusCode: 404, body: { success: false, message: "Inbox is empty." } };
      } else {
        // Skip emails with subject "Netflix: your sign-in code" and fetch the next valid email
        const SKIP_SUBJECTS = ["Netflix: your sign-in code"];
        let foundValidEmail = false;
        let emailIndex = status.messages;

        while (emailIndex > 0 && !foundValidEmail) {
          const message = await client.fetchOne(`${emailIndex}`, { source: true, envelope: true });
          const parsed = await simpleParser(message.source);
          const emailSubject = parsed.subject || "No Subject";

          // Check if this email should be skipped
          if (SKIP_SUBJECTS.some(skipSubject => emailSubject.includes(skipSubject))) {
            console.log(`[v0] Skipping email with subject: ${emailSubject}`);
            emailIndex--;
            continue;
          }

          // Valid email found
          payload = {
            statusCode: 200,
            body: {
              success: true,
              data: {
                email: email,
                subject: emailSubject,
                from: parsed.from?.text || "Unknown Sender",
                to: parsed.to?.text || email,
                date: parsed.date || new Date(),
                html: parsed.html || null,
                text: parsed.text || "",
                snippet: parsed.text ? parsed.text.substring(0, 200).replace(/\s+/g, ' ').trim() : ""
              }
            }
          };
          foundValidEmail = true;
        }

        // If no valid email found, return error
        if (!foundValidEmail) {
          payload = { statusCode: 404, body: { success: false, message: "No valid emails found. All recent emails are sign-in codes." } };
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return res.status(payload.statusCode).json(payload.body);
  } catch (error) {
    try { await client.logout(); } catch (_) {}

    // Translate the low-level IMAP error into a clear, user-facing message.
    if (error.authenticationFailed) {
      return res.status(401).json({
        success: false,
        message: `Login failed for ${email}. The mail server rejected the saved username/password for this mailbox.`,
        error: error.responseText || "Authentication failed."
      });
    }

    if (error.code === 'ETIMEOUT' || error.code === 'ETIMEDOUT' || /timeout/i.test(error.message || "")) {
      return res.status(504).json({
        success: false,
        message: "The mail server did not respond in time. Please try again.",
        error: error.message
      });
    }

    return res.status(502).json({
      success: false,
      message: "Could not connect to the mail server.",
      error: error.responseText || error.message
    });
  }
};
