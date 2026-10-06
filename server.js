'use strict';

const express    = require('express');
const nodemailer = require('nodemailer');
const cors       = require('cors');
const path       = require('path');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 3000;

/* ── middleware ─────────────────────────────────────────── */
app.use(cors());
app.use(express.json());
/* ── Force PDF Resume Download Route (Before express.static) ── */
app.get(['/Bhawna_Pal_CV.pdf', '/download-resume', '/Bhawna_CV.pdf', '/Bhawna_Pal_Resume.pdf', '/resume.pdf'], (_req, res) => {
  const pdfPath = path.join(__dirname, 'Bhawna_Pal_CV.pdf');
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Bhawna_Pal_CV.pdf"');
  res.sendFile(pdfPath);
});

app.use(express.static(path.join(__dirname)));

/* ── Check credentials ──────────────────────────────────── */
const GMAIL_USER = process.env.GMAIL_USER || '';
const GMAIL_PASS = process.env.GMAIL_PASS || '';
const isConfigured = (
  GMAIL_USER.includes('@') &&
  GMAIL_PASS.length === 16 &&
  GMAIL_PASS !== 'your_16_char_app_password_here'
);

/* ── Nodemailer — direct SMTP (more reliable than service:'gmail') */
const transporter = nodemailer.createTransport({
  host  : 'smtp.gmail.com',
  port  : 465,
  secure: true,          // TLS
  auth  : { user: GMAIL_USER, pass: GMAIL_PASS },
  pool  : true,
  maxConnections: 3,
});

if (isConfigured) {
  transporter.verify()
    .then(() => console.log('  ✔  Gmail SMTP connected successfully'))
    .catch(err => {
      console.error('  ✗  Gmail SMTP error:', err.message);
      console.error('  →  Run  node setup.js  to fix credentials');
    });
} else {
  console.warn('\n  ⚠️  Email not configured yet.');
  console.warn('  →  Run:  node setup.js   (takes 2 minutes)\n');
}

/* ── Simple in-memory rate limiter (10 real send attempts per IP per hour) */
const rateLimitMap = new Map();
function checkRateLimit(ip) {
  const now   = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, reset: now + 3600000 };
  if (now > entry.reset) { entry.count = 0; entry.reset = now + 3600000; }
  entry.count++;
  rateLimitMap.set(ip, entry);
  return entry.count <= 10;
}

