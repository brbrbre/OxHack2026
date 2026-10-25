# Pitch (about 4 min, 15 slides)

Presenters: Rocco and Brisma. Live demo at https://95.179.232.47.sslip.io on the laptop (projector) and on Rocco's phone.
Lines in [brackets] are actions, not words. Every outside figure has its source in `docs/pitch-sources.md`.

Before going on stage:
- Open the planner on the laptop. Horizon needs no account.
- Keep Rocco's phone unlocked, with sound on, next to the laptop.
- Check that https://95.179.232.47.sslip.io loads on the venue Wi-Fi.

## 1. Title (10 s) - Rocco

Raise your hand if you have ever asked: "Is now a good time to invest?"
We are Rocco, Brisma, Carlos and Felipe Damian. This is Horizon.
A prediction is a number. A decision is an action. Horizon goes from data, to prediction, to decision.

## 2. The problem: most people do nothing (20 s) - Rocco

61% of UK adults with £10,000 or more to invest keep three quarters of it in cash. (FCA, 2025)
In Mexico, 76.5% of adults have a bank product. Only 3.4% hold a term deposit or a fund. (INEGI, 2024)

## 3. The problem: or they follow strangers (25 s) - Rocco

Finfluencer followers scored 42% on an investing quiz, yet 63% rated their own knowledge as high. (FINRA Foundation, 2026)
Only 9% of UK adults got regulated advice last year. (FCA, 2025)
And acting on impulse costs money.
In a study of 66,465 US households, the most active traders earned 11.4% a year. The market earned 17.9%. (Barber and Odean, 2000)

## 4. Meet Ana (15 s) - Brisma

Ana has $1,000 and a 30-day horizon. Should she buy Bitcoin today?
Horizon gives her three things: how much to invest today, why, and a nudge to come back.
The answer is always Invest, Wait or Not now.

## 5. The idea: data, prediction, decision (15 s) - Brisma

Data: 21 assets and central bank calendars. The model only sees the past.
Prediction: a distribution, not a number. Expected return, volatility, chance of loss and a 90% range.
Decision: how much, why, and a nudge, sized to your risk profile.
That is the HRT challenge: the best use of data for predictions and decision making.

## 6. Live demo (40 s) - Brisma

[On the laptop: "I'll fill it in". Bitcoin, $1,000, 30 days, Moderate. Get my answer.]

[Read the headline aloud.] Horizon tells Ana how much to invest today, not all of it.
In a bad month, Bitcoin can fall more than a moderate profile accepts. So Horizon sizes the amount to fit.
[Point at the chart.] This cone is the forecast: where the price can be in 30 days, 90% of the time.
[Press Listen.] Gemini writes this summary from our numbers. ElevenLabs reads it. Neither can change a number.

[Switch to Help me choose. $5,000, ETFs, US stocks and Crypto. Build my plan.]
For people who don't know what to buy: a plan of up to five assets, and what stays on hold, and why.

## 7. Data: only the past (15 s) - Brisma

21 assets from the US, the UK and Mexico: stocks, ETFs, indices, currencies and crypto.
Prices come from Yahoo Finance and Binance, back to 1993, plus Fed, ECB and Bank of England rate decisions.
Our golden rule: the model only sees prices up to the decision date. A test fails if it reads data on its own.

## 8. Prediction: trend, plus the shape of the market (30 s) - Brisma

Signal one is momentum over one, three, six and twelve months.
Signal two is topological data analysis.
We take the last 63 daily returns and turn them into a cloud of points in 3D, a Takens embedding.
Persistent homology tracks how those points connect. We compare its size with its own one-year median.
That gives a disorder index.
The model learns a negative weight for trend times disorder.
When the market moves in disorder, trend counts for less.

## 9. An honest test (25 s) - Brisma

