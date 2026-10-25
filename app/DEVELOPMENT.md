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

## Home, currencies and selected investments

The root URL opens the introduction in `src/pages/landing/`. `src/RootApp.tsx` connects it to the current planner in `src/App.tsx` at `?view=planner`. Returning Home keeps the draft, selected investments, currency and result mounted; focus and audio stay inactive while the planner is hidden. A reminder link such as `/?simbolo=SPY&monto=500&plazo=90&perfil=agresivo` skips Home and the entry choices and opens the filled form in USD.

The arrow beside the budget currency switches USD, MXN, GBP and EUR. `src/currency/` uses the dated ECB reference snapshot of 23 October 2026, with the source visible in the UI. Changing currency only changes presentation. Requests stay in USD, including reminder amounts; structured result amounts convert for display. API reasons, recommendations, summaries and audio retain their original USD text, with a visible explanation. Price charts retain the asset's quote currency.

"I have assets in mind" allows one or more catalogue assets, without duplicates. Before submission the form explains an equal comparison split of the total budget. Each selected asset calls the existing `/api/decide` endpoint with its own share, horizon and profile; requests are limited to three at once and cancel together. Whole USD cent budgets split without losing cents; converted budgets retain their original precision. The result lists each separate decision and lets the user inspect one asset's reasons, chart, summary, tutor and reminder at a time. This is a comparison, not an optimized portfolio or a combined risk calculation. `/api/plan` remains the unchanged automatic plan by selected asset types.

For a Wait answer with a positive suggested amount, the headline says "Suggested now". The card explicitly separates capital to invest now from capital kept uninvested, while preserving the API's decision and explanations. Precise amounts remain visible in that split; the gain/loss estimates are labelled as applying to the full submitted budget.

## Languages, appearance and introduction

The interface defaults to English and supports Latin American Spanish (`es-419`), Simplified Chinese (`zh-CN`), French (`fr`) and Italian (`it`). The header's language control updates the landing page, planner labels, accessibility text, dates and percentages without changing API requests or enum values. API-authored reasons, recommendations, event text, asset names and summaries keep their original English text; ElevenLabs and browser speech read that original summary in English. A visible note explains this distinction when another interface language is selected. Translation dictionaries and formatting live in `src/i18n/`.

Each language has one file in `src/i18n/locales/`: `en.ts`, `es-419.ts`, `zh-CN.ts`, `fr.ts` and `it.ts`. Each file groups its text by page or feature. `locales/index.ts` connects all five dictionaries to `I18nContext.tsx`, so components keep using the same translation function. `types.ts` defines supported languages, while `errors.ts` limits translation to known frontend errors; it contains no translated copy. Keep the same keys and interpolation tokens in every language.

The adjacent appearance control switches between light and dark themes. Language and theme preferences are saved in local storage (`horizon-language` and `horizon-theme`). English is the default when no supported language was explicitly saved; browser language, URL parameters and navigation do not choose another language. The shared language provider stays mounted above Home and the planner, so moving between them keeps the current choice. Only the language selector changes the current page's language; changes in another tab do not override it. A reload restores the last saved explicit choice. Theme changes continue to synchronize across tabs. The controls still work when browser privacy settings prevent storage. Shared appearance styles stay in `src/appearance/appearance.css`; all dark-theme overrides live in `src/appearance/dark.css`. `ThemeContext.tsx` imports both stylesheets and selects the theme through `html[data-theme='dark']`.

These source files belong to one frontend. The existing `npm.cmd run build` includes the language dictionaries and both themes in `dist/`, so the server serves them together without separate language or theme services.

On the first Home visit in a browser session, a 2.3-second sunrise introduction shows the Horizon wordmark. Skip introduction dismisses it immediately; reduced-motion preferences bypass it. Session storage records completion under `horizon-introduction-seen`, so returning Home does not repeat it. Direct planner URLs (`?view=planner`) and reminder links with `simbolo` bypass the introduction. The page behind it is inert, and focus returns to the landing page heading after it closes.

A translated educational responsibility notice stays fixed at the bottom on Home, during setup and beside results. Its measured height reserves page space through `--notice-space`, including when text wraps or the screen or language changes; it does not cover the final controls. API source notices can also remain in the result and the landing footer.

## Contract and sample scenarios

API types retain the team's Spanish field names and enum values. Interface labels use the selected language; reasons, recommendations, event text, asset names and notices returned by the API are displayed as supplied.

