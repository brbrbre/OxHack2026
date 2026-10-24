"""Modelo que usa la API. Principal: tendencia + TDA de Brisma. Respaldo: XGBoost de Felipe.

Se elige con la variable MODELO (por defecto "tda"; "xgboost" para el respaldo).
Para volver al baseline, borrar este archivo.
"""

import os

if os.getenv("MODELO", "tda").lower() == "xgboost":
    from model.predict_xgboost import NOMBRE, predict
else:
    from model.predict_tda import NOMBRE, predict

__all__ = ["NOMBRE", "predict"]
