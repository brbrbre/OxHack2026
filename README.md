# Horizon

OxHack 26, Oxford, 24-25 October 2026. Theme: **TIME**.
Challenge: HRT "Best Use of Data for Predictions and Decision Making".

**Live demo:** https://95.179.232.47.sslip.io (hosted on Vultr, London; also http://95.179.232.47).
**Pitch:** `docs/pitch.md`, with every outside figure sourced in `docs/pitch-sources.md`.

## The problem

People want to invest, but they don't know when, so most do nothing or follow a stranger online.
- 61% of UK adults with £10,000+ to invest keep three quarters of it in cash (FCA, 2025).
- In Mexico, 76.5% of adults have a bank product, but only 3.4% hold a term deposit or a fund (INEGI, 2024).
- Finfluencer followers scored 42% on an investing quiz, yet 63% rated their own knowledge as high (FINRA Foundation, 2026).
- Only 9% of UK adults got regulated advice in a year (FCA, 2025).

Most apps answer with a chart, not a decision.
Horizon asks which asset, how much, for how long and how much risk you accept.
Then it answers: how much to invest **today**, why, and it checks in when your time is up.

## What it does

- **I have assets in mind.** Pick one or several of 21 assets: US, Mexican and UK stocks, ETFs, indices, currencies and crypto. Horizon answers *Invest*, *Wait* or *Not now* for each, with the amount to invest today.
- **Help me choose.** Give an amount, a horizon, a risk profile and the asset types you like. Horizon builds a plan with up to 5 assets and keeps the rest in cash.
- **Reasons, not vibes.** Every answer shows its numbers: expected return, chance of loss and the bad-case loss. It also flags upcoming central bank decisions.
- **Guided setup.** New to investing? Horizon asks one question at a time and explains each choice.
- **In short.** Gemini sums up the answer in plain words. Press *Listen* to hear it in an ElevenLabs voice.
- **Ask Horizon.** A money tutor built on Gemini. Ask what a company does, or what an ETF is. It explains with everyday examples, and never says buy or sell.
- **Make it a habit.** For one asset or a whole plan. Leave your number and Horizon checks in when your horizon ends. It sends a WhatsApp with that day's answer and a link back to your plan. If you don't open it, it gives you a short call in an ElevenLabs voice. It is one or the other: opening the link cancels the call.
- **For everyone.** A landing page that explains the idea, five languages, local currencies, and a dark theme. Model explanations and audio stay in English.

Gemini and ElevenLabs only write and read. They never change Horizon's numbers.

This is an educational prototype. It is not financial advice.

## How it decides

1. **Predict.** A model predicts the return over the horizon, its spread, and the chance of a loss. It only sees prices up to the decision date.
2. **Size by risk.** The amount to invest today is `min(1, tolerance / |bad case|)` of what you asked. The bad case is the 5th percentile of the forecast. Tolerance is 5%, 10% or 20% for conservative, moderate and aggressive.
3. **Filter.** If the model expects a loss, the answer is *Not now*.
4. **Events.** A Fed or Bank of England rate decision within 3 days? Invest half now and half after.

Why sizing and not timing? Timing rarely beats investing now. Vanguard found a lump sum beats staged entry 68% of the time (1976-2022). Sizing by volatility makes extreme losses less severe (Harvey et al. 2018).

## The habit, honestly

The demo sends real messages, but only to the team's numbers.
WhatsApp goes through the Twilio sandbox, and calls come from a Twilio number.
The panel shows what Twilio reports: delivered, busy, no answer or completed.
The link only counts as opened when the app loads, because WhatsApp's link-preview robot also visits it.
In production, the first WhatsApp message needs a template approved by Meta.
The demo can skip the waiting period with one button, so nobody waits for the full horizon.

## Sponsor tools

| Tool | What it does in Horizon |
|---|---|
| Gemini | Writes the *In short* summary, answers *Ask Horizon* and drafts the reminder message |
| ElevenLabs | Reads the summary aloud and voices the reminder call |
| Tiger Data | Stores daily prices and every prediction; one command grades them once their horizon ends |
| Vultr | Hosts the live demo in London, with HTTPS through Caddy |

Tiger Data and Vultr are optional. Without them, the app runs the same on a laptop.

## Data

| What | Source |
|---|---|
| Stocks, ETFs, indices, FX | Yahoo Finance via `yfinance` (daily, adjusted) |
| Crypto | Binance public market data (daily) |
| Rate decisions | Fed, ECB and Bank of England official calendars |

History goes back to 1993 for SPY and 2017 for Bitcoin.

## Results

All numbers below come from commands in this repo. Run them yourself.
Three models feed the same rule. The **baseline** uses 3-year mean and volatility. **Trend + TDA** (by Brisma) is the one the app uses. **XGBoost** (by Felipe) is the backup.

Trend + TDA reads momentum over 1, 3, 6 and 12 months. It also measures the shape of recent returns with persistent homology, a tool from topology. Its tails come from real past errors, not from a bell curve.

To test it fairly, we retrained it with data up to November 2021 only. The app itself uses the version trained on all history.

### Does the forecast tell the truth?

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
```

1,218 windows of 30 days, 21 assets, 2022 to today:

| Check | Target | Baseline | XGBoost | Trend + TDA |
|---|---|---|---|---|
| Real return inside the 90% interval | 90% | 92% | 94% | **90%** |
| Real return below the 5th percentile | 5% | 4% | 3% | **4%** |
| Brier score of chance of loss (lower is better) | below naive 0.246 | 0.252 | 0.250 | **0.245** |
| Rank correlation, expected vs real | above 0 | -0.06 | +0.02 | **+0.06** |

**Trend + TDA is the only model that beats the naive loss rate.** The gain is small. Its interval is right on target.

### Does following Horizon pay?

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.calibrate --modelo model --perfil moderado
```

