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
Two models feed the same rule. The **baseline** uses 3-year mean and volatility. **XGBoost** (`model/predict.py`) is by Felipe and Brisma.

### Does the forecast tell the truth?

```bash
python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo baseline
python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
```

1,218 windows of 30 days, 21 assets, 2022 to today:

| Check | Target | Baseline | XGBoost |
|---|---|---|---|
| Real return inside the 90% interval | 90% | 92% | 94% |
| Real return below the 5th percentile | 5% | 4% | 3% |
| Brier score of chance of loss (lower is better) | below naive 0.246 | 0.252 | 0.250 |
| Rank correlation, expected vs real | above 0 | -0.06 | +0.02 |

**Both models predict risk well and direction badly.** XGBoost is better on every line. It still does not beat the naive loss rate, and its rank correlation is close to zero.

### Does following Horizon pay?

```bash
python -m decision.calibrate --modelo model --perfil conservador
```

Protocol: 6 rule settings fixed in advance, one set for all assets. Chosen on 2016-2021, tested on 2022 to today. Equal-weight portfolio of 21 assets, 57 windows of 30 days, entry at the next close.

Sharpe ratio on the test period. Buying and holding every asset got 0.98.

| Profile | Horizon, baseline | Horizon, XGBoost | Same exposure | Max drawdown, XGBoost | Max drawdown, same exposure |
|---|---|---|---|---|---|
| Conservative | 1.08 | **1.15** | 0.98 | **-9.2%** | -15.2% |
| Moderate | 0.97 | **1.14** | 0.98 | **-15.9%** | -23.6% |
| Aggressive | 0.83 | **1.09** | 0.98 | **-21.2%** | -26.7% |

**Same exposure** invests Horizon's average fraction in every asset, every time.

### Where does the gain come from?

A gain over "same exposure" can come from two places. **Sizing:** less money in volatile assets like crypto. **Timing:** investing more before good months. To split them, we give each asset its own average fraction and keep it fixed.

| Profile | XGBoost, Horizon | XGBoost, fixed size per asset | Timing gain | Baseline timing gain |
|---|---|---|---|---|
| Conservative | 1.15 | 1.12 | +0.03 | -0.09 |
| Moderate | 1.14 | 1.12 | +0.02 | -0.17 |
| Aggressive | 1.09 | 1.07 | +0.02 | -0.27 |

What we learned:
- **Most of the gain is sizing.** Horizon puts less in crypto and more in broad index funds.
- **XGBoost timing helps a little.** 3% to 7% of random timings within each asset match it. The gain is small: +0.02 to +0.03.
- **Baseline timing hurts.** Fixed sizing beats it in all three profiles.
- **Re-chosen each January since 2019, Horizon trails buy-and-hold.** XGBoost Sharpe is 1.04 to 1.06, against 1.20. Drawdown is lower: -15.9% against -28.6% (moderate).
- **The choice between settings is fragile.** Adding 2 assets changed the winner for the baseline.

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
