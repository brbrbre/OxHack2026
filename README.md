# Horizon

OxHack 26, Oxford, 24-25 October 2026. Theme: **TIME**.
Challenge: HRT "Best Use of Data for Predictions and Decision Making".

## The problem

People want to invest, but they don't know when. Most apps answer with a chart, not a decision.
Horizon asks three things: which asset, how much, and for how long.
Then it answers: how much to invest **today**, and why.

## What it does

- **One asset.** Pick from 21 assets: US, Mexican and UK stocks, ETFs, indices, currencies and crypto. Horizon answers *Invest*, *Wait* or *Not now*, with the amount to invest today.
- **Help me choose.** Give an amount, a horizon, a risk profile and the asset types you like. Horizon builds a plan with up to 5 assets and keeps the rest in cash.
- **Reasons, not vibes.** Every answer shows its numbers: expected return, chance of loss and the bad-case loss. It also flags upcoming central bank decisions.

This is an educational prototype. It is not financial advice.

## How it decides

1. **Predict.** A model predicts the return over the horizon, its spread, and the chance of a loss. It only sees prices up to the decision date.
2. **Size by risk.** The amount to invest today is `min(1, tolerance / |bad case|)` of what you asked. The bad case is the 5th percentile of the forecast. Tolerance is 5%, 10% or 20% for conservative, moderate and aggressive.
3. **Filter.** If the model expects a loss, the answer is *Not now*.
4. **Events.** A Fed or Bank of England rate decision within 3 days? Invest half now and half after.

Why sizing and not timing? Timing rarely beats investing now. Vanguard found a lump sum beats staged entry 68% of the time (1976-2022). Sizing by volatility does cut large drawdowns (Harvey et al. 2018).

## Data

| What | Source |
|---|---|
| Stocks, ETFs, indices, FX | Yahoo Finance via `yfinance` (daily, adjusted) |
| Crypto | Binance public market data (daily) |
| Rate decisions | Fed, ECB and Bank of England official calendars |

History goes back to 1993 for SPY and 2017 for Bitcoin.

## Results

All numbers below come from commands in this repo. Run them yourself.

### Does the forecast tell the truth?

```bash
python -m decision.evaluate_forecasts --desde 2022-01-01
```

Baseline model (3-year mean and volatility), 1,218 windows of 30 days, 21 assets, 2022 to today:

| Check | Target | Baseline |
|---|---|---|
| Real return inside the 90% interval | 90% | **92%** |
| Real return below the 5th percentile | 5% | **4%** |
| Brier score of chance of loss (lower is better) | below naive 0.246 | 0.252 |
| Rank correlation, expected vs real | above 0 | -0.06 |

**The baseline predicts risk well and direction badly.** Its interval is well calibrated. Its direction signal is no better than chance.

### Does following Horizon pay?

```bash
python -m decision.calibrate --perfil conservador
```

Protocol: 6 rule settings fixed in advance, one set for all assets. Chosen on 2016-2021, tested on 2022 to today. Equal-weight portfolio of 21 assets, 30-day windows, entry at the next close.

| Profile | Sharpe, always invest | Sharpe, Horizon | Sharpe, same exposure | Max drawdown, Horizon | Max drawdown, same exposure | Placebo |
|---|---|---|---|---|---|---|
| Conservative | 0.98 | **1.08** | 0.98 | **-7.9%** | -12.4% | 6% |
| Moderate | 0.98 | 0.97 | 0.98 | -14.5% | -19.6% | 51% |
| Aggressive | 0.98 | 0.83 | 0.98 | -20.8% | -21.9% | 100% |

- **Same exposure** invests Horizon's average fraction every time. Beating it shows skill, not just less risk.
- **Placebo** is the share of random timings, with the same exposure, that match or beat Horizon. Lower is better.

What we learned:
- **Conservative sizing has real skill.** Higher Sharpe, a third of the drawdown, and only 6% of random timings match it.
- **Moderate and aggressive mostly invest less.** Their lower drawdown comes from lower exposure.
- **The choice between settings is fragile.** Adding 2 assets changed the winner. With 6 settings, the best one shows a Sharpe near 0.57 from luck alone.

### Our model

[TODO: XGBoost model by Felipe and Brisma. Results from `--modelo model` go here, next to the baseline.]

## Limitations

- Cash earns 0%. No trading costs.
- The 21 assets were picked in 2026: survivorship bias.
- The rate-decision calendar starts in October 2026, so it is not in the backtest.
- The test has 57 portfolio windows. That is too few to separate small Sharpe gaps from noise.

## How to run

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m data.fetch SPY BTCUSDT WALMEX.MX   # download and cache prices
uvicorn api.main:app --port 8000             # API

cd app && npm ci && npm run dev              # web app on http://localhost:5173
```

Tests: `python -m pytest -q tests` (no internet needed).

## Repo map

| Folder | What |
|---|---|
| `data/` | Prices from Yahoo and Binance, with a local cache |
| `model/` | The team's prediction model |
| `decision/` | Decision rule, plan builder, backtest, calibration, forecast evaluation |
| `api/` | FastAPI server: `/api/assets`, `/api/prices`, `/api/decide`, `/api/plan` |
| `app/` | React web app |

## Team

Brisma, Carlos, Felipe Damian and Rocco. MSc AI & Data Science, University of Hull.
