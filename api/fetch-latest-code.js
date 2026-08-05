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
      const line = lines[i].trim();
      if (!line) continue;
      
      // Parse CSV line - handle quoted values with commas
      let parts = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          parts.push(current.replace(/^"|"$/g, '').trim());
          current = '';
        } else {
          current += char;
        }
      }
      parts.push(current.replace(/^"|"$/g, '').trim());
      
      const [email, password] = parts;
      if (email && password) {
        const emailLower = email.toLowerCase().trim();
        newAccounts[emailLower] = {
          ...COMMON_HOST_CONFIG,
          auth: { user: email, pass: password }
        };
        console.log(`[v0] Added account: ${emailLower}`);
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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

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
      const NO_RECENT_EMAIL_MESSAGE = "No emails found kindly resend the email from TV";

      if (status.messages === 0) {
        payload = { statusCode: 404, body: { success: false, message: NO_RECENT_EMAIL_MESSAGE } };
      } else {
        // Scan newest-to-oldest, but only accept messages received in the last 10 minutes.
        const SKIP_SUBJECTS = ["Netflix: your sign-in code"];
        const recentSince = Date.now() - (10 * 60 * 1000);
        let foundValidEmail = false;
        let emailIndex = status.messages;

        while (emailIndex > 0 && !foundValidEmail) {
          const message = await client.fetchOne(`${emailIndex}`, {
            source: true,
            envelope: true,
            internalDate: true
          });
          const parsed = await simpleParser(message.source);
          // Use IMAP INTERNALDATE: the server's actual arrival time. The email
          // Date header can be hours old or set by the sender's timezone.
          const receivedAt = message.internalDate;
          const receivedTime = receivedAt instanceof Date
            ? receivedAt.getTime()
            : NaN;

          // Since messages are scanned newest-first, older mail ends the search.
          if (!Number.isFinite(receivedTime) || receivedTime < recentSince) {
            break;
          }

          const emailSubject = parsed.subject || "No Subject";

          if (SKIP_SUBJECTS.some(skipSubject => emailSubject.includes(skipSubject))) {
            console.log(`[v0] Skipping recent email with subject: ${emailSubject}`);
            emailIndex--;
            continue;
          }

          payload = {
            statusCode: 200,
            body: {
              success: true,
              data: {
                email,
                subject: emailSubject,
                from: parsed.from?.text || "Unknown Sender",
                to: parsed.to?.text || email,
                date: receivedAt,
                html: parsed.html || null,
                text: parsed.text || "",
                snippet: parsed.text ? parsed.text.substring(0, 200).replace(/\s+/g, ' ').trim() : ""
              }
            }
          };
          foundValidEmail = true;
        }

        if (!foundValidEmail) {
          payload = { statusCode: 404, body: { success: false, message: NO_RECENT_EMAIL_MESSAGE } };
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
