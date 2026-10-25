"""API that connects the React app with the data, the model and the decision rule.

Run locally:
    uvicorn api.main:app --reload --port 8000

Route contract: api/README.md. If app/dist exists (the built React app), it is
also served at "/", so the demo is a single program.
"""

from __future__ import annotations

import importlib
import inspect
import json
import os
import re
import threading
import time
from datetime import date, timedelta
from pathlib import Path
from typing import Literal
from urllib.parse import urlencode

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from api import baseline
from api.selected_plan import SelectedPlanRequest, build_selected_plan
from data.assets import ASSETS, all_symbols
from data.fetch import get_close, is_crypto
from decision.plan import plan as armar_plan
from decision.rules import decide
from decision.signals import tendencia
from explain import asesor, resumen, voz
from tiger import db as tiger
from habito import almacen as habito_db, ciclo as habito_ciclo, mensajes as habito_mensajes

# Sponsor keys (GEMINI_API_KEY, ELEVENLABS_API_KEY, TIGER_DATABASE_URL) live in .env, outside the repo.
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


# --- Model: Trend + TDA (or XGBoost with MODELO=xgboost); the baseline if neither loads ---

def load_model():
    """Uses model/predict.py if it exists and has predict(); otherwise the baseline."""
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


# --- Errors shaped as {"error": "text"} -------------------------------------

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
        # Stored so it can be graded once the horizon passes (python -m tiger.cargar --calificar).
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


@app.post("/api/plan/selected")
def selected_plan_route(req: SelectedPlanRequest):
    """The same plan engine, restricted to chosen assets with concentration permitted."""
    try:
        return build_selected_plan(req, catalog=ASSETS, get_close=get_close, run_prediction=run_prediction,
                                   load_model=load_model, notice=AVISO, hoy=date.today())
    except ValueError as e:
        raise HTTPException(400, str(e))


# --- Summary (Gemini) and audio (ElevenLabs): they only write and read, never decide ---

@app.post("/api/summary/decide")
def summary_decide(req: DecideRequest):
    return resumen.resumir_decision(decide_route(req))


@app.post("/api/summary/plan")
def summary_plan(req: PlanRequest):
    return resumen.resumir_plan(plan_route(req))


@app.post("/api/summary/plan/selected")
def summary_selected_plan(req: SelectedPlanRequest):
    return resumen.resumir_plan(selected_plan_route(req))


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
    """Ask Horizon (Gemini): explains the asset and money concepts; never decides."""
    if req.simbolo is not None:
        _check_symbol(req.simbolo)
    if len(json.dumps(req.contexto)) > 3000:
        raise HTTPException(400, "Context is too long")
    return asesor.responder(req.pregunta, req.simbolo, _nombre(req.simbolo) if req.simbolo else None,
                            req.contexto, [t.model_dump() for t in req.historial])


# --- Make it a habit: WhatsApp reminder (Gemini drafts it) and call (ElevenLabs voice) ---

_habito = None


def habito_conn():
    global _habito
    if _habito is None:
        _habito = habito_db.conectar()
    return _habito


class RemindRequest(BaseModel):
    """One asset (simbolo) or a "Help me choose" plan (tipos)."""
    telefono: str = Field(min_length=8, max_length=20)
    consentimiento: bool
    simbolo: str | None = None
    tipos: list[str] | None = None
    monto: float = Field(gt=0, le=1e9)
    plazo_dias: int = Field(ge=1, le=730)
    perfil: Literal["conservador", "moderado", "agresivo"] = "moderado"


def _vista(rec: dict) -> dict:
    claves = ("token", "vence", "estado", "enviado_en", "abierto_en", "llamado_en", "error", "simbolo", "plazo_dias",
              "mensaje_estado", "llamada_estado", "tipos")
    return {k: rec[k] for k in claves} | {"demo": os.getenv("HABITO_DEMO") == "1"}


NOMBRE_PLAN = "your portfolio"


def _plan_hoy(monto: float, plazo_dias: int, perfil: str, tipos: list[str]) -> dict:
    """Today's plan, shaped the way the reminder texts expect."""
    r = plan_route(PlanRequest(monto=monto, plazo_dias=plazo_dias, perfil=perfil, tipos=tipos))
    n = r["numeros"]
    return {"decision": "INVERTIR" if n["invertido"] > 0 else "ESPERAR",
            "activos": ", ".join(a["nombre"] for a in r["cartera"]),
            "numeros": {"monto": n["monto"], "monto_sugerido": n["invertido"], "plazo_dias": n["plazo_dias"],
                        "rendimiento_esperado": n["rendimiento_esperado"], "prob_perdida": None}}


def _decidir_hoy(rec: dict) -> dict:
    if rec.get("tipos"):
        return _plan_hoy(rec["monto"], rec["plazo_dias"], rec["perfil"], rec["tipos"].split(","))
    return decide_route(DecideRequest(simbolo=rec["simbolo"], monto=rec["monto"], plazo_dias=rec["plazo_dias"],
                                      perfil=rec["perfil"]))


