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
- Un solo juego para los 21 activos.
- Se elige con 2016-2021 y se prueba con 2022-hoy, año por año.
- Walk-forward desde 2019.
- Bootstrap de bloques y placebo (fracciones barajadas al azar).

Resultado del 24 oct 2026, con el **baseline** (no con el modelo del equipo). Cartera con el mismo peso en los 21 activos, ventanas de 30 días, prueba 2022-hoy:

| Perfil | Config. elegida | Sharpe siempre | Sharpe app | Sharpe misma exp. | Caída máx. siempre | Caída máx. app | Caída máx. misma exp. | Placebo |
|---|---|---|---|---|---|---|---|---|
| conservador | con filtro, sin freno | 0.98 | **1.08** | 0.98 | -28.6 % | **-7.9 %** | -12.4 % | 6 % |
| moderado | con filtro, sin freno | 0.98 | 0.97 | 0.98 | -28.6 % | -14.5 % | -19.6 % | 51 % |
| agresivo | con filtro, sin freno | 0.98 | 0.83 | 0.98 | -28.6 % | -20.8 % | -21.9 % | 100 % |

"Placebo" es la parte de los repartos al azar, con la misma exposición, que igualan o superan a la app. Cuanto más bajo, más habilidad real.

Lo que dicen los números:
- **El pronóstico de riesgo tiene información en el perfil conservador.** El Sharpe sube (1.08 contra 0.98 de misma exposición), la caída máxima es la menor (-7.9 %) y solo 6 % de los repartos al azar lo igualan. Eso habla del riesgo, no de la dirección del precio.
- **En moderado y agresivo, la caída menor viene sobre todo de invertir menos.** Contra misma exposición, el Sharpe queda igual o abajo.
- **La elección entre configuraciones es frágil.** Con 19 activos el conservador elegía "sin filtro"; al sumar HSBC y Shell eligió "con filtro". En entrenamiento las configuraciones quedan a 0.04 de Sharpe entre sí: es ruido. Con 6 configuraciones al azar, el mejor Sharpe ya sale cerca de 0.57 solo por suerte.
- **El freno de tendencia no mejoró el entrenamiento** en ningún perfil. Queda apagado.
- **Este es el marcador del modelo de Felipe y Brisma:** un buen modelo hace útil el filtro de expectativa. Se mide con `--modelo model`.

## Evaluación de pronósticos (`evaluate_forecasts.py`)

Mide si las predicciones dicen la verdad, aparte de si se ganó dinero. Sirve para el baseline y para el modelo del equipo.

```bash
python -m decision.evaluate_forecasts --desde 2022-01-01                 # baseline
python -m decision.evaluate_forecasts --desde 2022-01-01 --modelo model  # modelo del equipo
```

Resultado del 24 oct 2026, **baseline**, 1,218 ventanas de 30 días (21 activos, 2022-hoy):

| Qué se mide | Meta | Baseline |
|---|---|---|
| Precio real dentro del intervalo del 90 % | 90 % | **92 %** |
| Precio real abajo del extremo bajo | 5 % | **4 %** |
| Brier de la probabilidad de pérdida (menor es mejor) | menor que el ingenuo (0.246) | 0.252 |
| Skill contra el ingenuo | > 0 | -2.4 % |
| IC de rango, esperado contra real | > 0 | -0.06 |

Lo que dicen los números:
- **El intervalo está bien calibrado.** De su extremo bajo depende cuánto invierte la app, y por eso el tamaño por riesgo funciona.
- **Las colas gordas se notan en cripto y NVDA:** el precio cae abajo del extremo bajo 9-10 % de las veces, no 5 %.
- **La dirección no se predice.** La probabilidad de pérdida es un poco peor que la frecuencia histórica, y el orden de los rendimientos esperados va ligeramente al revés (IC por activo de -0.04 a -0.36). El promedio de 3 años mezcla la continuidad de 1-12 meses con la reversión de 13-36 meses.
- **Meta para el modelo del equipo:** skill > 0 e IC > 0, sin perder la cobertura del intervalo.

Valores por defecto en `rules.py`: los que eligió el entrenamiento en los tres perfiles (con filtro, sin freno). Se probaron 6 configuraciones, con 19 y luego con 21 activos; no hubo otras pruebas.

Limitaciones:
- El efectivo rinde 0 % y no hay comisiones.
- Los 21 activos se eligieron en 2026 (sesgo de supervivencia).
- El calendario de bancos centrales empieza en oct 2026, así que el freno de evento no está en el backtest.
- La prueba tiene 57 ventanas de cartera: poco para separar diferencias chicas de Sharpe del ruido.
