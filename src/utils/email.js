const nodemailer = require("nodemailer");

let _transport = null;

function getTransport(smtpUser, smtpKey) {
  if (!_transport) {
    _transport = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      auth: {
        user: smtpUser,
        pass: smtpKey,
      },
      connectionTimeout: 10_000,
      socketTimeout: 10_000,
    });
  }
  return _transport;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildConfirmationHtml({ name, subject, message }) {
  const safeName = escHtml(name);
  const safeSubject = escHtml(subject);
  const preview =
    message.length > 220 ? message.slice(0, 220).trimEnd() + "…" : message;
  const safeMessage = escHtml(preview).replace(/\n/g, "<br>");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Message received</title>
  <style>
    @media only screen and (max-width: 600px) {
      .ew  { padding: 16px 8px !important; }
      .ec  { border-radius: 12px !important; }
      .eh  { padding: 24px 20px 18px !important; }
      .eb  { padding: 20px !important; }
      .ef  { padding: 16px 20px 22px !important; }
      .ht  { font-size: 16px !important; }
      .lc  { display: block !important; width: 100% !important; padding: 4px 0 !important; }
      .lb  { display: block !important; width: 100% !important; text-align: center !important; box-sizing: border-box !important; }
      .lt  { width: 100% !important; }
      .dv  { padding: 0 20px !important; }
    }
    @media only screen and (min-width: 601px) and (max-width: 768px) {
      .ew  { padding: 28px 16px !important; }
      .eh  { padding: 28px 32px 20px !important; }
      .eb  { padding: 26px 32px !important; }
      .ef  { padding: 18px 32px 24px !important; }
      .dv  { padding: 0 32px !important; }
    }
    @media (prefers-color-scheme: light) {
      .ew  { background-color: #ededf5 !important; }
      .ec  { background-color: #ffffff !important; border-color: #d8d8ee !important; }
      .eh  { background-color: #ffffff !important; }
      .ef  { background-color: #f4f4fb !important; }
      .qb  { background-color: #f0f0f8 !important; border-color: #e0e0ee !important; }
      .qbd { border-color: #e0e0ee !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0d0d1f;font-family:Arial,Helvetica,sans-serif;">

<table class="ew" width="100%" cellpadding="0" cellspacing="0" border="0"
  style="background-color:#0d0d1f;padding:44px 16px;">
  <tr>
    <td align="center">

      <!-- outer container -->
      <table class="ec" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:580px;background-color:#1a1a2e;border-radius:16px;border:1px solid #2a2a46;overflow:hidden;">

        <!-- top accent bar -->
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,#9251f7 0%,#6c8cf7 100%);font-size:0;line-height:0;">&nbsp;</td>
        </tr>

        <!-- header -->
        <tr>
          <td class="eh" style="padding:36px 40px 22px;background-color:#1a1a2e;">
            <p style="margin:0 0 2px;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#55557a;">VITALII BELEVTSOV</p>
            <p class="ht" style="margin:0;font-size:19px;font-weight:700;color:#e0e0f0;line-height:1.3;">Junior Frontend /</p>
            <p class="ht" style="margin:0;font-size:19px;font-weight:700;color:#9a5cf7;line-height:1.3;">Junior Full-Stack Developer</p>
          </td>
        </tr>

        <!-- divider -->
        <tr>
          <td class="dv" style="padding:0 40px;">
            <div style="height:1px;background-color:#2a2a46;font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- body -->
        <tr>
          <td class="eb" style="padding:30px 40px;">

            <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:#e0e0f0;">Hi ${safeName},</p>
            <p style="margin:0 0 26px;font-size:14px;line-height:1.65;color:#8888aa;">
              Thanks for reaching out! I've received your message and will get back to you within
              <span style="color:#e0e0f0;font-weight:600;">24 hours</span>.
            </p>

            <!-- quoted message block -->
            <table class="qb" width="100%" cellpadding="0" cellspacing="0" border="0"
              style="background-color:#11112a;border-radius:10px;border:1px solid #2a2a46;margin-bottom:28px;">
              <tr>
                <td class="qbd" style="padding:10px 16px 8px;border-bottom:1px solid #2a2a46;">
                  <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#55557a;">Your message</p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 16px 6px;">
                  <p style="margin:0;font-size:12px;color:#8888aa;">
                    <span style="color:#6a6a8a;">Subject:&nbsp;</span><span style="color:#c09af5;font-weight:600;">${safeSubject}</span>
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 16px 14px;">
                  <p style="margin:0;font-size:13px;line-height:1.6;color:#8888aa;font-style:italic;">&ldquo;${safeMessage}&rdquo;</p>
                </td>
              </tr>
            </table>

            <!-- links label -->
            <p style="margin:0 0 12px;font-size:10px;font-weight:700;letter-spacing:0.09em;text-transform:uppercase;color:#55557a;">In the meantime</p>

            <!-- link buttons — 3 cells, stack on mobile -->
            <table class="lt" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="lc" style="padding-right:8px;padding-bottom:8px;white-space:nowrap;">
                  <a class="lb" href="https://belevtsov.dev"
                    style="display:inline-block;padding:8px 16px;background-color:rgba(146,81,247,0.14);border:1px solid rgba(146,81,247,0.38);border-radius:8px;font-size:12px;font-weight:600;color:#c09af5;text-decoration:none;white-space:nowrap;">
                    🌐&nbsp;belevtsov.dev
                  </a>
                </td>
                <td class="lc" style="padding-right:8px;padding-bottom:8px;white-space:nowrap;">
                  <a class="lb" href="https://github.com/Belevtsov91"
                    style="display:inline-block;padding:8px 16px;background-color:rgba(149,170,251,0.1);border:1px solid rgba(149,170,251,0.28);border-radius:8px;font-size:12px;font-weight:600;color:#95aafb;text-decoration:none;white-space:nowrap;">
                    💻&nbsp;GitHub
                  </a>
                </td>
                <td class="lc" style="padding-bottom:8px;white-space:nowrap;">
                  <a class="lb" href="https://www.linkedin.com/in/vitalii-belevtsov/"
                    style="display:inline-block;padding:8px 16px;background-color:rgba(34,195,241,0.1);border:1px solid rgba(34,195,241,0.28);border-radius:8px;font-size:12px;font-weight:600;color:#22c3f1;text-decoration:none;white-space:nowrap;">
                    💼&nbsp;LinkedIn
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- divider -->
        <tr>
          <td class="dv" style="padding:0 40px;">
            <div style="height:1px;background-color:#2a2a46;font-size:0;line-height:0;">&nbsp;</div>
          </td>
        </tr>

        <!-- footer -->
        <tr>
          <td class="ef" style="padding:18px 40px 26px;background-color:#13132a;">
            <p style="margin:0 0 2px;font-size:13px;font-weight:600;color:#e0e0f0;">Vitalii Belevtsov</p>
            <p style="margin:0 0 14px;font-size:12px;color:#55557a;">
              vitaliybelevcov@gmail.com &nbsp;·&nbsp;
              <a href="https://belevtsov.dev" style="color:#55557a;text-decoration:none;">belevtsov.dev</a>
            </p>
            <p style="margin:0;font-size:11px;line-height:1.55;color:#3c3c5a;">
              You're receiving this because you submitted the contact form at
              <a href="https://belevtsov.dev" style="color:#3c3c5a;text-decoration:underline;">belevtsov.dev</a>.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

function sendNotificationEmail({
  smtpUser,
  smtpKey,
  fromEmail,
  toEmail,
  name,
  email,
  subject,
  message,
  source,
}) {
  const transport = getTransport(smtpUser, smtpKey);

  return transport.sendMail({
    from: `"CV Bot" <${fromEmail}>`,
    to: toEmail,
    subject: `📬 New message from ${name}`,
    html: `
      <h2>New message from CV</h2>
      <p><b>Source:</b> ${escHtml(source)}</p>
      <p><b>Name:</b> ${escHtml(name)}</p>
      <p><b>Email:</b> ${escHtml(email)}</p>
      ${subject ? `<p><b>Subject:</b> ${escHtml(subject)}</p>` : ""}
      <hr/>
      <p>${escHtml(message).replace(/\n/g, "<br>")}</p>
    `,
  });
}

function sendConfirmationEmail({
  smtpUser,
  smtpKey,
  fromEmail,
  toEmail,
  name,
  subject,
  message,
}) {
  const transport = getTransport(smtpUser, smtpKey);

  return transport.sendMail({
    from: `"Vitalii Belevtsov" <${fromEmail}>`,
    to: toEmail,
    subject: `Got your message, ${name} ✓`,
    html: buildConfirmationHtml({ name, subject, message }),
  });
}

module.exports = { sendNotificationEmail, sendConfirmationEmail };
