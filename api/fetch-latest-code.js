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

function parseEmailContent(htmlContent, textContent) {
  const content = htmlContent || textContent || "";
  const codeMatch = content.match(/\b\d{4,8}\b/);
  const code = codeMatch ? codeMatch[0] : null;

  const urlMatch = content.match(/https?:\/\/[^\s"<']+/g);
  let actionUrl = null;
  if (urlMatch) {
    actionUrl = urlMatch.find(url => 
      url.includes('verify') || 
      url.includes('account') || 
      url.includes('travel') || 
      url.includes('household') ||
      url.includes('netflix.com')
    ) || null;
  }

  return { code, actionUrl };
}

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
    let lock = await client.getMailboxLock('INBOX');

    try {
      const status = await client.status('INBOX', { messages: true });
      if (status.messages === 0) {
        return res.status(404).json({ success: false, message: "Inbox is empty." });
      }

      const message = await client.fetchOne(`${status.messages}`, { source: true, envelope: true });
      const parsed = await simpleParser(message.source);
      const { code, actionUrl } = parseEmailContent(parsed.html, parsed.text);

      return res.status(200).json({
        success: true,
        data: {
          email: email,
          subject: parsed.subject || "No Subject",
          from: parsed.from?.text || "Netflix",
          date: parsed.date || new Date(),
          code: code,
          actionUrl: actionUrl,
          snippet: parsed.text ? parsed.text.substring(0, 200).replace(/\s+/g, ' ') + "..." : ""
        }
      });
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      message: "Failed to connect to webmail.",
      error: error.message 
    });
  }
};