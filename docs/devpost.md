# Devpost submission (draft)

Paste each section into its Devpost field. In the form's prize step, tick these five, with the names Devpost uses:

- [HRT] Best Use of Data for Predictions and Decision Making
- [MLH] Best Use of Gemini API
- [MLH] Best Use of ElevenLabs
- [MLH] Best Use of Tiger Data
- [MLH] Best Use of Vultr

First Place and Runner Up are general prizes. Ask at the 9:00 workshop if they need a tick too.

## Name

Horizon

## Tagline

Invest now, wait, or not yet. Horizon sizes your investment to the loss you can accept.

## Inspiration

Before investing, everyone asks: is now a good time? Apps answer with charts. We wanted an answer: how much to put in today, and why.

## What it does

You pick an asset, an amount and how long you will hold it. Horizon predicts the return, its range and the chance of a loss. It then tells you how much to invest today, so a bad month stays within your risk profile.

If you don't know what to buy, "Help me choose" builds a plan of up to five assets. It also lists what to wait on, and why.

Gemini sums up each answer, and ElevenLabs reads it aloud. "Ask Horizon" explains money terms in plain words.

"Make it a habit" checks in when your horizon ends, for one asset or a whole plan. You get a WhatsApp with that day's answer and a link to your plan. If you don't open it, Horizon calls you. In the demo this reaches only the team's numbers.

The app has a landing page, a guided setup, five languages and local currencies.

## How we built it

- Data: Yahoo Finance and Binance, 21 assets, history back to 1993.
- Model: trend + topology (TDA) by Brisma, with an XGBoost backup and a simple baseline. All only see prices up to the decision date.
- Gemini: writes a short summary, answers money questions and drafts the reminder. It never changes the numbers.
- ElevenLabs: reads the summary aloud and voices the reminder call.
- Twilio: sends the WhatsApp (sandbox) and places the call. The panel shows the real status Twilio reports.
- Tiger Data: stores daily prices and every prediction. One command grades them once their horizon ends.
- Vultr: hosts the live demo in London.
- Decision rule: invest `min(1, tolerance / |bad case|)` of the amount. Not now if a loss is expected. Half now if a rate decision is 3 days away.
- Backtest: 30-day windows, entry at the next close, one date grid for all assets.
- Calibration: 6 settings fixed in advance, chosen on 2016-2021, tested on 2022-today. Block bootstrap and a placebo of random timings.
- Stack: Python, pandas, NumPy, XGBoost, FastAPI, React, Recharts.

## Challenges we ran into

Our first rule waited too much. It sat in cash 84% of the time and lost to always investing. Research showed timing rarely works and sizing does, so we rebuilt the rule around sizing.

We also caught a bug in our own backtest. It mixed crypto and stock dates and showed a gain in the 2022 crash. A test now guards that.

Our first reminder panel said "we called you" when the line was busy. Twilio had only accepted the call. Now the panel asks Twilio what really happened.

## Accomplishments that we're proud of

Out of sample, Horizon beat buy-and-hold at the same exposure in all three profiles. Moderate Sharpe was 1.17 against 0.98. Drawdown was 16.5% against 24.0%. To keep it honest, the test model was trained on data up to 2021 only.

We also checked where that gain comes from. Most of it is sizing: less money in volatile assets. Timing adds +0.07 to +0.08 Sharpe, and only 1-3% of random timings match it.

## What we learned

A model can look great until you check what it was trained on. Our TDA model's saved weights covered 2022-2026, so we retrained it up to 2021 before testing. Its 90% range then caught exactly 90% of outcomes.

A placebo can fool you too. Our first placebo only shuffled the portfolio's total exposure. Shuffling within each asset showed our baseline's "skill" was sizing, not timing.

## What's next

Cash earning the T-bill rate, trading costs, and more assets to reduce survivorship bias. For the habit: a WhatsApp template approved by Meta, so reminders can reach anyone.

## Built with

python, pandas, numpy, xgboost, fastapi, react, typescript, recharts, yfinance, binance-api, gemini, elevenlabs, twilio, tiger-data, timescaledb, vultr

## Links

- GitHub: https://github.com/brbrbre/OxHack2026
- Live demo: https://95.179.232.47.sslip.io
