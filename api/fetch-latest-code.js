const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

const COMMON_HOST_CONFIG = {
  host: "leader.herosite.pro",
  port: 993,
  secure: true,
};

const ACCOUNTS_DB = {
  "nf2m@dreamcrest.net": { ...COMMON_HOST_CONFIG, auth: { user: "nf2m@dreamcrest.net", pass: "Logical8794" } },
  "p3m@dreamespire.com": { ...COMMON_HOST_CONFIG, auth: { user: "p3m@dreamespire.com", pass: "XXXNETFLIX123" } },
  "df3@dreamespire.com": { ...COMMON_HOST_CONFIG, auth: { user: "df3@dreamespire.com", pass: "DreamCrestXXX123" } },
  "nf3m@dreamcrest.net": { ...COMMON_HOST_CONFIG, auth: { user: "nf3m@dreamcrest.net", pass: "XXXNETFLIX1234" } }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  const { email } = req.body || {};

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
    logger: false
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');

    let payload;
    try {
      const status = await client.status('INBOX', { messages: true });
      if (status.messages === 0) {
        payload = { statusCode: 404, body: { success: false, message: "Inbox is empty." } };
      } else {
        const message = await client.fetchOne(`${status.messages}`, { source: true, envelope: true });
        const parsed = await simpleParser(message.source);

        payload = {
          statusCode: 200,
          body: {
            success: true,
            data: {
              email: email,
              subject: parsed.subject || "No Subject",
              from: parsed.from?.text || "Unknown Sender",
              to: parsed.to?.text || email,
              date: parsed.date || new Date(),
              html: parsed.html || null,
              text: parsed.text || "",
              snippet: parsed.text ? parsed.text.substring(0, 200).replace(/\s+/g, ' ').trim() : ""
            }
          }
        };
      }
    } finally {
      lock.release();
    }

    await client.logout();
    return res.status(payload.statusCode).json(payload.body);
  } catch (error) {
    try { await client.logout(); } catch (_) {}
    return res.status(500).json({ 
      success: false, 
      message: "Failed to connect to webmail.",
      error: error.message 
    });
  }
};
