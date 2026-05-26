#!/usr/bin/env python3
"""
save_contact.py
---------------
Minimal Flask server that receives form submissions from index.html
and appends contacts to contatti.csv (append-only, never overwrites).

CSV columns (Brevo-ready):
    First Name | Last Name | Email | Timestamp

Usage:
    pip install flask flask-cors
    python3 save_contact.py

The server listens on http://localhost:5000
The landing page (index.html) POSTs to http://localhost:5000/save-contact
"""

import csv
import os
import re
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
CSV_FILE    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "contatti.csv")
CSV_HEADERS = ["First Name", "Last Name", "Email", "Marketing Consent", "Timestamp"]
PORT        = 5050
EMAIL_RE    = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app, origins=["null", "http://localhost", "http://127.0.0.1",
                   "http://localhost:3000", "http://localhost:8000",
                   "http://127.0.0.1:8000", "file://"])   # allow local file:// origin


def ensure_csv() -> None:
    """Create contatti.csv with headers if it does not exist yet."""
    if not os.path.isfile(CSV_FILE):
        with open(CSV_FILE, "w", newline="", encoding="utf-8") as f:
            csv.writer(f).writerow(CSV_HEADERS)


def append_contact(first: str, last: str, email: str, consent: bool, ts: str) -> None:
    """Append one row to contatti.csv in append mode."""
    ensure_csv()
    with open(CSV_FILE, "a", newline="", encoding="utf-8") as f:
        csv.writer(f).writerow([first, last, email, "yes" if consent else "no", ts])


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.route("/save-contact", methods=["POST"])
def save_contact():
    data = request.get_json(silent=True)

    if not data:
        return jsonify({"error": "No JSON body received"}), 400

    # Accept either {name: "Mario Rossi"} or {firstName: "Mario", lastName: "Rossi"}
    name  = str(data.get("name",      "")).strip()
    first = str(data.get("firstName", "")).strip()
    last  = str(data.get("lastName",  "")).strip()
    email = str(data.get("email",     "")).strip().lower()
    consent = bool(data.get("marketingConsent", False))
    ts    = str(data.get("timestamp", datetime.now(timezone.utc).isoformat()))

    if not first and name:
        parts = name.split(None, 1)
        first = parts[0]
        last  = parts[1] if len(parts) > 1 else ""

    # Server-side validation
    if not first:
        return jsonify({"error": "name is required"}), 422
    if not email or not EMAIL_RE.match(email):
        return jsonify({"error": "A valid email is required"}), 422

    try:
        append_contact(first, last, email, consent, ts)
    except OSError as exc:
        app.logger.error("CSV write error: %s", exc)
        return jsonify({"error": "Could not save contact"}), 500

    app.logger.info("Contact saved: %s %s <%s> consent=%s", first, last, email, consent)
    return jsonify({"success": True}), 200


@app.route("/health", methods=["GET"])
def health():
    """Quick health-check endpoint."""
    return jsonify({"status": "ok"}), 200


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    ensure_csv()
    print(f"\n  Backend avviato su http://localhost:{PORT}")
    print(f"  Contatti salvati in: {CSV_FILE}\n")
    app.run(host="localhost", port=PORT, debug=False)
