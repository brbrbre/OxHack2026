# Pitch (3 min 30 s)

Presenters: Rocco and Brisma. Live demo at https://95.179.232.47.sslip.io on the laptop (projector) and on Rocco's phone.
Lines in [brackets] are actions, not words. Every outside figure has its source in `docs/pitch-sources.md`.

Before going on stage:
- Open the planner on the laptop. Horizon needs no account.
- Keep Rocco's phone unlocked, with sound on, next to the laptop.
- Check that https://95.179.232.47.sslip.io loads on the venue Wi-Fi.

## 1. The problem (35 s) - Rocco

Raise your hand if you have ever asked: "Is now a good time to invest?"
Most people never get a straight answer, so they do one of two things.

They do nothing.
61% of UK adults with £10,000 or more to invest keep three quarters of it in cash. (FCA, 2025)
In Mexico, 76.5% of adults have a bank product. Only 3.4% hold a term deposit or a fund. (INEGI, 2024)

Or they follow a stranger online.
Finfluencer followers scored 42% on an investing quiz, yet 63% rated their own knowledge as high. (FINRA Foundation, 2026)

Advice exists, but only 9% of UK adults got regulated advice last year. (FCA, 2025)
It often costs more than a young person has invested in total.

## 2. Horizon in one line (10 s) - Rocco

Horizon turns "is now a good time?" into a decision you can act on.
How much to invest today, why, and a nudge to come back when your time is up.

## 3. Demo: one asset (45 s) - Brisma

[On the laptop: Explore your plan, "I'll fill it in". S&P 500, $1,000, 90 days, Moderate. Get my answer.]

[Read the headline aloud.] Horizon answers Invest, Wait or Not now, with the amount for today.
Why not all of it? In a bad 90 days, this asset can fall more than a moderate profile accepts.
So Horizon sizes the amount to fit the loss you said you can take.

[Point at the chart.] This cone is the forecast: where the price can be in 90 days, 90% of the time.

[Open In short, press Listen.] Gemini writes this summary from our numbers. ElevenLabs reads it aloud.
Neither of them can change a number.

[Open Ask Horizon, tap a question about "chance of loss".] Ask Horizon is a tutor for money words.

## 4. Demo: help me choose (20 s) - Brisma

[Switch to Help me choose. $5,000, ETFs, US stocks and Crypto. Build my plan.]

For people who don't know what to buy.
Horizon builds a plan of up to five assets, and tells you what to wait on, and why.
It skips a fund that moves like one already in the plan. [Point at "Not in the plan".]
The app runs in five languages and shows amounts in your currency.

## 5. The habit (35 s) - Rocco

Investing works when it becomes a habit.
In bank trials, reminders that named the saver's own goal raised savings by 16%. (Karlan et al., 2016)

[Open Make it a habit. Enter Rocco's number, agree, press the demo button.]
When your horizon ends, Horizon sends a WhatsApp with that day's answer and a link back to your plan.

[Phone buzzes. Show the message. Do not open the link.]
If you don't open it, Horizon calls you.

[About two minutes later the phone rings. Answer it on speaker for three seconds.]
That voice is ElevenLabs. The panel shows what Twilio reports: delivered, answered or missed.

## 6. Under the hood (55 s) - Rocco

Data: 21 assets, from US, UK and Mexican stocks to ETFs, currencies and crypto.
Prices come from Yahoo Finance and Binance, back to 1993.

Model: Trend + TDA, built by Brisma.
It reads momentum over one to twelve months.
It also measures the shape of the last 63 returns with persistent homology, a tool from topology.
XGBoost, built by Felipe, is our backup.

Rule: we don't try to time the market.
A lump sum beat phasing in 68% of the time. (Vanguard, 2023)
So Horizon invests today, and sizes the amount so the bad case fits your profile.

Test: we trained the model only to 2021, and tested it on 2022 to today.
Its 90% range caught 90% of real outcomes, across 1,218 windows.
Against investing the same average share every time, moderate Sharpe was 1.17 against 0.98.
The worst fall was 16.5% against 24.0%.
Most of that gain comes from sizing, not from timing.

Stack: FastAPI and React, live on Vultr in London.
Tiger Data stores every prediction, so we can grade it once its horizon ends.

## 7. Close (15 s) - Rocco

Horizon doesn't tell you what will happen.
It tells you how much you can afford to bet on it, and reminds you to come back.
Horizon is an educational prototype, not financial advice.

## Questions the judges may ask

- **Is this financial advice?** No. Horizon is an educational prototype. A rule computes the amount; Gemini only explains it.
- **Did the model see the test years?** No. For the test we retrained it on data up to November 2021. The app uses the version trained on all history.
- **Did you pick settings on the test set?** No. Six settings were fixed in advance and chosen on 2016-2021. We report all six.
- **Why size instead of time?** We measured both. Sizing explains most of the gain. Timing adds +0.07 to +0.08 Sharpe, and only 1-3% of random timings match it.
- **Is the gain significant?** For moderate and aggressive, the bootstrap 90% interval excludes zero. For conservative it does not. 57 test windows is a small sample.
- **What is TDA?** Persistent homology of the last 63 returns. It tells orderly moves from erratic ones. The trend predicts better when moves are orderly.
- **Does the call work better than a text?** We don't know yet. No trial compares the two. Reminders that name the saver's goal do have trials behind them.
- **Can anyone get the reminder?** Not yet. The demo writes only to the team through the Twilio sandbox. In production, the first WhatsApp needs a template approved by Meta.
- **Does Horizon earn more than always investing everything?** No. Over the 57 test windows, its returns added up to 55%, against 80% for always investing everything. It earns less in good years and falls less in bad ones.
- **Costs and cash interest?** Not included. Cash earns 0% in the backtest. Both are listed as limits.
- **Why WhatsApp?** 90% of UK adults use it. (Ofcom, 2025) In Mexico it is where people already talk.
- **What do Gemini and ElevenLabs see?** Only the numbers on screen. They write and speak; they never decide.
