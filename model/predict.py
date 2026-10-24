"""Model used by the API: trend + topology (TDA) with real tails.

The implementation lives in model/predict_tda.py and is trained in
model/modelo_regresion_tda.ipynb (which saves model/params_tda.json).
To go back to the baseline, delete this file.
"""

from model.predict_tda import NOMBRE, predict

__all__ = ["NOMBRE", "predict"]
