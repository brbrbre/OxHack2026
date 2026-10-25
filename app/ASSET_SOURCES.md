# Asset marks

The app serves these SVGs locally from `public/assets/logos/`. Asset names and symbols still come from the API. Logos identify the corresponding companies, issuers or currencies; they do not imply affiliation or endorsement. Brand marks remain the property of their respective owners.

## Sources and attribution

Files are pinned to the source revisions below. Copies of the applicable collection notices are in `public/assets/licenses/`.

| Collection | Revision | Notice copied |
| --- | --- | --- |
| [Simple Icons](https://github.com/simple-icons/simple-icons/tree/4672316908c58ef9342f3069fe7ebe50d30d45b2) | `4672316908c58ef9342f3069fe7ebe50d30d45b2` | `simple-icons-CC0.txt` |
| [SVG Logos by Gil Barbara](https://github.com/gilbarbara/logos/tree/dafdf2df1334b2327497bfff40111aff0713c992) | `dafdf2df1334b2327497bfff40111aff0713c992` | `gilbarbara-CC0.txt` |
| [selfh.st Icons](https://github.com/selfhst/icons/tree/1d65d45a42e6323b54b8096967b1ea4b65321f97) | `1d65d45a42e6323b54b8096967b1ea4b65321f97` | `selfhst-CC-BY-4.0.txt` |
| [Cryptocurrency Icons](https://github.com/spothq/cryptocurrency-icons/tree/1a63530be6e374711a8554f31b17e4cb92c25fa5) | `1a63530be6e374711a8554f31b17e4cb92c25fa5` | `cryptocurrency-icons-CC0.txt` |
| [Flag Icons by Panayiotis Lipiridis](https://github.com/lipis/flag-icons/tree/ac7e0eb3259eb62aa6100c435607e2fe03896a97) | `ac7e0eb3259eb62aa6100c435607e2fe03896a97` | `flag-icons-MIT.txt` |
| [VectorLogoZone](https://github.com/VectorLogoZone/vectorlogozone/tree/7442420d3dc3ae97476fc57a64edfbfd7be95e24) | `7442420d3dc3ae97476fc57a64edfbfd7be95e24` | `vectorlogozone-README.txt` |

Simple Icons and SVG Logos supply their collections under CC0. See also the [Simple Icons brand disclaimer](https://github.com/simple-icons/simple-icons/blob/4672316908c58ef9342f3069fe7ebe50d30d45b2/DISCLAIMER.md). The original Vanguard icon is by selfh.st Icons, used under **CC BY 4.0**, without modification; its separate dark-theme adaptation is documented below. The flag collection is **MIT**, copyright 2013 Panayiotis Lipiridis; its notice is retained.

VectorLogoZone distinguishes its website's AGPL license from the logos: the original marks belong to their owners and its modifications are dedicated to the public domain. The copied Shell mark is therefore not described as an AGPL-licensed logo.

## Local files and display choices

| Local SVG | Exact source path | Display choice |
| --- | --- | --- |
| `apple.svg` | Simple Icons `icons/apple.svg` | Original black geometry. |
| `nvidia-green.svg` | Simple Icons `icons/nvidia.svg` | Original geometry; root fill added as `#76B900`. |
| `vodafone-red.svg` | Simple Icons `icons/vodafone.svg` | Original geometry; root fill added as `#E60000`. |
| `hsbc-red.svg` | Simple Icons `icons/hsbc.svg` | Original geometry; root fill added as `#DB0011`. |
| `microsoft.svg` | SVG Logos `logos/microsoft-icon.svg` | Original multicolor icon. |
| `shell-color.svg` | VectorLogoZone `src/content/logos/shell/shell-icon.svg` | Original red and yellow icon. |
| `vanguard.svg` | selfh.st `svg/vanguard.svg` | Original red issuer mark for VOO; fund symbol remains visible. |
| `btc.svg`, `eth.svg`, `sol.svg` | Cryptocurrency Icons `svg/color/btc.svg`, `svg/color/eth.svg`, `svg/color/sol.svg` | Original color variants for the base asset, not USDT. |
| `gb.svg`, `us.svg`, `mx.svg` | Flag Icons `flags/1x1/gb.svg`, `flags/1x1/us.svg`, `flags/1x1/mx.svg` | Original flags as pair markers; retain the explicit currency pair. |
| `google.svg` | SVG Logos `logos/google-icon.svg` | Original multicolor icon, reserved for a future API asset. |
| `tesla-red.svg` | Simple Icons `icons/tesla.svg` | Original geometry with red root fill `#E82127`, reserved for a future API asset. |
| `gold-bar.svg` | Original SVG geometry created for this app | Descriptive gold bullion icon for GLD, using three gold-toned faces; no raster image or external artwork embedded. |
| `invesco-qqq-wordmark.svg`, `invesco-qqq.svg` | [Official Invesco QQQ SVG](https://www.invesco.com/content/dam/invesco/qqq-etf/en/logo/QQQ.svg) | Original wordmark retained. Compact version changes only the viewBox to show its QQQ lettering, preserving the paths and original blue #000AD2. Brand artwork is owned by Invesco; no open artwork license is asserted. |
| `walmart.svg` | selfh.st `svg/walmart.svg`, at the revision above | Original yellow Walmart brand symbol, shared brand identifier for Walmart de México; ticker and API name remain unchanged. CC BY 4.0 attribution: selfh.st Icons. |
| `nasdaq.svg` | selfh.st `svg/nasdaq.svg`, at the revision above | Original blue Nasdaq symbol, retained for reference; QQQ uses its fund's Invesco QQQ mark. CC BY 4.0 attribution: selfh.st Icons. |
| `spdr.svg` | [SVG](https://companieslogo.com/img/orig/spdr-8d54528b.svg?download=true&t=1720244494), [collection listing](https://companieslogo.com/spdr-etf/logo/), [primary brand creator](https://www.thackwaymccord.com/case-study/spdr/) | Original SPDR mark used for the SPY fund family; paths unchanged. No open artwork license is asserted. |
| `ftse.svg` | [Official FTSE Russell SVG](https://www.lseg.com/content/dam/ftse-russell/en_us/images/logos/bespoke/lseg-ftse-russell-logo-hrz-rgb-pos.svg), [official page](https://www.lseg.com/en/ftse-russell) | Original provider wordmark identifies the FTSE family alongside the explicit FTSE 100 name and symbol. No open artwork license is asserted. |
| `femsa.svg` | [Pinned FMX SVG](https://raw.githubusercontent.com/ShaadyEmad/ticker-logos/880d2c97ba7b60c3216e4612d48864d9f5f767b5/US%20Market/SVG/FMX.svg), identity checked against the [official FEMSA presentation](https://identidad.femsa.com/wp-content/uploads/2023/05/2023-EN-Overview.pdf) | Existing issuer wordmark on burgundy, with viewBox added; original paths and Finnhub source comment retained. Collection has no declared license; no open artwork license is asserted. |
| `america-movil-symbol.svg` | Original SVG created for this app | Descriptive blue globe and telecommunications signal, not a reconstruction of the company mark. |
| `sp500-index.svg`, `ipc-index.svg` | Original SVGs created for this app | Compact descriptive index identifiers, using 500 and IPC alongside the full API name. |

Google and Tesla files do not add those companies to the API catalogue. All copied files were checked for SVG vector content without scripts, event handlers, external resources, embedded raster images or `foreignObject` elements. Root fill and viewBox adaptations are listed above; brand path geometry is unchanged. The gold bullion geometry is original to this app.

## Dark-theme display adaptations

These local variants adjust paint colors for contrast on Horizon's dark surfaces; they are app adaptations, not official alternate brand artwork. Original files, path geometry and viewBoxes remain unchanged. `AssetLogo` selects a variant through `darkLogo` metadata, falling back to the original file if the variant cannot load, then to the existing text marker if both fail.

| Adapted SVG | Local source | Color adjustment |
| --- | --- | --- |
| `spdr-dark.svg` | `spdr.svg` | Dark green lettering `#273f33` becomes pale green `#D5E8DD`. |
| `apple-dark.svg` | `apple.svg` | Adds a soft white root fill `#F0F3F8`. |
| `invesco-qqq-dark.svg` | `invesco-qqq.svg` | Blue `#000ad2` becomes lighter blue `#8F9AFF`. |
| `ftse-dark.svg` | `ftse.svg` | Blue `#001eff` becomes lighter blue `#93A6FF`. |
| `vanguard-dark.svg` | selfh.st Icons' `vanguard.svg`, CC BY 4.0, revision and notice above | Recolors red `#96151d` to `#E88991`; original geometry and attribution retained. |
| `america-movil-symbol-dark.svg` | Original descriptive `america-movil-symbol.svg` | Globe/signals use `#69AEE6`, with internal grid `#19212C`. |
| `sp500-index-dark.svg` | Original descriptive `sp500-index.svg` | Dark tile `#25334D` and lighter lettering/border `#B0C2DA`. |
| `ipc-index-dark.svg` | Original descriptive `ipc-index.svg` | Dark tile `#21372F` and lighter teal lettering/border `#6AC6C0`. |

Marks whose characteristic colors remain visible, including NVIDIA green, HSBC red, Shell, Walmart and cryptocurrency marks, retain their original files. Dark-theme image wrappers are transparent instead of receiving a blanket white background; Gold retains its gold-toned surface, and currency-pair flags retain their original colors and circular borders.

## Descriptive alternatives

All 21 current catalogue assets now have a local logo, original descriptive SVG or currency-pair flags. SPY uses SPDR, QQQ uses its fund mark, and FTSE 100 uses its provider's FTSE Russell mark. GLD remains an ETF and uses the original gold bullion SVG. S&P 500, IPC and América Móvil use original descriptive SVGs. The API names and symbols are always retained.

Walmart uses the selfh.st source above. FEMSA now uses the issuer wordmark documented above. A ticker-named AMX candidate was rejected because its artwork did not match América Móvil. The separate, correct América Móvil wordmark found through Wikimedia Commons is approximately 608 KB and is not bundled; the app instead uses its own compact telecom symbol.
