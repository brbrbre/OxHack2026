# OxHack 2026 - [project name]

OxHack 26, Oxford, 24-25 October 2026. Theme: **TIME**.
Challenge: HRT "Best Use of Data for Predictions and Decision Making".

## Problem

People want to invest, but they do not know when.
They pick an asset, a date and an amount. Should they invest now, wait, or not invest yet?

## What it does

1. The user picks an asset (stock, ETF, index or crypto), when, and how much.
2. A model we wrote by hand (NumPy and pandas only) predicts return and risk for that horizon.
3. A decision rule answers **INVEST**, **WAIT** or **NOT NOW**, with the reasons.

This is an educational prototype. It is not financial advice.

## Data

- Stocks, ETFs, indices and FX: Yahoo Finance via `yfinance`.
- Crypto: Binance public market data.
- Rates and events: FRED, Bank of England, ECB.

## Method

[TODO: model, features, validation]

Validation respects time order: train on the past, test on the future.
We compare against simple baselines (zero return, historical mean, historical volatility).

## Results

[TODO: real metrics, with the command that produced them]

## How to run

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # add your keys
uvicorn api.main:app --port 8000 # API

cd app && npm install && npm run dev   # web app on http://localhost:5173
```

## Team

Brisma, Carlos, Felipe Damian and Rocco - MSc AI & Data Science, University of Hull.
