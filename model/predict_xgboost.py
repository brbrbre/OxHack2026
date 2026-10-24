import numpy as np
import pandas as pd
from xgboost import XGBRegressor, XGBClassifier

NOMBRE = "xgboost"

PARAMETROS = {
    "n_estimators": 100,
    "max_depth": 2,
    "learning_rate": 0.03,
    "random_state": 42,
    "n_jobs": 1,
}


def predict(precios, plazo_dias, es_cripto=False):
    if plazo_dias <= 0:
        raise ValueError("plazo_dias debe ser positivo.")

    # Usar únicamente los precios recibidos
    precios = precios.astype(float).sort_index().dropna()
    precios = precios[~precios.index.duplicated(keep="last")]

    if not np.isfinite(precios).all() or (precios <= 0).any():
        raise ValueError("Los precios deben ser positivos y finitos.")

    # Conversión aproximada de calendario a sesiones
    horizonte = max(
        1,
        int(round(plazo_dias * (1 if es_cripto else 252 / 365)))
    )

    # Variables independientes: solo información conocida
    variables = pd.DataFrame(index=precios.index)
    variables["rendimiento_hoy"] = precios.pct_change(fill_method=None)
    variables["rendimiento_ayer"] = variables["rendimiento_hoy"].shift(1)
    variables["volatilidad_20"] = (
        variables["rendimiento_hoy"].rolling(20).std()
    )

    # Variable dependiente: rendimiento futuro
    objetivo = (
        precios.shift(-horizonte) / precios - 1
    ).rename("objetivo")

    # Las últimas filas sin etiqueta quedan fuera del entrenamiento
    entrenamiento = variables.join(objetivo).dropna()

    if len(entrenamiento) < 100:
        raise ValueError("Historial insuficiente para este plazo.")

    X = entrenamiento.drop(columns="objetivo")
    y = entrenamiento["objetivo"]

    # Última observación conocida: se utiliza para predecir
    ultima = variables.iloc[[-1]]

    # 1. Tu regresión actual: rendimiento esperado
    regresor = XGBRegressor(
        objective="reg:squarederror",
        **PARAMETROS
    )
    regresor.fit(X, y)

    rendimiento = float(regresor.predict(ultima)[0])
    rendimiento = max(rendimiento, -0.999999)

    # 2. Cuantiles para construir el intervalo
    cuantiles = XGBRegressor(
        objective="reg:quantileerror",
        quantile_alpha=np.array([0.05, 0.50, 0.95]),
        **PARAMETROS
    )
    cuantiles.fit(X, y)

    q05, q50, q95 = np.sort(cuantiles.predict(ultima)[0])

    bajo = max(float(q05), -0.999999)
    alto = max(float(q95), bajo + 1e-8)

    volatilidad = (alto - bajo) / 3.29

    # 3. Clasificación: probabilidad estimada de pérdida
    y_baja = (y < 0).astype(int)

    if y_baja.nunique() < 2:
        prob_perdida = float(y_baja.iloc[0])
    else:
        clasificador = XGBClassifier(
            objective="binary:logistic",
            eval_metric="logloss",
            **PARAMETROS
        )
        clasificador.fit(X, y_baja)
        prob_perdida = float(
            clasificador.predict_proba(ultima)[0, 1]
        )

    return {
        "rendimiento_esperado": rendimiento,
        "volatilidad": float(volatilidad),
        "prob_perdida": prob_perdida,
        "intervalo": (bajo, alto),
    }