const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,     // consentchain@gmail.com
    pass: process.env.GMAIL_APP_PASS  // Gmail App Password
  }
});

const sendEmail = async ({ to, subject, body }) => {
  try {
    await transporter.sendMail({
      from: `"ConsentChain" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #eee;border-radius:8px;">
          <h2 style="color:#1a1a1a;">ConsentChain</h2>
          <p style="color:#333;font-size:15px;">${body.replace(/\n/g, "<br/>")}</p>
          <hr style="border:none;border-top:1px solid #eee;"/>
          <p style="color:#999;font-size:12px;">ConsentChain — Secure File Sharing</p>
        </div>
      `,
      text: body
    });
    console.log(`✅ Email sent to ${to}`);
  } catch (err) {
    console.error("Email error:", err.message);
  }
};

module.exports = { sendEmail };
