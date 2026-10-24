# Devpost submission (draft)

Paste each section into its Devpost field. Prizes to tick: HRT "Best Use of Data for Predictions and Decision Making". [TODO: confirm at the 9:00 Devpost workshop how to opt into each prize.]

## Name

Horizon

## Tagline

Invest now, wait, or not yet. Horizon sizes your investment to the loss you can accept.

## Inspiration

Before investing, everyone asks: is now a good time? Apps answer with charts. We wanted an answer: how much to put in today, and why.

## What it does

You pick an asset, an amount and how long you will hold it. Horizon predicts the return, its range and the chance of a loss. It then tells you how much to invest today, so a bad month stays within your risk profile.

If you don't know what to buy, "Help me choose" builds a plan of up to five assets. It also lists what to wait on, and why.

## How we built it

- Data: Yahoo Finance and Binance, 21 assets, history back to 1993.
- Model: a baseline (3-year mean and volatility) and an XGBoost quantile model. Both only see prices up to the decision date.
- Decision rule: invest `min(1, tolerance / |bad case|)` of the amount. Not now if a loss is expected. Half now if a rate decision is 3 days away.
- Backtest: 30-day windows, entry at the next close, one date grid for all assets.
- Calibration: 6 settings fixed in advance, chosen on 2016-2021, tested on 2022-today. Block bootstrap and a placebo of random timings.
- Stack: Python, pandas, NumPy, XGBoost, FastAPI, React, Recharts.

## Challenges we ran into

Our first rule waited too much. It sat in cash 84% of the time and lost to always investing. Research showed timing rarely works and sizing does, so we rebuilt the rule around sizing.

We also caught a bug in our own backtest. It mixed crypto and stock dates and showed a gain in the 2022 crash. A test now guards that.

## Accomplishments that we're proud of

Out of sample, conservative Horizon beat buy-and-hold at the same exposure. Sharpe was 1.08 against 0.98. Drawdown was 7.9% against 12.4%. Only 6% of random timings matched it.

## What we learned

A forecast can be good at risk and useless at direction. Ours put 92% of outcomes inside its 90% range, but could not rank winners. Measuring both kept us honest.

## What's next

Cash earning the T-bill rate, trading costs, and more assets to reduce survivorship bias.

## Built with

python, pandas, numpy, xgboost, fastapi, react, typescript, recharts, yfinance, binance-api

## Links

- GitHub: https://github.com/brbrbre/OxHack2026
- [TODO: live demo URL if deployed]