@app.post("/api/habit/remind")
def habit_remind(req: RemindRequest):
    """Saves the reminder. It is due when the horizon ends; the stored answer is today's."""
    telefono = req.telefono.replace(" ", "")
    if not req.consentimiento:
        raise HTTPException(400, "Please agree to receive the reminder")
    if not re.fullmatch(r"\+[1-9][0-9]{7,14}", telefono):
        raise HTTPException(400, "Use the international format, for example +15550100123")
    if telefono not in habito_ciclo.permitidos():
        raise HTTPException(403, "In this demo, reminders only go to the team's verified numbers")
    if req.tipos:
        hoy = _plan_hoy(req.monto, req.plazo_dias, req.perfil, req.tipos)
        rec = habito_db.crear(habito_conn(), telefono, "PLAN", NOMBRE_PLAN, req.monto, req.plazo_dias, req.perfil,
                              hoy["decision"], float(hoy["numeros"]["monto_sugerido"]), tipos=req.tipos)
        return _vista(rec)
    if not req.simbolo:
        raise HTTPException(400, "Choose an asset or a plan")
    _check_symbol(req.simbolo)
    hoy = decide_route(DecideRequest(simbolo=req.simbolo, monto=req.monto, plazo_dias=req.plazo_dias, perfil=req.perfil))
    rec = habito_db.crear(habito_conn(), telefono, req.simbolo, _nombre(req.simbolo), req.monto, req.plazo_dias,
                          req.perfil, hoy["decision"], float(hoy["numeros"].get("monto_sugerido", req.monto)))
    return _vista(rec)


@app.get("/api/habit/{token}")
def habit_status(token: str):
    rec = habito_db.obtener(habito_conn(), token)
    if not rec:
        raise HTTPException(404, "Reminder not found")
    try:  # the panel asks every 4 s, so it sees what Twilio says now, not what it said on accepting
        rec = habito_ciclo.revisar(habito_conn(), rec, habito_db.ahora())
    except Exception:
        pass
    return _vista(rec)


@app.post("/api/habit/{token}/now")
def habit_now(token: str):
    """Demo only: makes the reminder due now and runs the cycle, so nobody waits 180 days."""
    if os.getenv("HABITO_DEMO") != "1":
        raise HTTPException(403, "Demo mode is off")
    conn = habito_conn()
    if not habito_db.obtener(conn, token):
        raise HTTPException(404, "Reminder not found")
    habito_db.actualizar(conn, token, vence=habito_db.iso(habito_db.ahora()))
    habito_ciclo.procesar(conn, habito_db.ahora(), _decidir_hoy, voz=voz)
    return _vista(habito_db.obtener(conn, token))


@app.get("/r/{token}")
def habit_open(token: str):
    """The WhatsApp link: opens the app with the same plan. Nothing is marked here, because
    WhatsApp's link-preview robot also visits the link. The app marks it when it loads
    (POST .../open): a robot doesn't run JavaScript."""
    rec = habito_db.obtener(habito_conn(), token)
    if not rec:
        return RedirectResponse("/")
    plan = {"view": "planner", "modo": "plan", "tipos": rec["tipos"]} if rec.get("tipos") else {"simbolo": rec["simbolo"]}
    q = urlencode(plan | {"monto": int(rec["monto"]), "plazo": rec["plazo_dias"], "perfil": rec["perfil"],
                          "recordatorio": token})
    return RedirectResponse(f"/?{q}")


@app.post("/api/habit/{token}/open")
def habit_mark_open(token: str):
    """The app loaded from the reminder link: it counts as opened and, if the call already went out, it is cut."""
    conn = habito_conn()
    rec = habito_db.obtener(conn, token)
    if not rec:
        raise HTTPException(404, "Reminder not found")
    habito_ciclo.abrir(conn, rec, habito_db.ahora())
    return _vista(habito_db.obtener(conn, token))


@app.get("/api/habit/audio/{token}.mp3")
def habit_audio(token: str):
    rec = habito_db.obtener(habito_conn(), token)
    datos = voz.audio(habito_mensajes.guion_llamada(rec)) if rec else None
    if datos is None:
        raise HTTPException(404, "No audio")
    return Response(content=datos, media_type="audio/mpeg")


def _ciclo_en_fondo():
    while True:
        try:
            habito_ciclo.procesar(habito_conn(), habito_db.ahora(), _decidir_hoy, voz=voz)
        except Exception:
            pass
        time.sleep(20)


if os.getenv("HABITO_AUTO") == "1":
    threading.Thread(target=_ciclo_en_fondo, daemon=True).start()


# The built React app, if present. Mounted last so it doesn't shadow /api.
if APP_DIST.is_dir():
    app.mount("/", StaticFiles(directory=APP_DIST, html=True), name="app")
