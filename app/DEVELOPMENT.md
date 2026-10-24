# Horizon web app

The web app uses React, TypeScript, Vite and Recharts. README.md contains the team's quick-start instructions; this guide covers the frontend setup, data sources and checks in more detail.

## Homepage and planner

The root URL introduces Horizon through an English landing page with section navigation, an interactive example, asset marks, an explanation of the three outcomes, guided/quick setup, a responsive mobile illustration and FAQ. All planner links open ?view=planner without a page reload. This query URL also opens the planner directly after a reload, using the same root path served by Vite or the existing Python static server. The planner's Home link and brand return to the introduction; browser Back and Forward also work.

The planner is loaded only on its first visit. Its mounted state stays hidden when returning home, preserving form values and results while preventing hidden focus effects. Returning to the planner resumes the current plan. The homepage does not need the Python API; its date slider uses deterministic synthetic SPY history, clearly labelled as illustrative, with a sample allocation independent of the selected date. The selected example date, closing price and change from the first example close stay synchronized. It is not live data or a forecast.

The mobile section describes the current responsive website. Its phone mockup is decorative and labelled as illustrative; there is no native app download or store listing. Exact selected-symbol portfolios remain a separate proposal in SELECTED_ASSETS_API_PROPOSAL.md. Budget currencies are available using the dated reference conversion described below; selected-symbol portfolios and a live FX endpoint are still proposals.

Source code is separated by page, within one Vite application:

~~~text
src/RootApp.tsx             Navigation and retained planner state
src/pages/landing/         LandingPage, illustrative demo and landing styles
src/pages/planner/         PlannerPage and planner styles
src/shared/theme.css       Shared tokens, base styles, typography and asset marks
src/components/            Planner forms, results, charts and reusable controls
src/currency/              Currency state, amount control and dated reference rates
src/api/, lib/, mocks/     Shared HTTP contract, calculations and sample responses
~~~

App.tsx re-exports PlannerPage and styles.css imports the shared theme and planner styles for existing isolated previews. Production main.tsx imports the shared theme; each page imports its own styles. Navigation stays at / and /?view=planner, so the existing Python static-server setup needs no new routes or deployment changes.

## Budget currencies

The compact dropdown beside the budget supports USD, MXN, GBP and EUR in both quick and guided setup. The currency is presentation state, separate from the shared draft: changing it preserves the exact canonical USD budget, existing analysis and selected chart day. Editing the amount converts the selected-currency input to USD once and invalidates analysis as before. API requests retain their exact fields and do not add currency metadata.

For this demo, src/currency/referenceRates.ts stores the [European Central Bank reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html) dated **23 October 2026**: 1 EUR = 1.1193 USD = 0.83728 GBP = 21.0226 MXN. All conversion factors are derived from this single snapshot. These are fixed reference rates, not live quotes, transaction rates or a prediction of exchange-rate movements. Non-USD inputs show the approximate USD equivalent and a dated disclosure with the source link. No external FX request is made at runtime, and no new Python endpoint is required.

Structured budgets, suggested amounts, cash, allocations, risk amounts, investment-value charts, tooltips and accessible labels use the selected currency. Returns and allocation weights do not change. Values and projections stay in USD internally and are rounded only for display. Written API reasons, recommendations and summaries remain verbatim; a nearby note identifies their USD amounts. Historical and expected asset quotes keep their original quote units, independently of the budget currency. Changing currency never converts price-history data or generates a new analysis request.

For Rocco: existing /api/decide and /api/plan requests still contain a USD monto. The currency dropdown needs no server change. A later live /api/fx endpoint can replace this snapshot in the currency module while leaving planner components and API decision logic intact. The exact selected-symbol portfolio proposal is separate and is not enabled by these changes.

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

The current contract is api/README.md on main (reviewed through commit 0ac032d, including optional summaries, tutor, audio and reminders). API copy, catalogue names and catalogue groups arrive in English and are not translated by components. Decision and risk-profile display labels are centralized in src/lib/labels.ts; wire codes remain unchanged.

## Summaries, tutor and reminders

