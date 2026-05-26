# Deploy — Landing Claudia Sposini

Setup completo 100% gratis: GitHub Pages + Brevo + Cloudflare Worker.

---

## 1. Brevo — setup account (5 min)

1. Vai su https://www.brevo.com/it e registrati (free).
2. **Crea 2 liste** (sidebar → "Contatti" → "Liste" → "Crea una lista"):
   - `Lead Magnet` — tutti quelli che scaricano la guida
   - `Marketing OK` — solo chi ha spuntato il consenso
3. **Prendi gli ID delle liste**: vai su ogni lista, l'ID è nell'URL (es. `app.brevo.com/contact/list/123` → ID = `123`). Annotali.
4. **API Key**: "Settings" (in basso a sinistra) → "SMTP & API" → tab "API Keys" → "Generate a new API key" → dagli un nome (es. "Landing Worker") → copia il valore.
5. **Le 52 newsletter settimanali** (drip evergreen) — vedi sezione "9. Drip 52-settimane" più sotto.

---

## 2. PDF — hosting (1 min)

Carica il PDF in questa cartella con nome esatto **`guida.pdf`**. Verrà servito da GitHub Pages all'URL `https://[user].github.io/[repo]/guida.pdf` (o sul dominio personalizzato).

---

## 3. Cloudflare Worker — deploy (5 min)

### Opzione A — dashboard web (no CLI)

1. Vai su https://dash.cloudflare.com/ → "Workers & Pages" → "Create" → "Create Worker".
2. Dagli un nome es. `claudia-leads`. L'URL sarà `https://claudia-leads.[tuosottodominio].workers.dev`.
3. Click "Deploy" (deploy del template), poi "Edit code".
4. Apri il file `worker.js` di questa cartella, copia tutto il contenuto e incollalo nell'editor di Cloudflare (sostituisce il codice di esempio).
5. Click "Save and deploy".
6. Ora vai su "Settings" → "Variables and Secrets":
   - `BREVO_API_KEY` → tipo **Secret** → incolla la API key di Brevo
   - `BREVO_LIST_LEADS` → tipo Text → l'ID della lista "Lead Magnet" (numero)
   - `BREVO_LIST_MARKETING` → tipo Text → l'ID della lista "Marketing OK" (numero)
   - `ALLOWED_ORIGIN` → tipo Text → `*` per ora (lo restringi al dominio reale a deploy finito)
7. **Test rapido** (terminale):
   ```bash
   curl -X POST https://claudia-leads.TUOSOTTODOMINIO.workers.dev \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@example.com","marketingConsent":true}'
   ```
   Aspettati `{"success":true}`. Verifica in Brevo che il contatto sia apparso.

### Opzione B — Wrangler CLI (per chi è comodo con il terminale)

```bash
npm install -g wrangler
wrangler login
wrangler init claudia-leads
# copia worker.js sopra src/index.ts (o crea wrangler.toml con main = "worker.js")
wrangler secret put BREVO_API_KEY
wrangler deploy
```

---

## 4. Aggiornare il frontend con l'URL del Worker (30 sec)

Apri `index.html`, cerca questa riga (intorno alla riga ~870):

```js
var WORKER_URL = 'https://claudia-leads.YOURSUBDOMAIN.workers.dev';
```

Sostituisci `YOURSUBDOMAIN` con il tuo sottodominio Cloudflare reale (es. `daniele-mormone-2024`).

---

## 5. Brevo — automazione email con PDF (5 min)

1. In Brevo: "Automation" (sidebar) → "Create an automation" → "Welcome message".
2. **Trigger**: "A contact is added to a list" → seleziona "Lead Magnet".
3. **Azione**: "Send an email" → crea un template:
   - **Subject**: `La tua guida è qui — Quando la Testa Blocca il Corpo`
   - **From**: il tuo dominio verificato (vedi step 6) o l'email Brevo di default
   - **Body** (HTML):
     ```html
     <p>Ciao {{contact.FIRSTNAME}},</p>
     <p>Grazie per aver richiesto la guida <strong>Quando la Testa Blocca il Corpo</strong>.</p>
     <p>Clicca qui sotto per scaricarla:</p>
     <p style="text-align:center;margin:30px 0">
       <a href="https://TUODOMINIO/guida.pdf"
          style="display:inline-block;padding:14px 32px;background:#5EC4D4;color:#0A1018;
                 text-decoration:none;border-radius:50px;font-weight:600">
         Scarica la guida
       </a>
     </p>
     <p>Se hai domande o vuoi approfondire, rispondi pure a questa email — leggo personalmente ogni messaggio.</p>
     <p>Un caro saluto,<br>
     <strong>Dott.ssa Claudia Sposini</strong><br>
     <em>Psicologa, Psicoterapeuta, Consulente sessuale</em></p>
     ```
4. Attiva l'automazione.

---

## 6. (Opzionale ma consigliato) — Verifica dominio mittente in Brevo

Per non far apparire l'email come "via brevo.com" agli occhi del destinatario:

