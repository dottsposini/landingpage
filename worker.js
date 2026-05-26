/**
 * Cloudflare Worker — ponte form → Brevo + invio email di benvenuto col PDF
 *
 * Flusso:
 *   1. Riceve POST dal form della landing
 *   2. Valida nome + email
 *   3. Crea/aggiorna contatto in Brevo (upsert):
 *      - sempre nella lista "Lead Magnet"
 *      - in più in "Marketing OK" se ha spuntato il consenso
 *   4. Manda subito un'email transazionale via Brevo con il link al PDF
 *   5. Restituisce {success:true}
 *
 * Variabili da impostare in CF Worker → Settings → Variables and Secrets:
 *   - BREVO_API_KEY        (secret): la API key Brevo
 *   - BREVO_LIST_LEADS     (plain):  ID lista "Lead Magnet"
 *   - BREVO_LIST_MARKETING (plain):  ID lista "Marketing OK"
 *   - ALLOWED_ORIGIN       (plain):  Origin permesso (es. https://dottsposini.github.io)
 *   - SENDER_EMAIL         (plain):  email del mittente (verificato in Brevo)
 *   - SENDER_NAME          (plain):  nome del mittente
 *   - PDF_URL              (plain):  URL pubblico del PDF
 */

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || "*";

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, corsHeaders);
    }

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400, corsHeaders);
    }

    const name = String(data.name || "").trim();
    const email = String(data.email || "").trim().toLowerCase();
    const consent = Boolean(data.marketingConsent);

    if (name.length < 2) return json({ error: "Nome richiesto" }, 422, corsHeaders);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "Email non valida" }, 422, corsHeaders);

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(" ");

    // 1) Upsert contatto in Brevo
    const lists = [];
    if (env.BREVO_LIST_LEADS) lists.push(Number(env.BREVO_LIST_LEADS));
    if (consent && env.BREVO_LIST_MARKETING) lists.push(Number(env.BREVO_LIST_MARKETING));

    try {
      const contactRes = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          email,
          attributes: {
            FIRSTNAME: firstName,
            LASTNAME: lastName,
            MARKETING_OK: consent,
            SIGNUP_DATE: new Date().toISOString(),
          },
          listIds: lists,
          updateEnabled: true,
        }),
      });

      if (!contactRes.ok && contactRes.status !== 204) {
        const detail = await contactRes.text();
        return json({ error: "Brevo contact error", status: contactRes.status, detail }, 502, corsHeaders);
      }
    } catch (err) {
      return json({ error: "Network error (contact)", detail: String(err) }, 500, corsHeaders);
    }

    // 2) Manda email transazionale con il PDF
    const pdfUrl = env.PDF_URL || "https://dottsposini.github.io/landingpage/guida.pdf";
    const senderEmail = env.SENDER_EMAIL || "noreply@brevo.com";
    const senderName = env.SENDER_NAME || "Dott.ssa Claudia Sposini";

    const htmlBody = welcomeEmailHtml(firstName, pdfUrl);
    const textBody = welcomeEmailText(firstName, pdfUrl);

    try {
      const emailRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: { name: senderName, email: senderEmail },
          to: [{ email, name: firstName }],
          replyTo: { email: senderEmail, name: senderName },
          subject: "La tua guida è qui — Quando la Testa Blocca il Corpo",
          htmlContent: htmlBody,
          textContent: textBody,
          tags: ["lead-magnet", "welcome"],
        }),
      });

      if (!emailRes.ok) {
        const detail = await emailRes.text();
        // Il contatto è già salvato; non blocchiamo il successo per un fallimento di invio email.
        return json({ success: true, warning: "Contact saved but email failed", detail }, 200, corsHeaders);
      }
    } catch (err) {
      return json({ success: true, warning: "Contact saved but email error", detail: String(err) }, 200, corsHeaders);
    }

    return json({ success: true }, 200, corsHeaders);
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function welcomeEmailHtml(firstName, pdfUrl) {
  const safeFirst = (firstName || "").replace(/[<>&"]/g, "");
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<style>
  body{margin:0;padding:0;background:#0A1018;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#ECE8E2}
  .wrap{max-width:560px;margin:0 auto;padding:32px 24px}
  .box{background:#0E1620;border:1px solid rgba(94,196,212,0.16);border-radius:16px;padding:32px}
  h1{font-size:22px;font-weight:700;margin:0 0 16px;color:#ECE8E2;line-height:1.3}
  p{font-size:15px;line-height:1.7;color:#9EAAB7;margin:0 0 16px}
  .btn{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#5EC4D4,#3A9CC5);
       color:#0A1018!important;text-decoration:none;border-radius:50px;font-weight:600;font-size:15px;
       text-transform:uppercase;letter-spacing:.04em}
  .btn-wrap{text-align:center;margin:28px 0}
  .sig{margin-top:24px;padding-top:20px;border-top:1px solid rgba(94,196,212,0.08);font-size:13px;color:#546474}
  .sig strong{color:#7AD4E2}
</style>
</head>
<body>
  <div class="wrap">
    <div class="box">
      <h1>Ciao ${safeFirst},</h1>
      <p>Grazie per aver richiesto la guida <strong>Quando la Testa Blocca il Corpo</strong>.</p>
      <p>Clicca qui sotto per scaricarla:</p>
      <div class="btn-wrap">
        <a class="btn" href="${pdfUrl}">Scarica la guida</a>
      </div>
      <p>Spero che ti sarà utile. Se hai domande o vuoi approfondire, rispondi pure a questa email — leggo personalmente ogni messaggio.</p>
      <div class="sig">
        <p><strong>Dott.ssa Claudia Sposini</strong><br>
        Psicologa, Psicoterapeuta, Consulente sessuale<br>
        Iscritta all'Albo degli Psicologi della Lombardia</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function welcomeEmailText(firstName, pdfUrl) {
  return `Ciao ${firstName || ""},

Grazie per aver richiesto la guida "Quando la Testa Blocca il Corpo".

Scaricala qui: ${pdfUrl}

Spero che ti sarà utile. Se hai domande o vuoi approfondire, rispondi pure a questa email — leggo personalmente ogni messaggio.

Dott.ssa Claudia Sposini
Psicologa, Psicoterapeuta, Consulente sessuale
Iscritta all'Albo degli Psicologi della Lombardia
`;
}
