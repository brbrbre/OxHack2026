# Horizon web app

The web app uses React, TypeScript, Vite and Recharts. README.md contains the team's quick-start instructions; this guide covers the frontend setup, data sources and checks in more detail.

## Run on Windows

From the repository's app directory:

~~~powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
~~~

Copy the environment example only during first-time setup, or edit an existing .env. The local URL is http://localhost:5173. Vite listens on the local network as well, so a phone on the same Wi-Fi can use the Network URL printed in the terminal (subject to Windows firewall permissions).

## Mock mode and the real API

The only data-source switch is VITE_USE_MOCKS in app/.env:

- true: synthetic prices and preset responses from src/mocks/. No Python or API server is needed.
- false: requests go to /api/assets, /api/prices/{encoded symbol}?dias=365, /api/decide and /api/plan.

Restart Vite after changing the environment variable. In real mode, Vite proxies /api to http://localhost:8000 and keeps the /api prefix. Components do not change. There is deliberately no automatic fallback to fake data if the real API fails.

For real data, set VITE_USE_MOCKS=false and start the Python API in a separate terminal from the repository root:

~~~powershell
.\.venv\Scripts\python.exe -m uvicorn api.main:app --reload --port 8000
~~~

Keep both terminals running and open the React app at http://localhost:5173. The API documentation is available at http://localhost:8000/docs. The API's model label identifies whether it used the baseline or the team's prediction model; live decisions can differ from the preset mock scenarios.

For a single-server deployment, set VITE_USE_MOCKS=false before running npm.cmd run build. Start the Python API after the build: when app/dist exists at startup, FastAPI also serves the compiled frontend at /. The development proxy is not part of a production build; /api stays on that same Python server. A separate frontend host would need a same-origin reverse proxy for /api.

## Contract and sample scenarios

API types retain the team's Spanish field names and enum values. UI labels are English; reasons, recommendations, event text, asset names and the notice are displayed as returned by the API.

The current contract is api/README.md on main (reviewed at commit 7083e6d, including the investment plan and UK catalogue additions). API copy, catalogue names and catalogue groups arrive in English and are not translated by components. Decision and risk-profile display labels are centralized in src/lib/labels.ts; wire codes remain unchanged.

The seven catalogue groups contain 21 assets, including VOD.L (Vodafone), HSBA.L (HSBC) and SHEL.L (Shell) in UK stocks. Try these presets with the form:

| Asset | Sample decision |
| --- | --- |
| SPY | INVERTIR / INVEST |
| BTCUSDT | ESPERAR / WAIT — upcoming Fed event |
| ETHUSDT | ESPERAR / WAIT — risk exceeds the example moderate tolerance |
| NVDA | NO_POR_AHORA / NOT NOW |

Other sample assets reuse the illustrative INVEST response. Mocks echo the submitted amount, horizon and risk profile; monetary examples scale with the amount. The ETHUSDT risk example uses a loss of $220 (-22.0%) on $1,000 and the supplied 10% moderate tolerance; it suggests $455 instead. For other profiles it asks the user to review the risk without inventing a tolerance. These fixtures are not a financial model. Sample histories are deterministic, ending on 24 October 2026 (or the preceding weekday for non-crypto assets).

Decision numbers include fraccion (0 to 1), monto_sugerido (the submitted amount times that fraction), and tendencia_12m (a historical return or null when unavailable). The examples cover full investment, partial investment, no investment, positive and negative trends, a zero trend, and missing history. Monetary worst/best cases still refer to the full submitted amount, not the suggested amount.

POST /api/plan accepts monto, plazo_dias, perfil and tipos (one or more exact group names from /api/assets). Its typed client and mock are ready; the Help me choose interface belongs to the later UI block and is not shown yet. src/mocks/plan.ts exports a sample for $5,000, 90 days, moderate risk, ETFs + US stocks + Crypto, plus an all-cash fixture. Generated examples preserve the requested amount, horizon, profile and groups. Every selected asset appears once in invertir, esperar or no_por_ahora, with its reason; the sample portfolio contains up to five of the investable assets, each at most 40% of the budget, and the remainder stays in efectivo. Holding amounts and cash add up to the original budget. These examples illustrate the response contract only; the frontend does not reproduce the Python portfolio algorithm. Unknown group names return HTTP 400 with the API's Unknown asset types: ... text.

The API does not include monetary or quote-currency metadata. The form and decision amounts currently use dollars to match the supplied contract; the chart labels its values as the asset's quote currency rather than assuming every price is in dollars.

## Checks

~~~powershell
npm.cmd run test
npm.cmd run build
~~~

Contract tests cover all three decisions, the new sizing/trend fields, 21 assets, the plan response and all-cash case, budget/weight consistency, selected-group coverage, HTTP errors, malformed payloads, exact request bodies, cancellation and timeouts.

## Files and Git

Everything for this frontend lives in app/. The local .gitignore excludes node_modules/, dist/, local environment files and generated test/build files. Commit .env.example and package-lock.json, not .env or node_modules/.

No Python code is imported or executed by this app. The team owns the Python API and its implementation.
