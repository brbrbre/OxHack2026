"""API que conecta la app de React con los datos, el modelo y la regla de decisión.

Correr en local:
    uvicorn api.main:app --reload --port 8000

Contrato de las rutas: api/README.md. Si existe app/dist (la app de React ya
compilada), también la sirve en "/", así se publica un solo programa.
"""

from __future__ import annotations

import importlib
import inspect
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api import baseline
from data.assets import ASSETS, all_symbols
from data.fetch import get_close, is_crypto
from decision.plan import plan as armar_plan
from decision.rules import decide
from decision.signals import tendencia

AVISO = "Educational prototype, not financial advice. Data: Yahoo Finance, Binance."
APP_DIST = Path(__file__).resolve().parent.parent / "app" / "dist"

app = FastAPI(title="OxHack 2026 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


# --- Modelo: el de Felipe y Brisma si existe; si no, el baseline --------------

def load_model():
    """Usa model/predict.py si existe y tiene predict(); si no, el baseline."""
    try:
        mod = importlib.import_module("model.predict")
        return mod.predict, getattr(mod, "NOMBRE", "model")
    except (ImportError, AttributeError):
        return None, baseline.NOMBRE


def run_prediction(precios, plazo_dias: int, simbolo: str) -> tuple[dict, str]:
    predict, nombre = load_model()
    if predict is None:
        return baseline.predict(precios, plazo_dias, es_cripto=is_crypto(simbolo)), nombre
    es_cripto = is_crypto(simbolo)
    if "es_cripto" in inspect.signature(predict).parameters:
        return predict(precios, plazo_dias, es_cripto=es_cripto), nombre
    return predict(precios, plazo_dias), nombre


# --- Errores con la forma {"error": "texto"} ----------------------------------

@app.exception_handler(HTTPException)
async def http_error(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    campos = ", ".join(str(e["loc"][-1]) for e in exc.errors())
    return JSONResponse(status_code=400, content={"error": f"Invalid fields: {campos}"})


def _check_symbol(simbolo: str) -> None:
    if simbolo not in all_symbols():
        raise HTTPException(404, f"Unknown asset: {simbolo}")


def _nombre(simbolo: str) -> str:
    for grupo in ASSETS.values():
        if simbolo in grupo:
            return grupo[simbolo]
    return simbolo


# --- Rutas ---------------------------------------------------------------------

@app.get("/api/assets")
def assets():
    return {g: [{"simbolo": s, "nombre": n} for s, n in d.items()] for g, d in ASSETS.items()}


@app.get("/api/prices/{simbolo}")
def prices(simbolo: str, dias: int = 365):
    _check_symbol(simbolo)
    if not 1 <= dias <= 365 * 30:
        raise HTTPException(400, "dias must be between 1 and 10950")
    serie = get_close(simbolo)
    serie = serie[serie.index >= serie.index.max() - timedelta(days=dias)]
    return {
        "simbolo": simbolo,
        "fechas": [d.strftime("%Y-%m-%d") for d in serie.index],
        "cierres": [round(float(x), 4) for x in serie.values],
    }


class DecideRequest(BaseModel):
    simbolo: str
    monto: float = Field(gt=0, le=1e9)
    plazo_dias: int = Field(ge=1, le=730)
    perfil: Literal["conservador", "moderado", "agresivo"] = "moderado"


@app.post("/api/decide")
def decide_route(req: DecideRequest):
    _check_symbol(req.simbolo)
    precios = get_close(req.simbolo)
    try:
        pred, nombre_modelo = run_prediction(precios, req.plazo_dias, req.simbolo)
    except ValueError as e:
        raise HTTPException(400, str(e))
    r = decide(pred, req.monto, req.plazo_dias, req.simbolo, hoy=date.today(), perfil=req.perfil,
               tendencia=tendencia(precios))
    numeros = {k: v for k, v in r["numeros"].items() if k != "simbolo"}
    return {
        "simbolo": req.simbolo,
        "nombre": _nombre(req.simbolo),
        "decision": r["decision"],
        "razones": r["razones"],
        "recomendaciones": r["recomendaciones"],
        "numeros": numeros,
        "modelo": nombre_modelo,
        "aviso": AVISO,
    }


class PlanRequest(BaseModel):
    monto: float = Field(gt=0, le=1e9)
    plazo_dias: int = Field(ge=1, le=730)
    perfil: Literal["conservador", "moderado", "agresivo"] = "moderado"
    tipos: list[str] = Field(min_length=1)


@app.post("/api/plan")
def plan_route(req: PlanRequest):
    desconocidos = [t for t in req.tipos if t not in ASSETS]
    if desconocidos:
        raise HTTPException(400, f"Unknown asset types: {', '.join(desconocidos)}")
    grupos = {t: list(ASSETS[t]) for t in ASSETS if t in req.tipos}
    simbolos = [s for g in grupos.values() for s in g]
    precios = {s: get_close(s) for s in simbolos}
    nombres = {s: _nombre(s) for s in simbolos}
    _, nombre_modelo = load_model()

    def predecir(simbolo, serie):
        return run_prediction(serie, req.plazo_dias, simbolo)[0]

    try:
        r = armar_plan(req.monto, req.plazo_dias, req.perfil, grupos, precios, nombres, predecir, hoy=date.today())
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {**r, "modelo": nombre_modelo, "aviso": AVISO}


# La app de React compilada, si existe. Va al final para no tapar /api.
if APP_DIST.is_dir():
    app.mount("/", StaticFiles(directory=APP_DIST, html=True), name="app")