The planner connects the team's optional /api/summary/decide and /api/summary/plan routes after a successful decision or portfolio request. Summary loading and failure do not replace the numerical result. Editing the plan cancels stale summary requests. SummaryBlock provides the existing Listen control, using /api/listen when available and browser speech as the fallback. Going home or changing the result stops playback, cancels pending audio and releases its temporary URL.

Ask Horizon uses /api/ask with the original USD result context and the latest four conversation turns. It does not request an answer until the person submits a question or selects a suggestion. Written summary and tutor text remain verbatim; when another budget currency is selected, nearby notes identify their USD amounts. Currency changes do not start a new analysis or conversation.

The single-asset reminder form uses the team's /api/habit routes and requires a number and explicit consent before submission. Its real delivery depends on the server configuration described in api/README.md. Frontend mock mode does not send messages or create reminders. Stale reminder requests and polling are cancelled when their result changes or the panel unmounts; returning home keeps the mounted planner's conversation and reminder state.

Reminder redirects in the existing /r/{token} route use /?simbolo=...&monto=...&plazo=...&perfil=.... A complete valid query opens the planner directly with the quick form prefilled, using the canonical USD amount in the URL. It does not automatically run analysis. Regular visits retain the guided/quick choice. Going home clears the reminder parameters from that new history entry; Back still restores the original link.

Plan candidates retain the API's fuera_del_plan explanation when an eligible asset was left out of the allocated portfolio. The Invest group identifies both candidate count and allocated count when they differ. The frontend does not change selection, weights or the Python allocation algorithm.

The seven catalogue groups contain 21 assets, including VOD.L (Vodafone), HSBA.L (HSBC) and SHEL.L (Shell) in UK stocks. Try these presets with the form:

| Asset | Sample decision |
| --- | --- |
| SPY | INVERTIR / Invest |
| BTCUSDT | ESPERAR / Wait — upcoming Fed event |
| ETHUSDT | ESPERAR / Wait — risk exceeds the example moderate tolerance |
| NVDA | NO_POR_AHORA / Not now |

Other sample assets reuse the illustrative INVEST response. Mocks echo the submitted amount, horizon and risk profile; monetary examples scale with the amount. The ETHUSDT risk example uses a loss of $220 (-22.0%) on $1,000 and the supplied 10% moderate tolerance; it suggests $455 instead. For other profiles it asks the user to review the risk without inventing a tolerance. These fixtures are not a financial model. Sample histories are deterministic, ending on 24 October 2026 (or the preceding weekday for non-crypto assets).

Decision numbers include fraccion (0 to 1), monto_sugerido (the submitted amount times that fraction), and tendencia_12m (a historical return or null when unavailable). The examples cover full investment, partial investment, no investment, positive and negative trends, a zero trend, and missing history. Monetary worst/best cases still refer to the full submitted amount, not the suggested amount.

POST /api/plan accepts monto, plazo_dias, perfil and tipos (one or more exact group names from /api/assets). src/mocks/plan.ts exports a sample for $5,000, 90 days, moderate risk, ETFs + US stocks + Crypto, plus an all-cash fixture. Generated examples preserve the requested amount, horizon, profile and groups. Every selected asset appears once in invertir, esperar or no_por_ahora, with its reason; the sample portfolio contains up to five of the investable assets, each at most 40% of the budget, and the remainder stays in efectivo. Holding amounts and cash add up to the original budget. These examples illustrate the response contract only; the frontend does not reproduce the Python portfolio algorithm. Unknown group names return HTTP 400 with the API's Unknown asset types: ... text.

## Help me choose

The first visit offers Guide me step by step and I’ll fill it in. This chooses a presentation, not a risk profile or financial recommendation. The guided path asks about budget, time and comfort with gains/losses, one question at a time, followed by a review. The quick path opens the expanded, centred form with all fields together. Both share the same draft and exact API values. Switching paths keeps budget, horizon, risk, asset and group choices, and cancels pending analysis. The first guided choice defaults to Help me explore; a later switch preserves an existing investment mode.

