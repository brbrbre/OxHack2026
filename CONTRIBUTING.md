# How we worked

## Who built what

| Folder | Owner | What it does |
|---|---|---|
| `data/` | Rocco | Download prices and cache them |
| `model/` | Brisma (Trend + TDA), Felipe (XGBoost) | Prediction models and their validation |
| `decision/` | Rocco | Turn the forecast into Invest / Wait / Not now, backtest and calibration |
| `api/` | Rocco | FastAPI server between the app and the Python code |
| `app/` | Carlos | The React app: landing page, planner, languages, currencies, charts |
| `explain/` | Rocco | Gemini summary and tutor, ElevenLabs voice |
| `habito/` | Rocco | "Make it a habit": WhatsApp reminder and call through Twilio |
| `tiger/` | Rocco | Prices and graded predictions in Tiger Data |
| `deploy/` | Rocco | The live demo on Vultr |
| `notebooks/` | Felipe and Brisma | Exploration; nothing the app runs lives here |
| `tests/` | Everyone, their own | Fast tests with pytest and Vitest |
| `docs/` | Rocco and Brisma | Pitch, sources and Devpost text |

## How it fits together

```
app/ (React)  --HTTP-->  api/ (FastAPI)  -->  model/ + decision/ + data/
                                         -->  explain/ (Gemini, ElevenLabs)
                                         -->  habito/ (Twilio)  -->  WhatsApp, phone call
                                         -->  tiger/ (Tiger Data)
```

The app only talks to `api/`. The contract is in `api/README.md`.

## Branches

- `main` always runs. Nobody pushes broken code to `main`.
- Each person works on their own branch (`carlos/...`, `rocco/...`, and the model branches) and merges through a pull request.
- `git pull` before starting; small commits, often.

## Setup

```bash
git clone https://github.com/brbrbre/OxHack2026.git
cd OxHack2026
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # put your keys here
uvicorn api.main:app --reload --port 8000
```

The app needs Node.js 20 or newer:

```bash
cd app
npm ci
npm run dev                      # http://localhost:5173
```

## Rules

- The repo is **public**. No keys, phone numbers or e-mail addresses in the code: they go in `.env`, which is never committed.
- Downloaded data and the reminder database go in `data/cache/`, which is never committed.
- Models are validated in time order: train on the past, test on the future.
- Every metric in the README comes from a command anyone can run.
- Gemini and ElevenLabs only explain and speak. The model and the rule decide.
