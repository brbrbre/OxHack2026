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
Six rule settings, fixed in advance. Chosen on 2016 to 2021. Tested on 2022 to today.

For a conservative investor, Horizon beat buying and holding with the same exposure.
Sharpe 1.08 against 0.98. Maximum drawdown 8% against 12%.
Only 6% of random timings matched it.

And we are honest about the rest.
The baseline predicts risk well: 92% of outcomes landed inside its 90% range.
It does not predict direction.
That is the job of our XGBoost model. [TODO: one line with its result.]

## 5. Close (20 s) - Rocco

Horizon does not tell you what will happen.
It tells you how much you can afford to bet on it.
Everything we showed runs from one command in our repo.

## Questions the judges may ask

- **Did you look at the test set?** No. Settings were chosen on 2016-2021. We report all 6, and that adding 2 assets changed the winner.
- **Why size instead of time?** Timing rarely beats investing now. Sizing cuts drawdowns. We measured both.
- **Does the model see the future?** No. It only gets prices up to the decision date, and entry is at the next close. A test fails if the model reads data on its own.
- **Costs?** Not included. Cash earns 0%. Both are listed as limits.
