# decision/ - regla de decisión, backtest y calibración (Rocco)

Convierte la predicción del modelo en **INVERTIR**, **ESPERAR** o **NO_POR_AHORA**, y sobre todo en **cuánto** invertir.
Son reglas fijas y explicables. No usa ningún LLM: Gemini, si entra, solo redacta lo que sale de aquí.

## Cómo se usa

```python
from decision.rules import decide
from decision.signals import tendencia

r = decide(pred, monto=1000, plazo_dias=30, simbolo="SPY", perfil="moderado",
           tendencia=tendencia(precios))
r["decision"]                    # "INVERTIR" | "ESPERAR" | "NO_POR_AHORA"
r["numeros"]["fraccion"]         # 0 a 1: parte del monto que conviene invertir hoy
r["numeros"]["monto_sugerido"]   # fraccion * monto
r["razones"], r["recomendaciones"]
```

## La regla

1. **Filtro de expectativa:** si el modelo espera perder (rendimiento ≤ 0 o probabilidad de pérdida ≥ 50 %), fracción 0 y **NO_POR_AHORA**.
2. **Tamaño por riesgo:** `fraccion = min(1, tolerancia / |peor caso|)`. El peor caso es el extremo bajo del intervalo del 90 %, o sea el percentil 5. La tolerancia la elige la persona: 5 %, 10 % o 20 %.
3. **Freno de tendencia** (apagado tras calibrar): si el precio está abajo de hace 12 meses, multiplica la fracción.
4. **Freno de evento:** si la Fed o el Banco de Inglaterra deciden tasas en los próximos 3 días, la fracción se reduce a la mitad y se sugiere invertir el resto después.
5. **Etiqueta:** fracción 0 → NO_POR_AHORA; ≥ 0.5 → INVERTIR; entre las dos → ESPERAR (con el monto chico sugerido).

**Por qué así.** La primera versión bloqueaba en lugar de dimensionar, y en el backtest se quedaba en efectivo 84 % del tiempo. La investigación del equipo encontró tres cosas:
- Invertir de una vez gana a entrar en partes 68 % de las veces (Vanguard, 1976-2022).
- Casi ningún predictor le gana al promedio histórico fuera de muestra (Goyal y Welch 2008).
- Dimensionar por volatilidad baja las caídas fuertes (Harvey et al. 2018).

Por eso la regla invierte por defecto y el riesgo decide **cuánto**.

## Backtest (`backtest.py`)

En cada fecha el modelo solo ve precios hasta ese día, y se entra al cierre del día **siguiente**. Las ventanas no se enciman y usan la misma rejilla de fechas para todos los activos. Lo que no se invierte queda en efectivo al 0 %.

Se compara contra dos referencias:
- **invertir siempre**: todo el monto en cada ventana.
- **misma exposición**: invertir siempre la fracción promedio de la app. Si la app no le gana a esta, su valor está en el tamaño, no en el momento.

```bash
python -m decision.backtest --todos --desde 2022-01-01
```

## Calibración (`calibrate.py`)

```bash
python -m decision.calibrate --perfil moderado     # tarda ~5 s
```

Protocolo:
- 6 configuraciones fijas: filtro de expectativa sí/no × freno de tendencia 1, 0.5 o 0.
- Un solo juego para los 19 activos.
- Se elige con 2016-2021 y se prueba con 2022-hoy, año por año.
- Walk-forward desde 2019.
- Bootstrap de bloques y placebo (fracciones barajadas al azar).

Resultado del 24 oct 2026, con el **baseline** (no con el modelo del equipo). Cartera con el mismo peso en los 19 activos, ventanas de 30 días, prueba 2022-hoy:

| Perfil | Config. elegida | Sharpe siempre | Sharpe app | Sharpe misma exp. | Caída máx. siempre | Caída máx. app | Placebo |
|---|---|---|---|---|---|---|---|
| conservador | sin filtro, sin freno | 0.89 | **1.06** | 0.89 | -31.9 % | **-10.2 %** | 0 % |
| moderado | con filtro, sin freno | 0.89 | 0.82 | 0.89 | -31.9 % | -15.9 % | 94 % |
| agresivo | con filtro, sin freno | 0.89 | 0.71 | 0.89 | -31.9 % | -22.9 % | 100 % |

"Placebo" es la parte de los repartos al azar, con la misma exposición, que igualan o superan a la app. Cuanto más bajo, más habilidad real.

Lo que dicen los números:
- **El pronóstico de riesgo sí tiene información, en el perfil conservador.** Ahí el Sharpe sube (1.06 contra 0.89 de misma exposición) y ningún reparto al azar lo iguala. Eso habla del riesgo, no de la dirección del precio.
- **En moderado y agresivo, la caída menor viene de invertir menos.** Contra misma exposición la caída queda parecida (-15.9 % contra -21.6 % en moderado; -22.9 % contra -24.3 % en agresivo) y el Sharpe queda abajo.
- **El filtro de expectativa no aporta con el baseline.** Fuera de muestra, el azar lo iguala (94-100 %). La diferencia de Sharpe contra misma exposición no es significativa: IC 90 % de -0.35 a +0.21 en moderado.
- **El freno de tendencia no mejoró el entrenamiento** en ningún perfil. Queda apagado.
- **Este es el marcador del modelo de Felipe y Brisma:** un buen modelo hace útil el filtro de expectativa. Se mide con `--modelo model`.

Valores por defecto en `rules.py`: los que eligió el entrenamiento para el perfil por defecto (moderado). Se probaron 6 configuraciones; no hubo otras pruebas.

Limitaciones:
- El efectivo rinde 0 % y no hay comisiones.
- Los 19 activos se eligieron en 2026 (sesgo de supervivencia).
- El calendario de bancos centrales empieza en oct 2026, así que el freno de evento no está en el backtest.
- La prueba tiene 57 ventanas: poco para separar diferencias chicas de Sharpe del ruido.
