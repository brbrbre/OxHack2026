# api/ - the bridge between the web app and the Python code

FastAPI. The React app never calls Python directly; it asks this server for data.
The contract below is what the app relies on. Field names and codes stay in Spanish (`simbolo`, `monto`, `INVERTIR`); every text a person reads arrives in English.

Run locally: `uvicorn api.main:app --reload --port 8000`

Tests: `python -m pytest -q tests` (no internet needed).

## Which model it uses

- `model/predict.py` picks the model. By default it is Trend + TDA (`model/predict_tda.py`, name `tendencia-tda`). `MODELO=xgboost` switches to XGBoost (`model/predict_xgboost.py`).
- If the model's function accepts `es_cripto=`, the API passes it (`True` for BTCUSDT, ETHUSDT and SOLUSDT).
- If no model loads, the API falls back to `api/baseline.py`: mean and volatility of the last 3 years. The baseline is also the yardstick the models are compared against.
- `TDA_PARAMS` points to the Trend + TDA parameters. The app uses `model/params_tda.json` (all history); the honest test uses `model/params_tda_hasta_2021.json`.
- Every answer says which model it used in `"modelo"`. The app shows it as "Trend + TDA" or "XGBoost".

If `app/dist` exists (the React app built with `npm run build`), the API also serves it at `/`, so the demo is one program.

## Routes

### `GET /api/assets`

The asset catalogue, grouped by type.

```json
{
  "ETFs": [
    {"simbolo": "SPY", "nombre": "S&P 500 (SPDR)"},
    {"simbolo": "QQQ", "nombre": "Nasdaq 100"}
  ],
  "Crypto": [
    {"simbolo": "BTCUSDT", "nombre": "Bitcoin"}
  ]
}
```

### `GET /api/prices/{simbolo}?dias=365`

Daily closes for the chart. `dias` is optional (365 by default).

```json
{
  "simbolo": "SPY",
  "fechas": ["2025-10-24", "2025-10-27", "...", "2026-10-23"],
  "cierres": [598.12, 601.40, "...", 759.97]
}
```

### `POST /api/decide`

Asks for the decision on one asset. `perfil` is `conservador`, `moderado` or `agresivo`. `plazo_dias` is how long the person plans to stay invested.

```json
{"simbolo": "SPY", "monto": 1000, "plazo_dias": 30, "perfil": "moderado"}
```

Response:

```json
{
  "simbolo": "SPY",
  "nombre": "S&P 500 (SPDR)",
  "decision": "INVERTIR",
  "razones": [
    "Over 30 days the model expects +2.0%, with a 31% chance of loss.",
    "Likely range: -$45 to $85 on $1,000.",
    "The expected gain makes up for the risk for your profile."
  ],
  "recomendaciones": [],
  "numeros": {
    "monto": 1000, "plazo_dias": 30, "perfil": "moderado",
    "rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31,
    "senal": 0.5, "peor_caso": -45.0, "mejor_caso": 85.0,
    "fraccion": 1.0, "monto_sugerido": 1000.0, "tendencia_12m": 0.14,
    "eventos": []
  },
  "modelo": "tendencia-tda",
  "aviso": "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
}
```

- `decision` is always `INVERTIR` (Invest), `ESPERAR` (Wait) or `NO_POR_AHORA` (Not now).
- `fraccion` (0 to 1) and `monto_sugerido` say how much to invest today. This is the main figure; the app shows it large.
- `tendencia_12m` is the return of the last 12 months (`null` if there is not enough history).
- `eventos` holds texts like `"Fed rate decision (2026-10-28)"` when one is near.
- Errors: 400 or 404 with `{"error": "text"}`.

### `POST /api/plan`

For people who don't know what to buy ("Help me choose"). It takes the amount, horizon, profile and the asset types they like (group names from `/api/assets`, one or more).

```json
{"monto": 5000, "plazo_dias": 90, "perfil": "moderado", "tipos": ["ETFs", "US stocks", "Crypto"]}
```

Response (trimmed):

```json
{
  "cartera": [
    {"simbolo": "VOO", "nombre": "S&P 500 (Vanguard)", "grupo": "ETFs", "peso": 0.28, "monto": 1400.0},
    {"simbolo": "QQQ", "nombre": "Nasdaq 100", "grupo": "ETFs", "peso": 0.20, "monto": 1000.0}
  ],
  "efectivo": 0.0,
  "invertir": [{"simbolo": "SPY", "nombre": "S&P 500 (SPDR)", "grupo": "ETFs", "razon": "...", "fraccion": 1.0, "fuera_del_plan": "Moves almost like S&P 500 (Vanguard), which is already in the plan."}],
  "esperar": [{"simbolo": "BTCUSDT", "nombre": "Bitcoin", "grupo": "Crypto", "razon": "In a bad scenario the full amount could lose $1,097 (-21.9%); your moderate profile accepts up to 10%.", "fraccion": 0.46}],
  "no_por_ahora": [],
  "resumen": "For 90 days with a moderate profile: $1,400 in S&P 500 (Vanguard), ... Keep $0 in cash.",
  "numeros": {"monto": 5000, "plazo_dias": 90, "perfil": "moderado", "invertido": 5000.0,
              "rendimiento_esperado": 0.057, "volatilidad": 0.08, "peor_caso": -321.0, "tolerancia": 0.1},
  "modelo": "tendencia-tda",
  "aviso": "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
}
```

