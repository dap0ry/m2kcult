const LOGO_URL = 'https://res.cloudinary.com/dydqye3n1/image/upload/v1784151150/m2kcult/logos/logo-negro.png';
const PHOTO_1_URL = 'https://res.cloudinary.com/dydqye3n1/image/upload/v1784151216/m2kcult/campaign/whatsapp-184347-2.jpg';
const PHOTO_2_URL = 'https://res.cloudinary.com/dydqye3n1/image/upload/v1784151210/m2kcult/campaign/a743133.jpg';

function buildWelcomeEmailHtml(name) {
  return `
<div style="background:#f5f0e8;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;">
    <div style="text-align:center;padding:32px 24px 24px;">
      <img src="${LOGO_URL}" alt="M2KCULT" width="90" style="display:block;margin:0 auto;">
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      <tr>
        <td style="width:50%;padding:0;"><img src="${PHOTO_1_URL}" alt="" width="100%" style="display:block;"></td>
        <td style="width:50%;padding:0;"><img src="${PHOTO_2_URL}" alt="" width="100%" style="display:block;"></td>
      </tr>
    </table>
    <div style="padding:28px 32px 40px;text-align:center;color:#111;">
      <p style="font-size:16px;line-height:1.6;margin:0 0 14px;">Hola ${name},</p>
      <p style="font-size:15px;line-height:1.7;color:#333;margin:0;">
        Gracias por apoyar la marca. A partir de ahora serás de las primeras personas en enterarte cuando saquemos un drop nuevo, antes de que salga a la venta.
      </p>
    </div>
  </div>
</div>
`;
}

async function sendWelcomeEmail(brevoClient, { toEmail, toName }) {
  return brevoClient.send({
    sender: { email: process.env.BREVO_SENDER_EMAIL, name: 'M2KCULT' },
    to: [{ email: toEmail, name: toName }],
    subject: 'Bienvenid@ a M2KCULT',
    htmlContent: buildWelcomeEmailHtml(toName),
  });
}

function createBrevoClient() {
  return {
    async send(payload) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Brevo send failed: ${res.status} ${body}`);
      }
      return res.json();
    },
  };
}

module.exports = { sendWelcomeEmail, buildWelcomeEmailHtml, createBrevoClient };