The current contract is api/README.md on main (reviewed at commit 7083e6d, including the investment plan and UK catalogue additions). API copy, catalogue names and catalogue groups arrive in English. Group and decision labels can be translated for display, while original group keys and wire codes remain unchanged. Decision and risk-profile source labels are centralized in src/lib/labels.ts; `src/i18n/` supplies their translations.

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

The planner entry offers Guide me step by step and I’ll fill it in. This chooses a presentation, not a risk profile or financial recommendation. The guided path asks about budget, time and comfort with gains/losses, one question at a time, followed by a review. The quick path opens the expanded, centred form with all fields together. Both share the same draft and exact API values. Switching paths keeps budget, horizon, risk, asset and group choices, and cancels pending analysis. The first guided choice defaults to Help me explore; a later switch preserves an existing investment mode.

Guided Continue and Enter advance the current step; only See my plan on Review sends an analysis request. Back and the progress heading support keyboard use without opening a phone keyboard automatically. Time labels explain the existing day values, and risk descriptions retain Conservative, Moderate and Aggressive as secondary labels. Review makes asset and category selections explicit; category descriptions explain the API group names without changing them. The service errors and retry stay beside Review. Returning to an earlier step clears those errors and cancels any request.

Results and the single-asset chart appear only after the first successful analysis; price history is requested at that point. A failed or cancelled first request keeps the chosen input view. The educational notice remains visible on the entry screen, while filling the plan, and after analysis.

Once results have opened, the quick form stays on the left on desktop, or above results on phones. Editing or switching investment modes clears stale analysis without collapsing back to the opening screen. Edit step by step reopens guidance with the same values; Use the quick form returns to all fields. Run the updated plan to see a new answer. On phones, a successful submission brings the result into view and Edit your plan returns to the inputs. Reloading starts with the two entry choices again.

Asset marks are local SVG files with sources and notices recorded in ASSET_SOURCES.md. The asset picker searches API names and symbols without requiring accents, preserves the API's groups, and supports keyboard selection. Logos also appear beside structured asset names in the result, chart, allocation legend, table and decision lists. Descriptive markers cover assets without a suitable logo; GLD uses an original gold bullion SVG with a gold frame. Names keep the same neutral text styling. `assetIdentity.ts` can provide a separate `darkLogo` for marks that need lighter lettering; `AssetLogo` chooses it with the current theme and tries the original if the variant fails. Colorful marks keep their original artwork. Dark mode removes the blanket white logo background while preserving Gold and currency-pair markers.

Portfolio segment and legend colors are attached to symbols in src/lib/assetIdentity.ts, with color values in the stylesheet root. They remain stable when the API reorders holdings. Colors identify the asset rather than its decision or performance, and amounts, percentages and names remain available independently of color. Cash keeps a neutral hatched fill. Google and Tesla identities are reserved for possible future API entries; they do not add selectable assets.

The mode selector above the form offers I have assets in mind and Help me choose. The second mode keeps the same amount, horizon and risk inputs and adds checkboxes sourced from the catalogue's group keys. It submits only monto, plazo_dias, perfil and tipos to /api/plan through the same VITE_USE_MOCKS switch. Asset-type errors appear beside the checkbox group. Other service errors appear in the result with a retry button. Switching modes or editing any input cancels pending analysis and clears stale results.

The portfolio result shows the API's invested amount, holdings and cash in a proportional bar, a legend and a table. Weights refer to the full budget, including cash; the frontend does not allocate or rebalance investments. It displays the risk against the full amount, the three decision lists with their reasons, and the API summary verbatim. An all-cash plan is a valid result. Tiny floating point cash residues are displayed as zero without changing the response. The educational notice stays below the result.

Select an asset name in the allocation legend, table or decision lists to open its chart dialog. The same dialog opens when selecting an answer in a manual multi-asset comparison. Its Your investment tab illustrates the monetary change; Price history loads the last year of prices and the existing forecast cone. The dialog keeps the horizon and risk profile from the analyzed result. For an allocated holding it requests a separate /api/decide estimate using that holding's exact amount, without changing the portfolio. For a manual comparison it reuses the matching answer and its budget share. An asset outside the portfolio is clearly labelled as a hypothetical full-budget illustration, with no allocation.

The monetary chart uses day 0 through the requested horizon because /api/decide has no forecast as-of date. Values and range boundaries follow a straight line to the API's terminal estimates; the chart explicitly describes this as an illustration, not daily model predictions. It does not apply fraccion or monto_sugerido to the amount again. A day slider, mouse or touch selects the visible value. The price chart retains its original quote currency and calendar-date forecast rules. Both charts have unique IDs when the underlying page also contains a chart.

