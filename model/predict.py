"""The model the API uses. Main: Brisma's Trend + TDA. Backup: Felipe's XGBoost.

Picked with the MODELO variable (default "tda"; "xgboost" for the backup).
Without this file, the API falls back to the baseline.
"""

import os

if os.getenv("MODELO", "tda").lower() == "xgboost":
    from model.predict_xgboost import NOMBRE, predict
else:
    from model.predict_tda import NOMBRE, predict

__all__ = ["NOMBRE", "predict"]
