"""Tiger Data: lo que se puede probar sin base (filas y que todo sea opcional). La carga real se prueba con la URL."""

import pandas as pd

from tiger import cargar, db


def test_sin_url_no_hace_nada():
    assert db.url() is None
    db.guardar_en_vivo(("x",))  # no debe lanzar


def test_filas_de_precios_en_utc():
    s = pd.Series([1.0, None, 2.0], index=pd.to_datetime(["2026-10-20", "2026-10-21", "2026-10-22"]))
    filas = cargar.filas_precios("SPY", s)
    assert len(filas) == 2 and str(filas[0][0].tz) == "UTC" and filas[1][1:] == ("SPY", 2.0)


def test_filas_del_backtest_traen_el_resultado_real():
    df = pd.DataFrame([{"fecha": pd.Timestamp("2022-01-03").date(), "esperado": 0.01, "bajo": -0.05, "alto": 0.07,
                        "prob_perdida": 0.4, "fraccion": 0.8, "decision": "INVERTIR", "real": 0.02}])
    (fila,) = cargar.filas_backtest(df, "SPY", 30, "xgboost", "moderado")
    assert len(fila) == len(db.COLUMNAS_PRED)
    assert fila[1:6] == ("SPY", 30, "xgboost", "backtest", "moderado") and fila[-1] == 0.02


def test_decide_no_toca_tiger_sin_url(monkeypatch):
    from fastapi.testclient import TestClient
    from api import main
    from tests.test_api import _serie
    llamadas = []
    monkeypatch.setattr(main, "get_close", lambda s: _serie(0.001))
    monkeypatch.setattr(main, "load_model", lambda: (None, main.baseline.NOMBRE))
    monkeypatch.setattr(main.tiger, "guardar_en_vivo", lambda f: llamadas.append(f))
    assert TestClient(main.app).post("/api/decide", json={"simbolo": "SPY", "monto": 1000, "plazo_dias": 30}).status_code == 200
    assert llamadas == []


def test_decide_guarda_la_prediccion_con_url(monkeypatch):
    import threading
    from fastapi.testclient import TestClient
    from api import main
    from tests.test_api import _serie
    llamadas = []
    monkeypatch.setenv("TIGER_DATABASE_URL", "postgres://falsa")
    monkeypatch.setattr(main, "get_close", lambda s: _serie(0.001))
    monkeypatch.setattr(main, "load_model", lambda: (None, main.baseline.NOMBRE))
    monkeypatch.setattr(main.tiger, "guardar_en_vivo", lambda f: llamadas.append(f))
    monkeypatch.setattr(threading, "Thread", lambda target, args, daemon: type("T", (), {"start": lambda self: target(*args)})())
    TestClient(main.app).post("/api/decide", json={"simbolo": "SPY", "monto": 1000, "plazo_dias": 30})
    (fila,) = llamadas
    assert fila[1:5] == ("SPY", 30, "baseline", "live") and fila[-1] is None and len(fila) == len(db.COLUMNAS_PRED)


def test_en_utc_acepta_fechas_con_y_sin_zona():
    assert str(db.en_utc("2026-10-23").tz) == "UTC"
    assert db.en_utc(pd.Timestamp("2026-10-23 01:00", tz="Europe/London")).hour == 0
