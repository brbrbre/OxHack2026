# decision/ - la regla de decisión (Rocco)

Convierte la predicción del modelo en **INVERTIR**, **ESPERAR** o **NO_POR_AHORA**, con razones y recomendaciones.
Son reglas fijas y explicables. No usa ningún LLM: Gemini, si entra, solo redacta lo que sale de aquí.

## Cómo se usa

```python
from decision.rules import decide

r = decide(pred, monto=1000, plazo_dias=30, simbolo="SPY", perfil="moderado")
r["decision"]          # "INVERTIR" | "ESPERAR" | "NO_POR_AHORA"
r["razones"]           # lista de frases para mostrar
r["recomendaciones"]   # lista de frases para mostrar
r["numeros"]           # peor y mejor caso en dinero, señal, eventos, etc.
```

`pred` es la salida de `model.predict()` (contrato en `model/README.md`). `perfil` puede ser `conservador`, `moderado` o `agresivo`.

Demo con predicciones de ejemplo: `python -m decision.rules`

## Las reglas, en orden

1. Si el modelo espera perder (rendimiento ≤ 0 o probabilidad de pérdida ≥ 50 %): **NO_POR_AHORA**.
2. Si hay una decisión de tasas que mueve a ese activo en los próximos 3 días: **ESPERAR** hasta después.
3. Si el peor escenario pierde más de lo que acepta el perfil (5 %, 10 % o 20 %): **ESPERAR**, y sugiere un monto menor.
4. Si la señal (rendimiento entre volatilidad) es ≥ 0.25 y la probabilidad de pérdida < 45 %: **INVERTIR**.
5. Si no: **ESPERAR**, porque la señal es débil.

Si el precio se mueve mucho, además sugiere entrar en 3 partes.
Los umbrales son valores iniciales. Se calibran con el backtest y se cambian arriba de `rules.py`.

## Calendario (`events.py`)

Fed 28 oct, BCE 29 oct, Banco de Inglaterra 5 nov, y las siguientes. Fechas de las páginas oficiales, con sus links en el archivo.
La Fed afecta a todo el catálogo; el Banco de Inglaterra, solo a lo británico. Falta Banxico.

## Pendiente

Backtest en dinero: seguir la app contra invertir siempre el primer día. Necesita el modelo.