We trained only up to November 2021, and tested on 2022 to today: 1,218 windows.
Trend + TDA's 90% range caught exactly 90% of real outcomes.
It is the only one of our three models that beats the naive chance of loss, and it ranks returns the right way.
The gains are small. The value is a well-calibrated range, not a lucky guess.

## 10. Decision: size it, don't time it (20 s) - Rocco

Horizon invests the budget times tolerance over the bad case, capped at all of it.
The bad case is the 5th percentile of the forecast. Tolerance is 5%, 10% or 20%, by profile.
If the model expects a loss, the answer is Not now.
Why sizing and not timing? A lump sum beat phasing in 68% of the time. (Vanguard, 2023)

## 11. Do the decisions pay? (20 s) - Rocco

Against investing the same average share every time, moderate Sharpe was 1.17 against 0.98.
The worst fall was 16.5% against 24.0%.
Most of that gain comes from sizing. Timing adds +0.08, and only 1% of random timings match it.

## 12. TIME: the habit (30 s) - Rocco

Investing works when it becomes a habit.
Reminders that named the saver's own goal raised savings by 16%. (Karlan et al., 2016)

[Open Make it a habit. Enter Rocco's number, agree, press the demo button.]
When Ana's horizon ends, Horizon sends a WhatsApp with that day's answer and a link back to her plan.
[Phone buzzes. Do not open the link.] If she doesn't open it, Horizon calls her.
[About two minutes later the phone rings. Answer it on speaker for three seconds.]
That voice is ElevenLabs. The panel shows what Twilio reports: delivered, answered or missed.

## 13. Built with (15 s) - Rocco

FastAPI and React, live on Vultr in London.
Gemini writes the summary, the tutor answers and the reminder. ElevenLabs speaks. Twilio delivers.
Tiger Data stores every prediction, so we can grade it once its horizon ends.
Five languages, and amounts in your own currency.

## 14. Limits and what's next (15 s) - Brisma

Limits: no trading costs, cash earns 0%, survivorship bias, and only 57 test windows. Treat results as preliminary.
Next: add costs and taxes, a WhatsApp template approved by Meta so anyone can get reminders, and a public scoreboard of graded predictions.

## 15. Close (10 s) - Rocco

Horizon doesn't tell you what will happen.
It tells you how much you can afford to bet on it, and reminds you to come back.
Scan the code to try it. Horizon is an educational prototype, not financial advice.

## Questions the judges may ask

- **Is this financial advice?** No. Horizon is an educational prototype. A rule computes the amount; Gemini only explains it.
- **Did the model see the test years?** No. For the test we retrained it on data up to November 2021. The app uses the version trained on all history.
- **The −0.387 weight: which model?** The app's model, trained on all history. The model we tested, trained to 2021, has −0.25. Both are negative.
- **Did you pick settings on the test set?** No. Six settings were fixed in advance and chosen on 2016-2021. We report all six.
- **Why size instead of time?** We measured both. Sizing explains most of the gain. Timing adds +0.07 to +0.08 Sharpe, and only 1-3% of random timings match it.
- **Is the gain significant?** For moderate and aggressive, the bootstrap 90% interval excludes zero. For conservative it does not. 57 test windows is a small sample.
- **Does Horizon earn more than always investing everything?** No. Over the 57 test windows, its returns added up to 55%, against 80% for always investing everything. It earns less in good years and falls less in bad ones.
- **Why TDA?** It tells orderly moves from erratic ones. Trend predicts better when moves are orderly. The idea follows Gidea and Katz (2018), who used it on market crashes.
- **Does the call work better than a text?** We don't know yet. No trial compares the two. Reminders that name the saver's goal do have trials behind them.
- **Can anyone get the reminder?** Not yet. The demo writes only to the team through the Twilio sandbox. In production, the first WhatsApp needs a template approved by Meta.
- **Why WhatsApp?** 90% of UK adults use it. (Ofcom, 2025) In Mexico it is where people already talk.
- **What do Gemini and ElevenLabs see?** Only the numbers on screen. They write and speak; they never decide.
