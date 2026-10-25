# decision/ - decision rule, backtest and calibration

Turns the model's forecast into **Invest**, **Wait** or **Not now** (`INVERTIR`, `ESPERAR`, `NO_POR_AHORA`), and above all into **how much** to invest today.
The rules are fixed and explainable. No LLM is involved: Gemini only rewrites what comes out of here.

## How to use it

```python
from decision.rules import decide
from decision.signals import tendencia

r = decide(pred, monto=1000, plazo_dias=30, simbolo="SPY", perfil="moderado",
           tendencia=tendencia(precios))
r["decision"]                    # "INVERTIR" | "ESPERAR" | "NO_POR_AHORA"
r["numeros"]["fraccion"]         # 0 to 1: share of the amount to invest today
r["numeros"]["monto_sugerido"]   # fraccion * monto
r["razones"], r["recomendaciones"]
```

`decision/plan.py` builds the "Help me choose" plan from the same rule, asset by asset.

## The rule

1. **Expectation filter:** if the model expects a loss (expected return ≤ 0 or chance of loss ≥ 50%), the share is 0 and the answer is **Not now**.
2. **Size by risk:** `share = min(1, tolerance / |bad case|)`. The bad case is the low end of the 90% interval, the 5th percentile. The person picks the tolerance: 5%, 10% or 20% (conservative, moderate, aggressive).
3. **Trend brake** (off after calibration): if the price is below its level 12 months ago, it would scale the share down.
4. **Event brake:** if the Fed or the Bank of England decides rates within 3 days, the share is halved and the rest is suggested for after the decision.
5. **Label:** share 0 → Not now; ≥ 0.5 → Invest; in between → Wait (with the small amount suggested).

**Why this design.** Our first version blocked instead of sizing, and in the backtest it sat in cash 84% of the time. The team's research found three things:
- A lump sum beats phasing in 68% of the time (Vanguard, 1976-2022).
- Almost no predictor beats the historical mean out of sample (Goyal and Welch 2008).
- Sizing by volatility makes extreme losses less severe (Harvey et al. 2018).

So the rule invests by default, and risk decides **how much**.

## Backtest (`backtest.py`)

At each date the model only sees prices up to that day, and entry is at the **next** day's close. Windows don't overlap and use one date grid for every asset, so crypto (traded daily) and stocks (weekdays) line up. Money not invested stays in cash at 0%.

Two yardsticks:
- **Always invest**: the full amount in every window.
- **Same exposure**: always invest the app's average share. If the app can't beat this, its value is in sizing, not timing.

```bash
python -m decision.backtest --todos --desde 2022-01-01
```

## Calibration (`calibrate.py`)

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.calibrate --modelo model --perfil moderado
```

Protocol:
- 6 fixed settings: expectation filter on/off × trend brake 1, 0.5 or 0.
- One set for all 21 assets.
- Chosen on 2016-2021, tested on 2022 to today, year by year.
- Walk-forward from 2019.
- Block bootstrap, and two placebos: random timings with the same exposure, and dates shuffled within each asset.
- `params_tda_hasta_2021.json` is the Trend + TDA model trained only up to November 2021, so the test years are out of sample.

Result for **Trend + TDA**, moderate profile, re-run on 25 October 2026. Equal-weight portfolio of 21 assets, 57 windows of 30 days, test 2022 to today:

| | Always invest | Horizon | Same exposure |
|---|---|---|---|
| Sharpe ratio | 0.98 | **1.17** | 0.98 |
| Sum of window returns | 79.9% | 54.9% | 66.9% |
| Maximum drawdown | -28.6% | **-16.5%** | -24.0% |

- Horizon minus same exposure: +0.19 Sharpe, bootstrap 90% interval +0.01 to +0.38.
- Sizing or timing? Horizon 1.17 against each asset at its own average share 1.09: timing adds +0.08. Only 1% of dates shuffled within each asset match it.
- Walk-forward 2019 to today: Horizon 1.13, always invest 1.16; maximum drawdown -17.0% against -28.6%.
- Horizon earns less in good years and falls less in bad ones. It does not earn more than always investing everything.

All three profiles and all three models are in the root `README.md`.

What the numbers say:
- **Most of the gain is sizing:** less money in crypto, more in broad index funds.
- **Trend + TDA times better than chance, a little.** The baseline's timing hurts in every profile.
- **The choice between settings is fragile.** In training, Trend + TDA scores 1.12 with the filter on and 1.12 with it off. The app keeps the filter on.
- **The trend brake did not improve training** in any profile. It stays off.

## Forecast evaluation (`evaluate_forecasts.py`)

Checks whether the forecasts tell the truth, separately from whether they made money.

```bash
TDA_PARAMS=model/params_tda_hasta_2021.json python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model
python -m decision.evaluate_forecasts --desde 2022-01-01   # baseline, for comparison
```

Result for Trend + TDA, re-run on 25 October 2026: 1,218 windows of 30 days, 21 assets, 2022 to today.

| Check | Target | Baseline | Trend + TDA |
|---|---|---|---|
| Real return inside the 90% interval | 90% | 92% | **90%** |
| Real return below the low end | 5% | 4% | **4%** |
| Brier score of chance of loss (lower is better) | below naive 0.246 | 0.252 | **0.245** |
| Rank correlation, expected vs real | above 0 | -0.06 | **+0.06** |

- **The interval is on target.** How much the app invests depends on its low end, so this is what matters most.
- **Fat tails show in crypto:** Solana and Ethereum fall below the low end about 10% of the time, not 5%.
- **Direction is barely predictable.** Trend + TDA is the only model that beats the naive loss rate, and the gain is small.

Defaults in `rules.py`: expectation filter on, trend brake off, event brake 0.5.

Limitations:
- Cash earns 0% and there are no trading costs.
- The 21 assets were picked in 2026 (survivorship bias).
- The central bank calendar starts in October 2026, so the event brake is not in the backtest.
- The test has 57 portfolio windows: too few to separate small Sharpe gaps from noise.