Guided Continue and Enter advance the current step; only See my plan on Review sends an analysis request. Back and the progress heading support keyboard use without opening a phone keyboard automatically. Time labels explain the existing day values, and risk descriptions retain Conservative, Moderate and Aggressive as secondary labels. Review makes asset and category selections explicit; category descriptions explain the API group names without changing them. The service errors and retry stay beside Review. Returning to an earlier step clears those errors and cancels any request.

Results and the single-asset chart appear only after the first successful analysis; price history is requested at that point. A failed or cancelled first request keeps the chosen input view. The educational notice remains visible on the entry screen, while filling the plan, and after analysis.

Once results have opened, the quick form stays on the left on desktop, or above results on phones. Editing or switching investment modes clears stale analysis without collapsing back to the opening screen. Edit step by step reopens guidance with the same values; Use the quick form returns to all fields. Run the updated plan to see a new answer. On phones, a successful submission brings the result into view and Edit your plan returns to the inputs. Reloading starts with the two entry choices again.

Asset marks are local SVG files with sources and notices recorded in ASSET_SOURCES.md. The asset picker searches API names and symbols without requiring accents, preserves the API's groups, and supports keyboard selection. Logos also appear beside structured asset names in the result, chart, allocation legend, table and decision lists. Descriptive markers cover assets without a suitable logo; GLD uses an original gold bullion SVG with a gold frame. Names keep the same neutral text styling.

Portfolio segment and legend colors are attached to symbols in src/lib/assetIdentity.ts, with color values in the stylesheet root. They remain stable when the API reorders holdings. Colors identify the asset rather than its decision or performance, and amounts, percentages and names remain available independently of color. Cash keeps a neutral hatched fill. Google and Tesla identities are reserved for possible future API entries; they do not add selectable assets.

The mode selector above the form offers I have an asset in mind and Help me choose. The second mode keeps the same amount, horizon and risk inputs and adds checkboxes sourced from the catalogue's group keys. It submits only monto, plazo_dias, perfil and tipos to /api/plan through the same VITE_USE_MOCKS switch. Asset-type errors appear beside the checkbox group. Other service errors appear in the result with a retry button. Switching modes or editing any input cancels pending analysis and clears stale results.

The portfolio result shows the API's invested amount, holdings and cash in a proportional bar, a legend and a table. Weights refer to the full budget, including cash; the frontend does not allocate or rebalance investments. It displays the risk against the full amount, the three decision lists with their reasons, and the API summary verbatim. An all-cash plan is a valid result. Tiny floating point cash residues are displayed as zero without changing the response. The educational notice stays below the result. The individual price chart and its cone belong to the single-asset mode.

The API does not include monetary or quote-currency metadata. Request and response amounts remain canonical USD; budget and structured result presentation use the chosen display currency. The chart maps symbols to quote units: .MX uses MXN, .L arrives in GBp and is displayed in GBP after dividing by 100, USDT pairs use USDT, and =X symbols show an exchange rate with its direction. Other symbols use USD. Visible prices, tooltips and axis labels share the same quote formatter; source prices are not modified. A negative period change uses a downward arrow.

The educational notice appears below the result in normal document flow. Analysis moves focus to the result heading; the skip link remains available for keyboard navigation. Text is at least 12 px, with body copy at 15–16 px and text contrast of at least 4.5:1 against its background.

## Visual design

The opening form is unboxed and fills the main content area, with larger controls and a three-column risk choice on desktop. It becomes an unboxed sidebar after analysis. The result is the only elevated surface, and the price chart is flat with a dividing line above it. Headings use direct English copy; result and chart metadata use labelled values. The single IBM Plex Sans family is bundled locally in four weights, so fonts do not require an external request at runtime. All numbers use tabular figures.

The palette lives in the stylesheet's root tokens: paper #F7F8F6, surface #FFFFFF, ink #15202B, secondary ink #4A5662, line #DCE1E5 and accent #2346A0. Decision colors identify badges and portfolio decision groups. Those groups use pale green, amber or red surfaces, a side border and a filled badge with a decorative status icon. Asset names stay neutral and allocation segments retain their brand colors. The only animation introduces the suggested amount when a result arrives; prefers-reduced-motion removes it. Loading states use static icons and text. On phones, submitting moves directly to the result without animated scrolling.

