# app/ - the web app (Carlos)

React, TypeScript and Vite. It only talks to the API (`api/README.md`); it imports no Python.

What a person sees:
- A landing page that explains Horizon, then the planner.
- Two ways in: "Guide me step by step" or "I'll fill it in".
- "I have assets in mind" (one or several assets) or "Help me choose" (a plan from asset types).
- The answer (Invest / Wait / Not now) with the amount for today, the reasons, the forecast cone and per-asset charts.
- "In short" with Listen, "Ask Horizon", and "Make it a habit" (WhatsApp reminder and call) in both modes.
- Five languages (English, Latin American Spanish, French, Italian, Simplified Chinese), local currencies, and light or dark theme. Model explanations and spoken audio stay in English.

```bash
cd app
npm ci
npm run dev        # http://localhost:5173, with /api proxied to http://localhost:8000
npm test           # unit tests
npm run build      # production build; the API serves app/dist
```

The disclaimer and data sources the API sends in `aviso` are always on screen. More detail: `DEVELOPMENT.md` and `ASSET_SOURCES.md`.
