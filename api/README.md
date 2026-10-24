# api/ - puente entre la app y el código de Python (Rocco)

FastAPI. La app de React no llama Python directo: le pide los datos a este servidor. Son 4 rutas.
Este contrato no cambia sin avisar a Carlos.

Correr en local: `uvicorn api.main:app --reload --port 8000`

## Qué modelo usa

- Si existe `model/predict.py` con una función `predict(precios, plazo_dias)`, usa esa. Su nombre sale de la variable `NOMBRE` del mismo archivo.
- Si la función acepta además `es_cripto=`, el API se lo pasa (`True` para BTCUSDT, ETHUSDT, SOLUSDT).
- Si no existe, usa `api/baseline.py`: promedio y volatilidad de los últimos 3 años. Es también la referencia contra la que se compara el modelo.
- La respuesta de `/api/decide` dice cuál usó en `"modelo"`.

Si existe `app/dist` (la app de React compilada con `npm run build`), el API también la sirve en `/`. Así se publica un solo programa.

Pruebas: `python -m pytest -q tests` (no usan internet).

## Rutas

### `GET /api/assets`

Catálogo de activos, agrupado por tipo.

```json
{
  "ETFs": [
    {"simbolo": "SPY", "nombre": "S&P 500 (SPDR)"},
    {"simbolo": "QQQ", "nombre": "Nasdaq 100"}
  ],
  "Crypto": [
    {"simbolo": "BTCUSDT", "nombre": "Bitcoin"}
  ]
}
```

### `GET /api/prices/{simbolo}?dias=365`

Cierres diarios para la gráfica. `dias` es opcional (por defecto 365).

```json
{
  "simbolo": "SPY",
  "fechas": ["2025-10-24", "2025-10-27", "...", "2026-10-23"],
  "cierres": [598.12, 601.40, "...", 759.97]
}
```

### `POST /api/decide`

Pide la decisión. `perfil` es `conservador`, `moderado` o `agresivo`. `plazo_dias` es cuánto tiempo piensa dejar invertido el dinero.

```json
{"simbolo": "SPY", "monto": 1000, "plazo_dias": 30, "perfil": "moderado"}
```

Respuesta:

```json
{
  "simbolo": "SPY",
  "nombre": "S&P 500 (SPDR)",
  "decision": "INVERTIR",
  "razones": [
    "Over 30 days the model expects +2.0%, with a 31% chance of loss.",
    "Likely range: -$45 to $85 on $1,000.",
    "The expected gain makes up for the risk for your profile."
  ],
  "recomendaciones": [],
  "numeros": {
    "monto": 1000, "plazo_dias": 30, "perfil": "moderado",
    "rendimiento_esperado": 0.02, "volatilidad": 0.04, "prob_perdida": 0.31,
    "senal": 0.5, "peor_caso": -45.0, "mejor_caso": 85.0,
    "fraccion": 1.0, "monto_sugerido": 1000.0, "tendencia_12m": 0.14,
    "eventos": []
  },
  "modelo": "baseline",
  "aviso": "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
}
```

- `decision` es siempre `INVERTIR`, `ESPERAR` o `NO_POR_AHORA`.
- `fraccion` (0 a 1) y `monto_sugerido` dicen cuánto conviene invertir hoy. Es el dato principal: la app lo debe mostrar grande.
- `tendencia_12m` es el rendimiento de los últimos 12 meses (puede ser `null` si no hay historia).
- `eventos` trae textos como `"Fed rate decision (2026-10-28)"` cuando hay uno cerca.
- Los textos (razones, recomendaciones, eventos, aviso, nombres y grupos de activos) llegan en inglés. Los códigos de `decision` y `perfil` siguen en español: la app los traduce a sus etiquetas.
- `modelo` dice qué predijo: `baseline` (promedio histórico, mientras el modelo de Felipe y Brisma no esté) o el nombre de su modelo.
- Errores: código 400 o 404 con `{"error": "texto"}`.

### `POST /api/plan`

Para quien no sabe en qué invertir. Recibe monto, plazo, perfil y los tipos de activo que le interesan (los nombres de grupo de `/api/assets`, uno o más).

```json
{"monto": 5000, "plazo_dias": 90, "perfil": "moderado", "tipos": ["ETFs", "US stocks", "Crypto"]}
```

Respuesta (ejemplo real, baseline, 24 oct 2026, recortado):