Chart code loads on demand, and historical prices load when their tab is opened. The dialog handles loading, errors and retry independently; closing it aborts pending requests, restores keyboard focus to the asset name and leaves the plan unchanged. Escape, the close button and the backdrop close it. The tabs support arrow keys, Home and End. The dialog scrolls within the phone viewport, uses the selected theme, language and budget currency, and keeps the educational notice visible.

The API does not include monetary or quote-currency metadata. The API amounts use USD to match the supplied contract; structured budget and result amounts can be displayed in the selected currency as described above. The chart maps symbols to quote units: .MX uses MXN, .L arrives in GBp and is displayed in GBP after dividing by 100, USDT pairs use USDT, and =X symbols show an exchange rate with its direction. Other symbols use USD. Visible prices, tooltips and axis labels share the same formatter; source prices are not modified. A negative period change uses a downward arrow.

The global educational responsibility notice remains fixed at the bottom with reserved space; the API's source notice also appears below the result in document flow. Analysis moves focus to the result heading; the skip link remains available for keyboard navigation. Body copy uses 15–16 px, with smaller metadata and notice text, and theme tokens keep text readable against its background.

## Visual design

The opening form is unboxed and fills the main content area, with larger controls and a three-column risk choice on desktop. It becomes an unboxed sidebar after analysis. The result is the only elevated surface, and the price chart is flat with a dividing line above it. Headings use direct copy in the selected interface language; result and chart metadata use labelled values. The single IBM Plex Sans family is bundled locally in four weights, so fonts do not require an external request at runtime. All numbers use tabular figures.

The light palette lives in the stylesheet's root tokens: paper #F7F8F6, surface #FFFFFF, ink #15202B, secondary ink #4A5662, line #DCE1E5 and accent #2346A0; dark theme overrides the shared tokens. Decision colors identify badges and portfolio decision groups. Those groups use green, amber or red surfaces, a side border and a filled badge with a decorative status icon. Asset names stay neutral and allocation segments retain their brand colors. The optional sunrise introduction animates once per session, and the suggested amount has a brief entrance when a result arrives; prefers-reduced-motion bypasses the introduction and removes the amount animation. Loading states use static icons and text. On phones, submitting moves directly to the result without animated scrolling.

## Suggested amount and forecast

The result headline uses the API's monto_sugerido: invest the full budget, invest part now and keep the remainder for later, or keep the whole budget for now. The frontend does not recalculate the allocation. Decision colors are reserved for the decision badge. Reasons and recommendations remain verbatim; the baseline label explains that it uses a 3-year historical average, while other model names are displayed as supplied.

For a positive amount with a Wait decision, the headline says Suggested now rather than presenting it as a separate alternative to the API's suggestion. The card explicitly splits the original budget into Suggested investment now and Keep uninvested for now. These are capital amounts, not profits. The split preserves cents and converts the original USD values before formatting in another currency; the USD headline normally stays in whole dollars, with exceptions when rounding would hide a positive amount or make a partial amount look like the full budget. Zero and full investment also show both sides of the split.

Before the supplied reasons, a note states that the API's gain/loss estimates refer to the full submitted amount, rather than only the smaller suggested investment. The period is labelled Investment period. Reminder copy describes reviewing the plan after that many days, without calling the horizon a waiting period. Reminder timing, consent, delivery-state handling and polling are unchanged.

After analysis, the price chart adds a shaded terminal range and a dashed expected-price line. The endpoint is the last closing date plus plazo_dias in calendar days, calculated in UTC; weekends and leap days are counted. The chart uses a numeric time axis so the forecast occupies its actual duration. The terminal values use the original API price and full requested budget: low = last × (1 + peor_caso / monto), high = last × (1 + mejor_caso / monto), expected = last × (1 + rendimiento_esperado). Currency conversion is only for display. The band connects the last close to those terminal estimates; it does not claim daily model predictions. Changing the plan removes the old analysis and cone.

## Checks

~~~powershell
npm.cmd run test
npx.cmd tsc -b --noEmit
npm.cmd run build
~~~

Contract tests cover all three decisions, the new sizing/trend fields, 21 assets, the plan response and all-cash case, budget/weight consistency, selected-group coverage, HTTP errors, malformed payloads, exact request bodies, cancellation and timeouts.

## Files and Git

Everything for this frontend lives in app/. The local .gitignore excludes node_modules/, dist/, local environment files and generated test/build files. Commit .env.example and package-lock.json, not .env or node_modules/.

No Python code is imported or executed by this app. The team owns the Python API and its implementation.
