# api/ - puente entre la app y el código de Python (Rocco)

FastAPI. La app de React no llama Python directo: le pide los datos a este servidor.
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
    "eventos": []
  },
  "modelo": "baseline",
  "aviso": "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
}
```

- `decision` es siempre `INVERTIR`, `ESPERAR` o `NO_POR_AHORA`.
- `eventos` trae textos como `"Fed rate decision (2026-10-28)"` cuando hay uno cerca.
- Los textos (razones, recomendaciones, eventos, aviso, nombres y grupos de activos) llegan en inglés. Los códigos de `decision` y `perfil` siguen en español: la app los traduce a sus etiquetas.
- `modelo` dice qué predijo: `baseline` (promedio histórico, mientras el modelo de Felipe y Brisma no esté) o el nombre de su modelo.
- Errores: código 400 o 404 con `{"error": "texto"}`.
