/**
 * Cloudflare Worker — ponte form → Brevo
 *
 * Riceve POST dal form della landing, valida, e crea/aggiorna il contatto in
 * Brevo aggiungendolo a una lista "Lead Magnet" (tutti) e a "Marketing OK"
 * (solo se ha spuntato il consenso). L'automazione Brevo, triggerata
 * dall'ingresso in "Lead Magnet", manda l'email con il link al PDF.
 *
 * Variabili da impostare in Cloudflare → Worker → Settings → Variables:
 *   - BREVO_API_KEY        (secret, encrypted): la API key copiata da Brevo
 *   - BREVO_LIST_LEADS     (plain): ID numerico della lista "Lead Magnet"
 *   - BREVO_LIST_MARKETING (plain): ID numerico della lista "Marketing OK"
 *   - ALLOWED_ORIGIN       (plain): l'URL del sito, es. "https://dominio.it"
 *                          (in dev puoi mettere "*" temporaneamente)
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

    // CORS preflight
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

    if (name.length < 2) {
      return json({ error: "Nome richiesto" }, 422, corsHeaders);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "Email non valida" }, 422, corsHeaders);
    }

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(" ");

    const lists = [];
    if (env.BREVO_LIST_LEADS) lists.push(Number(env.BREVO_LIST_LEADS));
    if (consent && env.BREVO_LIST_MARKETING) lists.push(Number(env.BREVO_LIST_MARKETING));

    const brevoBody = {
      email,
      attributes: {
        FIRSTNAME: firstName,
        LASTNAME: lastName,
        MARKETING_OK: consent,
        SIGNUP_DATE: new Date().toISOString(),
      },
      listIds: lists,
      updateEnabled: true, // upsert: se l'email esiste già, aggiorna
    };

    try {
      const res = await fetch("https://api.brevo.com/v3/contacts", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": env.BREVO_API_KEY,
        },
        body: JSON.stringify(brevoBody),
      });

      if (!res.ok && res.status !== 204) {
        const detail = await res.text();
        return json(
          { error: "Provider error", status: res.status, detail },
          502,
          corsHeaders
        );
      }

      return json({ success: true }, 200, corsHeaders);
    } catch (err) {
      return json({ error: "Network error", detail: String(err) }, 500, corsHeaders);
    }
  },
};

function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}
