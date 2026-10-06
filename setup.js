'use strict';
/**
 * Interactive setup wizard — run:  node setup.js
 * Guides you through getting a Gmail App Password and writes .env automatically.
 */

const readline = require('readline');
const fs       = require('fs');
const path     = require('path');
const nodemailer = require('nodemailer');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(resolve => rl.question(q, resolve));

const envPath = path.join(__dirname, '.env');

async function main() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║   Bhawna Portfolio — Email Setup Wizard            ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('This wizard will configure your contact form email.\n');
  console.log('You need a Gmail App Password. Here is how to get one:\n');
  console.log('  1. Open → https://myaccount.google.com/security');
  console.log('     (make sure you are logged in as bhawnapal2415@gmail.com)\n');
  console.log('  2. Under "How you sign in to Google"');
  console.log('     → click "2-Step Verification" → turn it ON\n');
  console.log('  3. Go back to Security page');
  console.log('     → search "App passwords" in the search bar at the top\n');
  console.log('  4. App name: type  Portfolio  → click Create');
  console.log('     → Google will show a 16-character password like: abcd efgh ijkl mnop\n');
  console.log('  5. Copy that password (ignore the spaces)\n');
  console.log('─────────────────────────────────────────────────────\n');

  const ready = await ask('Have you copied your App Password? (yes/no): ');
  if (!ready.trim().toLowerCase().startsWith('y')) {
    console.log('\nNo problem — run this script again once you have it.\n');
    console.log('Direct link: https://myaccount.google.com/apppasswords\n');
    rl.close();
    return;
  }

  const appPass = (await ask('\nPaste your App Password here (spaces are OK): ')).replace(/\s/g, '');

  if (appPass.length !== 16) {
    console.log(`\n⚠️  Expected 16 characters, got ${appPass.length}. Please double-check and run again.\n`);
    rl.close();
    return;
  }

  console.log('\n⏳  Testing credentials — sending a test email to bhawnapal2415@gmail.com ...\n');

  const transporter = nodemailer.createTransport({
    host  : 'smtp.gmail.com',
    port  : 465,
    secure: true,
    auth  : { user: 'bhawnapal2415@gmail.com', pass: appPass },
  });

  try {
    await transporter.verify();
    console.log('✔  Credentials verified!\n');

    await transporter.sendMail({
      from   : '"Portfolio Setup" <bhawnapal2415@gmail.com>',
      to     : 'bhawnapal2415@gmail.com',
      subject: '✦ Portfolio Contact Form — Setup Successful!',
      html   : `
        <div style="font-family:sans-serif;padding:32px;background:#0a0a0a;color:#e9e2cf;border-radius:8px;max-width:500px;">
          <h2 style="color:#D4AF37;">✦ Setup Complete!</h2>
          <p>Your portfolio contact form is now fully configured and ready to receive messages.</p>
          <p style="color:#a99b7e;font-size:13px;">Configured at: ${new Date().toLocaleString()}</p>
        </div>`,
    });

    console.log('✔  Test email sent! Check your inbox at bhawnapal2415@gmail.com\n');

    // Write .env
    const envContent = `# Gmail credentials — DO NOT commit this file to git
GMAIL_USER=bhawnapal2415@gmail.com
GMAIL_PASS=${appPass}

# Server port
PORT=3000
`;
    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('✔  .env file updated with your credentials.\n');
    console.log('════════════════════════════════════════════════════');
    console.log('  All done! Start your server with:  npm start');
    console.log('════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('✗  Failed:', err.message, '\n');
    if (err.message.includes('Invalid login') || err.message.includes('Username and Password')) {
      console.error('  → The App Password is wrong. Make sure you:');
      console.error('    • Used an App Password (not your Gmail login password)');
      console.error('    • Removed spaces from the 16-character code');
      console.error('    • Are logged into the correct Google account\n');
    }
    if (err.message.includes('2-Step')) {
      console.error('  → 2-Step Verification is not enabled on your Google account.');
      console.error('    Enable it at: https://myaccount.google.com/security\n');
    }
  }

  rl.close();
}

main().catch(err => { console.error(err); rl.close(); });