1. Brevo → "Settings" → "Senders, Domains & Dedicated IPs" → "Domains" → "Add a domain"
2. Inserisci il dominio (es. `dottoressasposini.it`)
3. Brevo ti dà 3 record DNS (SPF, DKIM, DMARC) da aggiungere nel pannello DNS del dominio
4. Aspetti la verifica (qualche ora). Poi nell'automazione puoi usare `noreply@dottoressasposini.it` come sender

---

## 7. GitHub Pages — deploy del sito (5 min)

1. Crea repo GitHub (es. `claudia-landing`)
2. Push di questa cartella (ESCLUDI `.venv`, `save_contact.py`, `contatti.csv`, `worker.js`, `index-v1.html`, `index.old.html`, `Foto Doc.png`, `DEPLOY.md`):
   ```bash
   cd "/Users/danielemormone/WEBSITE (Claudia Sposini)"
   git init
   echo ".venv/
   contatti.csv
   __pycache__/
   .DS_Store
   *.csv
   save_contact.py
   worker.js
   DEPLOY.md
   index.old.html
   index-v1.html
   Foto Doc.png" > .gitignore
   git add .
   git commit -m "Landing page initial"
   git remote add origin https://github.com/[TUOUSER]/claudia-landing.git
   git push -u origin main
   ```
3. Su GitHub: repo → "Settings" → "Pages" → "Source: Deploy from a branch" → branch `main`, folder `/` → Save.
4. In 1-2 min il sito è online su `https://[tuouser].github.io/claudia-landing/`.

---

## 8. Dominio personalizzato

1. Nel pannello DNS del tuo dominio: aggiungi un record `CNAME` che punta a `[tuouser].github.io`.
2. Su GitHub Pages → "Custom domain" → inserisci `dottoressasposini.it` → Save → "Enforce HTTPS" (dopo qualche minuto).
3. Aggiorna su Cloudflare Worker la variabile `ALLOWED_ORIGIN` con il dominio reale (es. `https://dottoressasposini.it`) per stringere il CORS.

---

## 9. Drip 52-settimane (newsletter automatica)

Le 52 newsletter pre-scritte diventano un workflow "evergreen" in Brevo:
ogni nuovo iscritto a "Marketing OK" riceve la Newsletter #1 subito (o dopo qualche
giorno), poi una a settimana per un anno intero.

### Setup template (con script — più veloce)

1. Crea una cartella `newsletters/` qui dentro con 52 file:
   ```
   newsletters/
   ├── 01-titolo-breve.md
   ├── 02-titolo-breve.md
   ├── ...
   └── 52-titolo-breve.md
   ```
   Ogni file in markdown semplice, con prima riga = subject line preceduto da `# `.

2. Lancia lo script `upload_newsletters.py` (te lo preparo dopo che abbiamo
   una o due email di esempio): converte ogni `.md` in HTML, lo carica come
   template Brevo via API, e ti restituisce la lista degli ID template creati.

### Setup workflow (manuale in Brevo, ~1h)

1. Brevo → "Automations" → "Create an automation" → "Custom"
2. **Entry point**: "A contact is added to a list" → seleziona "Marketing OK"
3. Aggiungi un nodo **"Wait"** → 1 giorno (per dare respiro tra welcome+PDF e prima newsletter)
4. Aggiungi nodo **"Send an email"** → seleziona template "Newsletter Week 01"
5. Aggiungi nodo **"Wait"** → 7 giorni
6. Aggiungi nodo **"Send an email"** → template "Newsletter Week 02"
7. Ripeti 50 volte fino a Week 52
8. Attiva l'automazione

### Note pratiche sul tier free Brevo

- 300 email/giorno = ~9.000/mese. Con 52 newsletter/anno, ogni iscritto riceve ~52 email/anno = ~4/mese.
- Quindi 9.000 email/mese ÷ 4 email/iscritto/mese = **~2.250 iscritti attivi gestibili** sul piano free.
- Quando superi questa soglia: piano Starter ~9€/mese fino a 20k email.

---

## Checklist finale

- [ ] Form sul sito live → invia un test → contatto appare in Brevo "Lead Magnet"
- [ ] L'email automatica arriva con il bottone PDF
- [ ] Il PDF si scarica correttamente
- [ ] Spuntando "consenso marketing" → il contatto appare anche in "Marketing OK"
- [ ] 52 newsletter caricate come template Brevo e automazione drip attivata
- [ ] DNS sender verificato (no "via brevo.com")
- [ ] `ALLOWED_ORIGIN` ristretto al dominio reale (non più `*`)

---

## Sviluppo locale

Il sito continua a funzionare in locale:
```bash
cd "/Users/danielemormone/WEBSITE (Claudia Sposini)"
.venv/bin/python save_contact.py &  # backend Flask su :5050
python3 -m http.server 8000          # static su :8000
```
Vai su `http://localhost:8000`. Il JS rileva automaticamente che sei in locale e usa Flask invece del Worker (il Worker e Brevo restano puliti durante lo sviluppo).