/* ── Input validation ────────────────────────────────────── */
function validateInput({ name, email, message }) {
  if (!name    || name.trim().length < 2)    return 'Name must be at least 2 characters.';
  if (!email   || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.';
  if (!message || message.trim().length < 10) return 'Message must be at least 10 characters.';
  if (name.length > 120 || email.length > 200 || message.length > 4000) return 'Input is too long.';
  return null;
}

/* ── HTML email templates ─────────────────────────────────── */
function ownerEmail(safeName, safeEmail, safeMessage) {
  return {
    from   : `"Portfolio Contact" <${GMAIL_USER}>`,
    to     : GMAIL_USER,
    replyTo: safeEmail,
    subject: `✉️ Portfolio message from ${safeName}`,
    html   : `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #2d1654;">
  <div style="background:linear-gradient(135deg,#1e0f3d,#2d1654);padding:28px 32px;">
    <h2 style="margin:0;color:#D4AF37;font-size:20px;">✦ New Portfolio Message</h2>
    <p style="margin:6px 0 0;color:#a99b7e;font-size:13px;">Someone reached out via your contact form</p>
  </div>
  <div style="padding:28px 32px;background:#111;">
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#a99b7e;width:80px;">Name</td>
        <td style="padding:8px 0;color:#efe2be;font-weight:600;">${safeName}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#a99b7e;">Email</td>
        <td style="padding:8px 0;"><a href="mailto:${safeEmail}" style="color:#D4AF37;text-decoration:none;">${safeEmail}</a></td>
      </tr>
    </table>
    <div style="margin-top:20px;padding-top:20px;border-top:1px solid #2d1654;">
      <p style="color:#a99b7e;font-size:12px;margin:0 0 10px;">Message</p>
      <div style="background:#1a1030;border-left:3px solid #D4AF37;padding:14px 16px;color:#e9e2cf;line-height:1.7;border-radius:0 6px 6px 0;white-space:pre-wrap;font-size:15px;">${safeMessage}</div>
    </div>
  </div>
  <div style="padding:16px 32px;background:#0a0a0a;text-align:center;color:#555;font-size:12px;">
    Hit reply to respond directly to ${safeName} · bhawna-portfolio
  </div>
</div>`
  };
}

function senderEmail(safeName, safeEmail, safeMessage) {
  return {
    from   : `"Bhawna Pal" <${GMAIL_USER}>`,
    to     : safeEmail,
    subject: `Got your message — Bhawna Pal`,
    html   : `
<div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;border-radius:12px;overflow:hidden;border:1px solid #2d1654;">
  <div style="background:linear-gradient(135deg,#1e0f3d,#2d1654);padding:28px 32px;">
    <h2 style="margin:0;color:#D4AF37;font-size:20px;">✦ Message Received!</h2>
    <p style="margin:6px 0 0;color:#a99b7e;font-size:13px;">bhawnapal2415@gmail.com</p>
  </div>
  <div style="padding:28px 32px;background:#111;color:#e9e2cf;font-size:15px;line-height:1.7;">
    <p>Hi <strong style="color:#D4AF37;">${safeName}</strong>,</p>
    <p style="color:#a99b7e;">Thanks for reaching out! I've received your message and will get back to you within 24–48 hours.</p>
    <p style="color:#a99b7e;">Feel free to explore more of my work:</p>
    <p>
      <a href="https://github.com/BhawnaPal2407" style="color:#D4AF37;margin-right:16px;">GitHub</a>
      <a href="https://www.linkedin.com/in/bhawna-pal-12a243243/" style="color:#D4AF37;">LinkedIn</a>
    </p>
    <div style="margin-top:24px;padding-top:20px;border-top:1px solid #2d1654;">
      <p style="color:#555;font-size:12px;margin:0 0 8px;">Your message:</p>
      <div style="background:#1a1030;border-left:3px solid #555;padding:12px 14px;color:#888;line-height:1.6;border-radius:0 6px 6px 0;white-space:pre-wrap;font-size:13px;">${safeMessage}</div>
    </div>
  </div>
  <div style="padding:16px 32px;background:#0a0a0a;text-align:center;color:#555;font-size:12px;">
    Bhawna Pal · AI/ML Engineer &amp; Java Developer · Delhi, India
  </div>
</div>`
  };
}

/* ── POST /api/contact ──────────────────────────────────── */
app.post('/api/contact', async (req, res) => {
  const { name, email, message } = req.body;

  // Validate inputs FIRST (bad requests don't consume rate limit)
  const validationError = validateInput({ name, email, message });
  if (validationError) {
    return res.status(400).json({ success: false, message: validationError });
  }

  // Rate limit only valid requests
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ success: false, message: 'Too many messages. Please wait an hour before trying again.' });
  }

  // Block if not configured
  if (!isConfigured) {
    return res.status(503).json({
      success: false,
      message: 'EMAIL_NOT_CONFIGURED'
    });
  }

  const safeName    = name.trim().replace(/[<>]/g, '');
  const safeEmail   = email.trim();
  const safeMessage = message.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');

  try {
    await transporter.sendMail(ownerEmail(safeName, safeEmail, safeMessage));
    // Send auto-reply (non-critical — don't fail the request if this fails)
    transporter.sendMail(senderEmail(safeName, safeEmail, safeMessage)).catch(e => {
      console.warn('Auto-reply failed (non-critical):', e.message);
    });
    return res.json({ success: true, message: '✦ Your owl has been dispatched! I\'ll reply within 24–48 hours.' });
  } catch (err) {
    console.error('Send error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'EMAIL_SEND_FAILED'      // frontend handles this specifically
    });
  }
});

/* ── GET /api/status — tells the frontend if email is ready */
app.get('/api/status', (_req, res) => {
  res.json({ emailConfigured: isConfigured, status: 'ok' });
});

/* ── Health check ───────────────────────────────────────── */
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

/* ── Fallback → serve portfolio ─────────────────────────── */
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/* ── Start ──────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`\n  ✦ Portfolio → http://localhost:${PORT}`);
  console.log(`  ✦ API       → POST http://localhost:${PORT}/api/contact\n`);
});
