# Pitch sources

Every outside figure in `docs/pitch.md`, with its source. "Read" means the team read the original document.

| Figure in the pitch | Source | Year | Checked |
|---|---|---|---|
| 61% of UK adults with £10,000+ to invest keep three quarters of it or more in cash | FCA, Financial Lives 2024 key findings (May 2024 survey). https://www.fca.org.uk/publication/financial-lives/financial-lives-survey-2024-key-findings.pdf | 2025 | Read |
| 9% of UK adults got regulated advice on investments or pensions in a year | FCA, Financial Lives 2024 key findings. Same link | 2025 | Read |
| 76.5% of Mexican adults (18-70) have a formal financial product; 3.4% hold a term deposit or investment fund | INEGI, ENIF 2024 press release 49/25, chart 3. https://www.inegi.org.mx/contenidos/saladeprensa/boletines/2025/enif/ENIF2024_CP.pdf | 2025 | Read, chart checked |
| Finfluencer followers scored 42% on a knowledge quiz; 63% rated their own knowledge as high | FINRA Investor Education Foundation (2024 NFCS data). https://www.finra.org/media-center/newsreleases/2026/finra-foundation-research-examines-characteristics-behaviors-outcomes | 2026 | Read |
| Advice often costs more than a young person has invested | Initial advice fee about £2,000-3,000 (Unbiased, https://www.unbiased.co.uk/value-of-advice/report-stats); UK 18-24s hold a median £1,000-2,000 in investible assets (FCA Financial Lives 2024) | 2025 | Read (FCA), secondary (Unbiased) |
| Reminders naming the saver's own goal raised savings 16% | Karlan, McConnell, Mullainathan and Zinman, "Getting to the Top of Mind", Management Science. https://www.nber.org/papers/w16205 | 2016 | Read (NBER summary) |
| A lump sum beat phasing in over 3 months 68% of the time (MSCI World, 1976-2022) | Vanguard, "Cost averaging: invest now or temporarily hold your cash?". https://corporate.vanguard.com/content/dam/corp/research/pdf/cost_averaging_invest_now_or_temporarily_hold_your_cash.pdf | 2023 | Read |
| The most active of 66,465 US households earned 11.4% a year; the market earned 17.9% (1991-1996) | Barber and Odean, "Trading Is Hazardous to Your Wealth", Journal of Finance 55(2). https://ideas.repec.org/a/bla/jfinan/v55y2000i2p773-806.html | 2000 | Read (abstract) |
| 90% of UK adults use WhatsApp | Ofcom, Online Nation 2025. https://www.ofcom.org.uk/media-use-and-attitudes/online-habits/from-apps-to-ai-search-how-the-uk-goes-online-in-2025 | 2025 | Secondary |

Model and method references used on the slides:
- Takens (1981), the delay embedding; Carlsson (2009), "Topology and data"; Gidea and Katz (2018), TDA on market crashes.
- Bailey, Borwein, López de Prado and Zhu (2014), on backtest overfitting.
- Brier (1950) and Gneiting and Raftery (2007), on scoring probabilistic forecasts.

The trend × disorder weight comes from `coef[2]` in the model files: −0.387 in `model/params_tda.json` (the app, trained on all history) and −0.25 in `model/params_tda_hasta_2021.json` (the tested model).

Horizon's own numbers (90% range, 1,218 windows, Sharpe 1.17 vs 0.98, worst fall 16.5% vs 24.0%, timing +0.08) come from the commands in `README.md`, run with `TDA_PARAMS=model/params_tda_hasta_2021.json`. They were re-run on 25 October 2026 and matched.

What the pitch does not claim, on purpose:
- That a phone call works better than a text. No trial compares them.
- That sizing by risk raises returns. It cuts the bad tail; Horizon earned less in total than always investing everything.
- That Horizon is financial advice. It is an educational prototype.