## Suggested amount and forecast

The result headline uses the API's monto_sugerido: invest the full budget, invest part now and keep the remainder for later, or keep the whole budget for now. The frontend does not recalculate the allocation. Decision colors are reserved for the decision badge. Reasons and recommendations remain verbatim; the baseline label explains that it uses a 3-year historical average, while other model names are displayed as supplied.

After analysis, the price chart adds a shaded terminal range and a dashed expected-price line. The endpoint is the last closing date plus plazo_dias in calendar days, calculated in UTC; weekends and leap days are counted. The chart uses a numeric time axis so the forecast occupies its actual duration. The terminal values use the original API price and full requested budget: low = last × (1 + peor_caso / monto), high = last × (1 + mejor_caso / monto), expected = last × (1 + rendimiento_esperado). Currency conversion is only for display. The band connects the last close to those terminal estimates; it does not claim daily model predictions. Changing the plan removes the old analysis and cone.

Hovering or tapping a forecast point shows a compact tooltip: calendar date and day, hypothetical gain/loss in the selected budget currency with the expected return beside it, expected price in its native quote unit and a short suggested-investment basis. Intermediate points carry an Approximate estimate label; the exact terminal API estimate does not. A daily slider provides the same information for touch and keyboard use, with a selected point on the chart. The persistent summary prioritises gain/loss and keeps the price secondary, without repeating the full range or method inside the tooltip. A short Intermediate dates are approximate notice remains visible. The closed About this estimate disclosure contains the selected range, final calendar date and explanation of the method. Intermediate ranges say Illustrative price range, while only the endpoint says 90% price range.

Intermediate values follow the same straight line from the last close to the API's final estimate; they are not daily model predictions. USD gains use monto_sugerido × rendimiento_esperado × (day / plazo_dias), independently of the asset's quote currency, and exclude cash returns and exchange-rate changes. When the suggested investment is zero, the chart shows asset estimates without a hypothetical dollar gain. Historical tooltips remain closing prices. A new analysis resets the selected day to its final horizon; unavailable or stale forecasts hide the explorer.

## Portfolio charts

Risk of this plan includes a compact total-value chart. It uses the complete budget times the API's portfolio return, which already includes the zero-return cash allocation; it does not apply the invested fraction a second time. The lower scenario ends at budget + peor_caso. There is no invented upper portfolio range. Cash-only plans show a flat value. The horizontal axis is Day 0 to the selected horizon because /api/plan provides no as-of date. Daily points interpolate the final API estimate and are explicitly marked approximate.

Allocated assets in the legend and allocation table open an accessible modal, keeping the page from growing by one chart per holding. Its Your investment tab requests /api/decide with the allocated amount, plan horizon and profile only when opened. Value and gain use that allocated amount, even if the separate analysis suggests a different standalone amount. The original plan and allocation never change. The model label remains visible and the individual estimate is presented separately from the aggregate portfolio estimate.

The modal's Price history tab requests native quote prices only when selected, with a cache for the lifetime of that modal. It does not reconstruct a historical USD portfolio from native prices or assume historical FX rates. Loading, service errors and retry are local to the modal; closing or changing the plan aborts requests. Escape and the close button restore focus to the asset. The dialog adapts to a bottom sheet on phones, while the page stays in place. Charts are loaded lazily and hidden planner charts are unmounted on the homepage.

## Checks

~~~powershell
npm.cmd run test
npm.cmd run build
~~~

Contract tests cover all three decisions, the new sizing/trend fields, 21 assets, the plan response and all-cash case, budget/weight consistency, selected-group coverage, HTTP errors, malformed payloads, exact request bodies, cancellation and timeouts.

## Files and Git

Everything for this frontend lives in app/. The local .gitignore excludes node_modules/, dist/, local environment files and generated test/build files. Commit .env.example and package-lock.json, not .env or node_modules/.

No Python code is imported or executed by this app. The team owns the Python API and its implementation.