- `cartera` is sorted by weight: up to 5 assets, at most 40% in one, and never two assets that move almost the same (like SPY and VOO).
- `efectivo` is what Horizon would not invest today. `invertido + efectivo = monto`.
- `invertir`, `esperar` and `no_por_ahora` list every asset of the chosen types, each with its reason.
- Each asset in `invertir` carries `fuera_del_plan`: `null` if it is in the plan, or why it was left out (it moves like one already chosen, or the plan already has 5).
- Unknown type: 400 with `{"error": "Unknown asset types: ..."}`.

### Summary, tutor and audio (Gemini and ElevenLabs)

They only write, explain or read aloud. They never decide or change a number. Keys go in `.env` (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`); without them everything still works with local texts.

- `POST /api/summary/decide` (same body as `/api/decide`) and `POST /api/summary/plan` (same body as `/api/plan`) return `{"texto": "...", "fuente": "gemini" | "template"}`. If Gemini fails, takes longer than 8 s, or its text lacks the amount the rule computed, the template is used.
- `POST /api/ask` with `{"pregunta": "...", "simbolo": "WALMEX.MX", "contexto": {...}, "historial": [{"pregunta": "...", "respuesta": "..."}]}` returns `{"respuesta": "...", "fuente": "gemini" | "local" | "offline"}`. `simbolo`, `contexto` and `historial` are optional (at most 4 turns, questions up to 300 characters). Without Gemini it answers from the asset fact sheet (`explain/fichas.py`) or the glossary.
- `POST /api/listen` with `{"texto": "..."}` returns `audio/mpeg`. It only reads summaries this server wrote (400 otherwise); 503 if there is no audio, and the app falls back to the browser's voice.

Gemini model: `GEMINI_MODEL` (default `gemini-flash-lite-latest`). Voice: `ELEVENLABS_VOICE_ID` and `ELEVENLABS_MODEL`.

### Make it a habit: WhatsApp reminder and call (`habito/`)

The person asks Horizon to remind them about one asset or a whole "Help me choose" plan. When the horizon ends, the server computes that day's answer again, and Gemini drafts a WhatsApp with those numbers and a personal link. If nobody opens the link within `HABITO_ESPERA_MIN` minutes, Twilio calls and plays a script in an ElevenLabs voice. It is one or the other: an opened link cancels the call, and opening the link during a call hangs it up.

- `POST /api/habit/remind` saves the reminder; it is due after `plazo_dias`. Body: `{"telefono": "+1...", "consentimiento": true, "monto", "plazo_dias", "perfil"}` plus either `"simbolo"` (one asset) or `"tipos"` (a plan). 400 without consent, with a bad format, or with neither; 403 if the number is not in `HABITO_PERMITIDOS` (the URL is public, so nobody can use it to send spam).
- `GET /api/habit/{token}` gives the status, checked live against Twilio:
  - `estado`: `pendiente`, `enviado`, `abierto`, `llamando`, `llamado` (Twilio says the call was `completed`), `sin_respuesta` (busy, no answer, failed or canceled) or `error`.
  - `mensaje_estado`: what Twilio reports for the WhatsApp (`queued`, `sent`, `delivered`, `read`, `undelivered`, `failed`).
  - `llamada_estado`: what Twilio reports for the call (`queued`, `ringing`, `in-progress`, `completed`, `busy`, `no-answer`...).
- `POST /api/habit/{token}/now` (only with `HABITO_DEMO=1`) makes the reminder due now and sends it, so a demo does not wait 30 days.
- `GET /r/{token}` is the WhatsApp link. It only redirects to the app with the same plan, adding `recordatorio={token}`. It does not mark anything, because WhatsApp's link-preview robot also visits it.
- `POST /api/habit/{token}/open` is what marks the reminder opened. The app calls it when it loads from the link; the preview robot does not run JavaScript.
- `GET /api/habit/audio/{token}.mp3` is the audio the call plays.

Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (the Twilio number that calls), `TWILIO_WHATSAPP_FROM` (the sandbox number), `PUBLIC_URL`, `HABITO_PERMITIDOS` (defaults to `DEMO_PHONE`), `HABITO_LLAMADA_A` (`whatsapp=voice` pairs, to call a different number than the WhatsApp one; Mexican mobiles lose the 1 for dialling), `HABITO_ESPERA_MIN` (default 1440), `HABITO_DEMO`, `HABITO_CANAL=sms` (send SMS instead of WhatsApp), `HABITO_AUTO=1` (checks reminders every 20 s inside the API). Reminders live in `data/cache/habito.sqlite`, outside the repo, because they hold phone numbers.

Demo limits: Twilio's WhatsApp sandbox only writes to numbers that joined it with "join ...". In real use, a message that opens a conversation needs a template approved by Meta.
