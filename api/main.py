"""API que conecta la app de React con los datos, el modelo y la regla de decisión.

Correr en local:
    uvicorn api.main:app --reload --port 8000

Contrato de las rutas: api/README.md. Si existe app/dist (la app de React ya
compilada), también la sirve en "/", así se publica un solo programa.
"""

from __future__ import annotations

import importlib
import inspect
import json
import threading
from datetime import date, timedelta
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api import baseline
from data.assets import ASSETS, all_symbols
from data.fetch import get_close, is_crypto
from decision.plan import plan as armar_plan
from decision.rules import decide
from decision.signals import tendencia
from explain import asesor, resumen, voz
from tiger import db as tiger

# Claves de los sponsors (GEMINI_API_KEY, ELEVENLABS_API_KEY, TIGER_DATABASE_URL) en .env, fuera del repo.
load_dotenv()

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
    if tiger.url():
        # Se guarda para calificarla cuando pase el plazo (python -m tiger.cargar --calificar).
        fila = (tiger.en_utc(precios.index[-1]), req.simbolo, req.plazo_dias, nombre_modelo, "live", req.perfil,
                float(pred["rendimiento_esperado"]), float(pred["intervalo"][0]), float(pred["intervalo"][1]),
                float(pred["prob_perdida"]), float(numeros.get("fraccion", 0.0)), r["decision"], None)
        threading.Thread(target=tiger.guardar_en_vivo, args=(fila,), daemon=True).start()
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


# --- Resumen (Gemini) y audio (ElevenLabs): solo redactan y leen, nunca deciden ---

@app.post("/api/summary/decide")
def summary_decide(req: DecideRequest):
    return resumen.resumir_decision(decide_route(req))


@app.post("/api/summary/plan")
def summary_plan(req: PlanRequest):
    return resumen.resumir_plan(plan_route(req))


class ListenRequest(BaseModel):
    texto: str = Field(min_length=1, max_length=resumen.LARGO_MAXIMO)


@app.post("/api/listen")
def listen(req: ListenRequest):
    if req.texto not in resumen.generados:
        raise HTTPException(400, "Only summaries made by this server can be read aloud")
    datos = voz.audio(req.texto)
    if datos is None:
        raise HTTPException(503, "Audio is not available right now")
    return Response(content=datos, media_type="audio/mpeg")


class Turno(BaseModel):
    pregunta: str = Field(max_length=asesor.LARGO_PREGUNTA)
    respuesta: str = Field(max_length=asesor.LARGO_RESPUESTA)


class AskRequest(BaseModel):
    pregunta: str = Field(min_length=2, max_length=asesor.LARGO_PREGUNTA)
    simbolo: str | None = None
    contexto: dict = Field(default_factory=dict)
    historial: list[Turno] = Field(default_factory=list, max_length=asesor.TURNOS)


@app.post("/api/ask")
def ask(req: AskRequest):
    """Tutor de dudas (Gemini): explica el activo y conceptos de finanzas; nunca decide."""
    if req.simbolo is not None:
        _check_symbol(req.simbolo)
    if len(json.dumps(req.contexto)) > 3000:
        raise HTTPException(400, "Context is too long")
    return asesor.responder(req.pregunta, req.simbolo, _nombre(req.simbolo) if req.simbolo else None,
                            req.contexto, [t.model_dump() for t in req.historial])


# La app de React compilada, si existe. Va al final para no tapar /api.
if APP_DIST.is_dir():
    app.mount("/", StaticFiles(directory=APP_DIST, html=True), name="app")