```json
{
  "cartera": [
    {"simbolo": "VOO", "nombre": "S&P 500 (Vanguard)", "grupo": "ETFs", "peso": 0.28, "monto": 1400.0},
    {"simbolo": "QQQ", "nombre": "Nasdaq 100", "grupo": "ETFs", "peso": 0.20, "monto": 1000.0},
    {"simbolo": "GLD", "nombre": "Gold", "grupo": "ETFs", "peso": 0.19, "monto": 950.0}
  ],
  "efectivo": 0.0,
  "invertir": [{"simbolo": "SPY", "nombre": "S&P 500 (SPDR)", "grupo": "ETFs", "razon": "...", "fraccion": 1.0, "fuera_del_plan": null}],
  "esperar": [{"simbolo": "BTCUSDT", "nombre": "Bitcoin", "grupo": "Crypto", "razon": "In a bad scenario the full amount could lose $1,097 (-21.9%); your moderate profile accepts up to 10%.", "fraccion": 0.46}],
  "no_por_ahora": [{"simbolo": "ETHUSDT", "nombre": "Ethereum", "grupo": "Crypto", "razon": "The model sees a higher chance of losing than gaining over this period.", "fraccion": 0.0}],
  "resumen": "For 90 days with a moderate profile: $1,400 in S&P 500 (Vanguard), ... Keep $0 in cash. In a bad scenario the plan could lose about $321 (-6.4%); your profile accepts up to 10%.",
  "numeros": {"monto": 5000, "plazo_dias": 90, "perfil": "moderado", "invertido": 5000.0,
              "rendimiento_esperado": 0.057, "volatilidad": 0.08, "peor_caso": -321.0, "tolerancia": 0.1},
  "modelo": "baseline",
  "aviso": "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
}
```

- `cartera` va ordenada de mayor a menor peso: hasta 5 activos, máximo 40 % en uno, sin dos activos que se muevan casi igual (como SPY y VOO).
- `efectivo` es lo que no conviene invertir hoy. `invertido + efectivo = monto`.
- `invertir`, `esperar` y `no_por_ahora` traen todos los activos de los tipos elegidos, cada uno con su razón.
- Cada activo de `invertir` trae `fuera_del_plan`: `null` si está en la cartera, o el motivo si no entró (se mueve casi igual que otro ya elegido, o la cartera ya tiene 5).
- Tipo desconocido: 400 con `{"error": "Unknown asset types: ..."}`.

### Resumen, tutor y audio (Gemini y ElevenLabs)

Solo redactan, explican o leen. Nunca deciden ni cambian un número. Las claves van en `.env` (`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`); sin ellas todo sigue funcionando con textos locales.

- `POST /api/summary/decide` (mismo cuerpo que `/api/decide`) y `POST /api/summary/plan` (mismo cuerpo que `/api/plan`) devuelven `{"texto": "...", "fuente": "gemini" | "template"}`. Si Gemini falla, tarda más de 8 s o su texto no trae el monto que calculó la regla, se usa la plantilla.
- `POST /api/ask` con `{"pregunta": "...", "simbolo": "WALMEX.MX", "contexto": {...}, "historial": [{"pregunta": "...", "respuesta": "..."}]}` devuelve `{"respuesta": "...", "fuente": "gemini" | "local" | "offline"}`. `simbolo`, `contexto` e `historial` son opcionales (máximo 4 turnos, pregunta de hasta 300 caracteres). Sin Gemini contesta con la ficha del activo (`explain/fichas.py`) o con el glosario.
- `POST /api/listen` con `{"texto": "..."}` devuelve `audio/mpeg`. Solo lee resúmenes que generó este servidor (400 si no); 503 si no hay audio, y la app usa la voz del navegador.

Modelo de Gemini: `GEMINI_MODEL` (por defecto `gemini-flash-lite-latest`). Voz: `ELEVENLABS_VOICE_ID` y `ELEVENLABS_MODEL`.

### Hábito: recordatorio por WhatsApp y llamada (`habito/`)

La persona pide que le recordemos su plan. Al terminar el plazo, el servidor vuelve a calcular la respuesta de ese día; Gemini redacta el WhatsApp con esos números y un link personal. Si nadie abre el link en `HABITO_ESPERA_MIN` minutos, Twilio llama y reproduce un guion con la voz de ElevenLabs.

- `POST /api/habit/remind` con `{"telefono": "+1...", "consentimiento": true, "simbolo", "monto", "plazo_dias", "perfil"}` guarda el recordatorio (vence en `plazo_dias`). 400 sin permiso o con formato malo; 403 si el número no está en `HABITO_PERMITIDOS` (la URL es pública: así nadie la usa para mandar spam).
- `GET /api/habit/{token}` da el estado: `pendiente`, `enviado`, `abierto`, `llamado` o `error`.
- `POST /api/habit/{token}/now` (solo con `HABITO_DEMO=1`) vence el recordatorio ya y lo manda.
- `GET /r/{token}` es el link del WhatsApp: marca `abierto` y abre la app con el mismo plan.
- `GET /api/habit/audio/{token}.mp3` es el audio que reproduce la llamada.

Variables: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (número para llamar), `TWILIO_WHATSAPP_FROM` (número del sandbox), `PUBLIC_URL`, `HABITO_PERMITIDOS` (por defecto `DEMO_PHONE`), `HABITO_ESPERA_MIN` (por defecto 1440), `HABITO_DEMO`, `HABITO_AUTO=1` (revisa recordatorios cada 20 s dentro del API). Los recordatorios viven en `data/cache/habito.sqlite`, fuera del repo, porque llevan teléfonos.

Límites de la demo: el sandbox de WhatsApp de Twilio solo escribe a números que se unieron con "join ..."; la cuenta de prueba solo llama a números verificados y empieza con un aviso de "trial account". En uso real, un mensaje que abre la conversación necesita una plantilla aprobada por Meta.