Protocol: 6 rule settings fixed in advance, one set for all assets. Chosen on 2016-2021, tested on 2022 to today. Equal-weight portfolio of 21 assets, 57 windows of 30 days, entry at the next close.

Sharpe ratio on the test period. Buying and holding every asset got 0.98.

| Profile | Baseline | XGBoost | Trend + TDA | Same exposure | Max drawdown, TDA | Max drawdown, same exposure |
|---|---|---|---|---|---|---|
| Conservative | 1.08 | 1.15 | **1.18** | 0.98 | **-9.1%** | -15.9% |
| Moderate | 0.97 | 1.14 | **1.17** | 0.98 | **-16.5%** | -24.0% |
| Aggressive | 0.83 | 1.09 | **1.10** | 0.98 | **-22.8%** | -27.5% |

**Same exposure** invests Horizon's average fraction in every asset, every time. We checked the Trend + TDA gain over same exposure with a bootstrap. Its 90% interval excludes zero for moderate (+0.01 to +0.38) and aggressive (+0.05 to +0.20). For conservative it does not (-0.08 to +0.45).

### Where does the gain come from?

A gain over "same exposure" can come from two places. **Sizing:** less money in volatile assets like crypto. **Timing:** investing more before good months. To split them, we give each asset its own average fraction and keep it fixed.

| Profile | Trend + TDA, Horizon | Fixed size per asset | Timing gain | Random timings that match it | XGBoost timing gain | Baseline timing gain |
|---|---|---|---|---|---|---|
| Conservative | 1.18 | 1.10 | **+0.08** | 3% | +0.03 | -0.09 |
| Moderate | 1.17 | 1.09 | **+0.08** | 1% | +0.02 | -0.17 |
| Aggressive | 1.10 | 1.03 | **+0.07** | 1% | +0.02 | -0.27 |

What we learned:
- **Most of the gain is still sizing.** Horizon puts less in crypto and more in broad index funds.
- **Trend + TDA times better than chance.** Its timing gain is 3 to 4 times XGBoost's. Only 1% to 3% of random timings match it. It is still small.
- **Baseline timing hurts.** Fixed sizing beats it in all three profiles.
- **We do not report the 2019-2021 walk-forward for Trend + TDA.** Those years are inside its training data.
- **The choice between settings is fragile.** Adding 2 assets changed the winner for the baseline.

## The final version: what changed during the weekend

What we added:
- Trend + TDA (Brisma) became the main model; XGBoost (Felipe) is the backup and the 3-year baseline is the fallback.
- "Help me choose" plans, "In short" with Listen, "Ask Horizon", and the habit for one asset or a whole plan.
- A landing page, a guided setup, several assets at once, five languages, local currencies and a dark theme (Carlos).
- Real status from Twilio in the habit panel, HTTPS on the demo, and Tiger Data grading.

What we changed after testing:
- The first rule blocked instead of sizing and sat in cash 84% of the time. It now invests by default and risk sets the amount.
- The trend brake did not help in training, so it is off.
- The habit link is marked opened by the app, not by the link, because WhatsApp's preview robot visits every link.

What we left out:
- WhatsApp through Meta's Cloud API: creating the test number failed twice, so the demo uses the Twilio sandbox.
- SMS as a second channel: a US Twilio number can't text UK mobiles. The code supports it (`HABITO_CANAL=sms`); the app doesn't offer it.
- Alpha Vantage, the Streamlit fallback and Delta: not needed in the end.
- A single API call for several selected assets: the app calls `/api/decide` once per asset instead.
- Banxico's rate calendar: its late-2026 dates were not published where we looked.

## Limitations

- Cash earns 0%. No trading costs.
- The 21 assets were picked in 2026: survivorship bias.
- The rate-decision calendar starts in October 2026, so it is not in the backtest.
- The test has 57 portfolio windows. That is too few to separate small Sharpe gaps from noise.
- "Fixed size per asset" uses each asset's average over the test period. It is a yardstick, not a strategy you could trade.

## How to run

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m data.fetch SPY BTCUSDT WALMEX.MX   # download and cache prices
uvicorn api.main:app --port 8000             # API

cd app && npm ci && npm run dev              # web app on http://localhost:5173
```

Tests: `python -m pytest -q tests` (125 tests, no internet needed) and `cd app && npm test` (436 tests).
Copy `.env.example` to `.env` for Gemini, ElevenLabs, Tiger Data and Twilio. Without keys, the app still runs with local texts.

## Repo map

| Folder | What |
|---|---|
| `data/` | Prices from Yahoo and Binance, with a local cache |
| `model/` | Trend + TDA (Brisma) and XGBoost (Felipe), plus the training notebooks |
| `decision/` | Decision rule, plan builder, backtest, calibration, forecast evaluation |
| `api/` | FastAPI server: `/api/assets`, `/api/prices`, `/api/decide`, `/api/plan`, `/api/summary`, `/api/ask`, `/api/habit` |
| `explain/` | Gemini summary and tutor, ElevenLabs voice |
| `habito/` | Reminders: WhatsApp, call and their real status from Twilio |
| `tiger/` | Prices and graded predictions in Tiger Data |
| `deploy/` | How the Vultr demo runs: systemd, Caddy and HTTPS |
| `app/` | React web app (Carlos): landing page, planner, five languages |
| `docs/` | Pitch, pitch sources and Devpost text |

## Team

Brisma, Carlos, Felipe Damian and Rocco. MSc AI & Data Science, University of Hull.
