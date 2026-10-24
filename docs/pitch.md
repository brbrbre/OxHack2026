# Pitch (2 min 30 s)

Presenters: Brisma and Rocco. Demo on the phone and on the laptop at the same time.
Lines in [brackets] are actions, not words.

## 1. The problem (20 s) - Rocco

Everyone asks the same question before investing: is now a good time?
Most apps answer with a chart. A chart is not a decision.
Horizon gives you a decision, and the amount to invest today.

## 2. Demo, one asset (40 s) - Brisma

[Pick Bitcoin, $1,000, 30 days, moderate. Press Get my answer.]

Horizon says: invest about $555 now, not $1,000.
Why? In a bad month, Bitcoin can drop 18%.
A moderate profile accepts 10%. So it sizes the amount to fit.
[Point at the cone on the chart.] This band is the forecast: where the price can be in 30 days.

## 3. Demo, help me choose (30 s) - Brisma

[Switch to Help me choose. $5,000, 90 days, moderate, ETFs, US stocks and crypto.]

For people who don't know what to buy.
Horizon builds a plan with up to five assets, and skips two funds that track the same index.
It also tells you what to wait on, and why.

## 4. Does it work? (40 s) - Rocco

We tested it the way a quant would.
Our model, by Brisma, uses momentum and topology of recent returns.
We trained it on data up to 2021, and tested it on 2022 to today.

Its 90% range caught exactly 90% of outcomes.
It is the only one of our three models that beats the naive chance of loss.

Horizon beat buy-and-hold at the same exposure, in all three profiles.
Moderate: Sharpe 1.17 against 0.98. Maximum drawdown 17% against 24%.

Then we asked where the gain comes from.
Most of it is sizing: less money in crypto, more in broad funds.
Timing adds 0.08 of Sharpe. Only 1% of random timings match it.

## 5. Close (20 s) - Rocco

Horizon does not tell you what will happen.
It tells you how much you can afford to bet on it.
Everything we showed runs from one command in our repo.

## Questions the judges may ask

- **Did you look at the test set?** No. Settings were chosen on 2016-2021. We report all 6, and that adding 2 assets changed the winner.
- **Why size instead of time?** We measured both. Sizing explains most of the gain. Timing adds +0.07 to +0.08 Sharpe; 1-3% of random timings match it.
- **Did the model see the test years?** No. For the test we retrained it with data up to November 2021. The app uses the version trained on all history.
- **What is TDA?** Persistent homology of the last 63 returns. It tells orderly moves from erratic ones; the trend predicts better when moves are orderly.
- **Does the model see the future?** No. It only gets prices up to the decision date, and entry is at the next close. A test fails if the model reads data on its own.
- **Costs?** Not included. Cash earns 0%. Both are listed as limits.
