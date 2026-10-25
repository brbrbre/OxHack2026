"""Hábito: recordatorio, WhatsApp y llamada. Sin red: Twilio, Gemini y ElevenLabs van simulados."""

from datetime import datetime, timedelta, timezone

import pytest

from habito import almacen, ciclo, mensajes, twilio

T0 = datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc)


def _hoy(decision="INVERTIR", sugerido=800.0):
    return {"decision": decision, "numeros": {"monto": 1000.0, "monto_sugerido": sugerido, "plazo_dias": 180,
                                              "rendimiento_esperado": 0.05, "prob_perdida": 0.35}}


def _rec(conn, decision="ESPERAR", plazo=180):
    return almacen.crear(conn, "+15550100123", "WALMEX.MX", "Walmart de México", 1000.0, plazo, "moderado",
                         decision, 579.0, cuando=T0)


class Enviar:
    """Twilio simulado: devuelve SIDs y contesta el estado que diga la prueba."""

    def __init__(self, falla=False, llamada="queued", mensaje="sent"):
        self.wa, self.llamadas, self.falla = [], [], falla
        self.estado_de_llamada, self.estado_del_mensaje = llamada, mensaje

    def mensaje(self, tel, texto):
        if self.falla:
            raise RuntimeError("Twilio 400")
        self.wa.append((tel, texto))
        return "SM1"

    def llamar(self, tel, url, texto):
        self.llamadas.append((tel, url, texto))
        return "CA1"

    def colgar(self, sid, estado):
        self.colgadas = getattr(self, "colgadas", []) + [sid]

    def estado_mensaje(self, sid):
        return self.estado_del_mensaje

    def estado_llamada(self, sid):
        return self.estado_de_llamada


class Voz:
    def audio(self, texto):
        return b"ID3"


@pytest.fixture
def conn(tmp_path):
    return almacen.conectar(tmp_path / "h.sqlite")


def test_vence_al_terminar_el_plazo(conn):
    rec = _rec(conn)
    assert rec["vence"].startswith("2027-04-23") and rec["estado"] == "pendiente"
    assert almacen.vencidos(conn, T0 + timedelta(days=179)) == []
    assert len(almacen.vencidos(conn, T0 + timedelta(days=180))) == 1


def test_plantilla_de_espera_y_de_plan():
    rec = {"nombre": "Walmart de México", "decision": "ESPERAR", "plazo_dias": 180, "sugerido": 579.0, "monto": 1000.0}
    texto, fuente = mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: None)
    assert fuente == "template" and "waiting period has ended" in texto and texto.endswith("http://x/r/abc")
    rec["decision"] = "INVERTIR"
    assert "Your plan for Walmart de México has ended" in mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: None)[0]


def test_texto_de_un_plan():
    rec = {"nombre": "your portfolio", "decision": "INVERTIR", "plazo_dias": 90, "sugerido": 800.0, "monto": 1000.0}
    hoy = {"decision": "INVERTIR", "activos": "Nasdaq 100, Apple",
           "numeros": {"monto": 1000.0, "monto_sugerido": 700.0, "plazo_dias": 90, "rendimiento_esperado": 0.02,
                       "prob_perdida": None}}
    h = mensajes.hechos(rec, hoy, "http://x/r/abc")
    assert h["today_assets"] == "Nasdaq 100, Apple" and h["today_chance_of_loss"] == "not computed for a plan"
    texto, fuente = mensajes.whatsapp(rec, hoy, "http://x/r/abc", llamar=lambda h: None)
    assert fuente == "template" and "your portfolio" in texto and texto.endswith("\n\nhttp://x/r/abc")


def test_gemini_solo_si_trae_link_y_activo():
    rec = {"nombre": "Walmart de México", "decision": "ESPERAR", "plazo_dias": 180, "sugerido": 579.0, "monto": 1000.0}
    bueno = "Hi! Your wait on Walmart de México is over. Today: invest $800. Review: http://x/r/abc"
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: bueno) == (
        "Hi! Your wait on Walmart de México is over. Today: invest $800. Review:\n\nhttp://x/r/abc", "gemini")
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: "Hi! Walmart de México is great.")[1] == "template"
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: "Review http://x/r/abc")[1] == "template"


def test_el_link_va_solo_en_la_ultima_linea():
    assert mensajes.link_aparte("Check it here: http://x/r/a", "http://x/r/a") == "Check it here:\n\nhttp://x/r/a"
    assert mensajes.link_aparte("Open http://x/r/a to review.", "http://x/r/a") == "Open\n\nhttp://x/r/a\nto review"
    rec = {"nombre": "Walmart de México", "decision": "ESPERAR", "plazo_dias": 180, "sugerido": 579.0, "monto": 1000.0}
    texto, _ = mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: None)
    assert texto.endswith("\n\nhttp://x/r/abc")


def test_si_abre_mientras_se_prepara_la_llamada_no_llama(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "0")
    rec = _rec(conn)
    almacen.actualizar(conn, rec["token"], estado="enviado", enviado_en=almacen.iso(T0))
    env = Enviar()

    class VozQueAbre:  # mientras ElevenLabs genera el audio, la persona abre el link
        def audio(self, texto):
            almacen.actualizar(conn, rec["token"], abierto_en=almacen.iso(T0))
            return b"ID3"

    assert ciclo.procesar(conn, T0, lambda r: _hoy(), enviar=env, voz=VozQueAbre())["llamadas"] == 0
    assert env.llamadas == []


def test_si_abre_con_la_llamada_en_curso_se_cuelga(conn):
    rec = _rec(conn)
    almacen.actualizar(conn, rec["token"], estado="llamando", llamada_sid="CA7", llamada_estado="ringing")
    colgadas = []
    ciclo.abrir(conn, almacen.obtener(conn, rec["token"]), T0, colgar=lambda sid, e: colgadas.append((sid, e)))
    r = almacen.obtener(conn, rec["token"])
    assert colgadas == [("CA7", "ringing")] and r["estado"] == "abierto" and r["llamada_estado"] == "canceled"
    ciclo.abrir(conn, r, T0, colgar=lambda sid, e: colgadas.append(sid))  # abrir dos veces no cuelga dos veces
    assert len(colgadas) == 1


def test_si_abre_justo_cuando_sale_la_llamada_se_corta(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "0")
    rec = _rec(conn)
    almacen.actualizar(conn, rec["token"], estado="enviado", enviado_en=almacen.iso(T0))
    env = Enviar()
    original = env.llamar

    def llamar_y_abrir(tel, url, texto):
        almacen.actualizar(conn, rec["token"], abierto_en=almacen.iso(T0), estado="abierto")
        return original(tel, url, texto)

    env.llamar = llamar_y_abrir
    ciclo.procesar(conn, T0, lambda r: _hoy(), enviar=env)
    r = almacen.obtener(conn, rec["token"])
    assert env.colgadas == ["CA1"] and r["estado"] == "abierto" and r["llamada_estado"] == "canceled"


def test_ciclo_manda_whatsapp_y_llama_si_no_abre(conn, monkeypatch):
    monkeypatch.setenv("PUBLIC_URL", "http://95.0.0.1")
    monkeypatch.setenv("HABITO_ESPERA_MIN", "2")
    rec = _rec(conn)
    env = Enviar()
    vence = T0 + timedelta(days=180)
    assert ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env, voz=Voz())["enviados"] == 1
    assert env.wa[0][0] == "+15550100123" and f"http://95.0.0.1/r/{rec['token']}" in env.wa[0][1]
    assert ciclo.procesar(conn, vence + timedelta(minutes=1), lambda r: _hoy(), enviar=env, voz=Voz())["llamadas"] == 0
    assert ciclo.procesar(conn, vence + timedelta(minutes=3), lambda r: _hoy(), enviar=env, voz=Voz())["llamadas"] == 1
    tel, url, texto = env.llamadas[0]
    assert url == f"http://95.0.0.1/api/habit/audio/{rec['token']}.mp3" and "waiting period" in texto
    r = almacen.obtener(conn, rec["token"])
    assert r["estado"] == "llamando" and r["llamada_sid"] == "CA1" and r["llamado_en"] is None
    env.estado_de_llamada = "completed"
    ciclo.procesar(conn, vence + timedelta(minutes=4), lambda r: _hoy(), enviar=env, voz=Voz())
    r = almacen.obtener(conn, rec["token"])
    assert r["estado"] == "llamado" and r["llamada_estado"] == "completed" and r["llamado_en"] is not None
    assert len(env.llamadas) == 1


@pytest.mark.parametrize("estado", ["busy", "no-answer", "failed", "canceled"])
def test_llamada_sin_contestar_no_cuenta_como_llamado(conn, monkeypatch, estado):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "0")
    rec = _rec(conn)
    env = Enviar(llamada=estado)
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    r = almacen.obtener(conn, rec["token"])
    assert r["estado"] == "sin_respuesta" and r["llamada_estado"] == estado and r["llamado_en"] is None
    assert len(env.llamadas) == 1


def test_estado_del_whatsapp(conn):
    rec = _rec(conn)
    env = Enviar(mensaje="undelivered")
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    assert almacen.obtener(conn, rec["token"])["mensaje_estado"] == "queued"
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    assert almacen.obtener(conn, rec["token"])["mensaje_estado"] == "undelivered"
    env.estado_del_mensaje = "delivered"  # ya es final: no se vuelve a preguntar
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    assert almacen.obtener(conn, rec["token"])["mensaje_estado"] == "undelivered"
    assert almacen.por_revisar(conn) == []


def test_si_twilio_no_responde_el_ciclo_sigue(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "2")
    rec = _rec(conn)
    env = Enviar()
    env.estado_mensaje = lambda sid: (_ for _ in ()).throw(RuntimeError("Twilio 503"))
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    assert ciclo.procesar(conn, vence + timedelta(minutes=3), lambda r: _hoy(), enviar=env)["llamadas"] == 1
    assert almacen.obtener(conn, rec["token"])["estado"] == "llamando"


def test_base_vieja_recibe_las_columnas_nuevas(tmp_path):
    import sqlite3
    archivo = tmp_path / "vieja.sqlite"
    vieja = sqlite3.connect(archivo)
    vieja.execute(almacen.ESQUEMA)
    vieja.commit()
    vieja.close()
    columnas = {f["name"] for f in almacen.conectar(archivo).execute("PRAGMA table_info(recordatorios)")}
    assert set(almacen.NUEVAS) <= columnas


def test_si_abre_el_link_no_llama(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "2")
    rec = _rec(conn)
    env = Enviar()
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    almacen.actualizar(conn, rec["token"], abierto_en=almacen.iso(vence), estado="abierto")
    assert ciclo.procesar(conn, vence + timedelta(hours=1), lambda r: _hoy(), enviar=env)["llamadas"] == 0


def test_sin_audio_twilio_lee_el_texto(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "0")
    _rec(conn)
    env = Enviar()
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env, voz=None)
    assert env.llamadas[0][1] is None


def test_error_de_twilio_queda_guardado(conn):
    rec = _rec(conn)
    assert ciclo.procesar(conn, T0 + timedelta(days=180), lambda r: _hoy(), enviar=Enviar(falla=True))["errores"] == 1
    r = almacen.obtener(conn, rec["token"])
    assert r["estado"] == "error" and "Twilio 400" in r["error"]


def test_twilio_arma_las_peticiones(monkeypatch):
    llamadas = []

    class Resp:
        status_code = 201
        def json(self):
            return {"sid": "SM1"}

    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC123")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "tok")
    monkeypatch.setenv("TWILIO_WHATSAPP_FROM", "+14155550000")
    monkeypatch.setenv("TWILIO_FROM", "+15555550000")
    monkeypatch.setattr(twilio.requests, "post", lambda url, data, auth, timeout: llamadas.append((url, data)) or Resp())
    twilio.whatsapp("+15550100123", "hola")
    twilio.llamar("+15550100123", "http://x/a.mp3?b=1&c=2", "texto")
    assert llamadas[0][0].endswith("/Accounts/AC123/Messages.json")
    assert llamadas[0][1] == {"From": "whatsapp:+14155550000", "To": "whatsapp:+15550100123", "Body": "hola"}
    assert llamadas[1][1]["Twiml"] == "<Response><Play>http://x/a.mp3?b=1&amp;c=2</Play></Response>"

    class Estado:
        status_code = 200
        def json(self):
            return {"status": "busy"}

    pedidos = []
    monkeypatch.setattr(twilio.requests, "get", lambda url, auth, timeout: pedidos.append(url) or Estado())
    assert twilio.estado_llamada("CA9") == "busy" and pedidos[0].endswith("/Accounts/AC123/Calls/CA9.json")
    assert twilio.estado_mensaje("SM9") == "busy" and pedidos[1].endswith("/Accounts/AC123/Messages/SM9.json")


# --- Rutas del API ---------------------------------------------------------------

@pytest.fixture
def client(monkeypatch):
    from fastapi.testclient import TestClient
    from api import main
    from tests.test_api import _serie
    monkeypatch.setattr(main, "get_close", lambda s: _serie(0.001))
    monkeypatch.setattr(main, "load_model", lambda: (None, main.baseline.NOMBRE))
    monkeypatch.setenv("DEMO_PHONE", "+15550100123")
    return TestClient(main.app)


BODY = {"telefono": "+1 555 010 0123", "consentimiento": True, "simbolo": "SPY", "monto": 1000, "plazo_dias": 180,
        "perfil": "moderado"}


def test_remind_pide_permiso_formato_y_numero_permitido(client):
    assert client.post("/api/habit/remind", json=BODY | {"consentimiento": False}).status_code == 400
    assert client.post("/api/habit/remind", json=BODY | {"telefono": "07700900123"}).status_code == 400
    assert client.post("/api/habit/remind", json=BODY | {"telefono": "+15551234567"}).status_code == 403
    r = client.post("/api/habit/remind", json=BODY)
    assert r.status_code == 200 and r.json()["estado"] == "pendiente" and len(r.json()["token"]) > 15


def test_el_link_abre_la_app_con_el_plan_sin_marcar(client):
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    r = client.get(f"/r/{tk}", follow_redirects=False)
    assert r.status_code in (302, 307)
    assert r.headers["location"] == f"/?simbolo=SPY&monto=1000&plazo=180&perfil=moderado&recordatorio={tk}"
    # La vista previa de WhatsApp visita el link: eso no cuenta como abierto.
    assert client.get(f"/api/habit/{tk}").json()["abierto_en"] is None


def test_recordatorio_de_un_plan(client, monkeypatch):
    from api import main
    body = {k: v for k, v in BODY.items() if k != "simbolo"} | {"tipos": ["ETFs", "Crypto"]}
    r = client.post("/api/habit/remind", json=body)
    assert r.status_code == 200 and r.json()["simbolo"] == "PLAN" and r.json()["tipos"] == "ETFs,Crypto"
    tk = r.json()["token"]
    loc = client.get(f"/r/{tk}", follow_redirects=False).headers["location"]
    assert loc == f"/?view=planner&modo=plan&tipos=ETFs%2CCrypto&monto=1000&plazo=180&perfil=moderado&recordatorio={tk}"
    enviados = []
    monkeypatch.setenv("HABITO_DEMO", "1")
    monkeypatch.setattr(main.habito_ciclo, "twilio", type("T", (), {"mensaje": staticmethod(lambda t, x: enviados.append(x)),
                                                                     "llamar": staticmethod(lambda *a: None)}))
    monkeypatch.setattr(main.habito_mensajes, "llamar_gemini", lambda h: None)
    assert client.post(f"/api/habit/{tk}/now").json()["estado"] == "enviado"
    assert "your portfolio" in enviados[0] and f"/r/{tk}" in enviados[0]


def test_sin_activo_ni_plan_no_hay_recordatorio(client):
    body = {k: v for k, v in BODY.items() if k != "simbolo"}
    assert client.post("/api/habit/remind", json=body).status_code == 400


def test_la_app_marca_abierto_al_cargar(client):
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    r = client.post(f"/api/habit/{tk}/open")
    assert r.status_code == 200 and r.json()["abierto_en"] is not None
    assert client.post("/api/habit/no-existe/open").status_code == 404


def test_ahora_solo_en_demo(client, monkeypatch):
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    assert client.post(f"/api/habit/{tk}/now").status_code == 403
    from api import main
    enviados = []
    monkeypatch.setenv("HABITO_DEMO", "1")
    monkeypatch.setattr(main.habito_ciclo, "twilio", type("T", (), {"mensaje": staticmethod(lambda t, x: enviados.append(x)),
                                                                     "llamar": staticmethod(lambda *a: None)}))
    r = client.post(f"/api/habit/{tk}/now")
    assert r.status_code == 200 and r.json()["estado"] == "enviado" and f"/r/{tk}" in enviados[0]


def test_el_panel_ve_el_estado_real_de_la_llamada(client, monkeypatch):
    from api import main
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    main.habito_db.actualizar(main.habito_conn(), tk, estado="llamando", llamada_sid="CA1", llamada_estado="queued")
    monkeypatch.setattr(main.habito_ciclo, "twilio", type("T", (), {"estado_llamada": staticmethod(lambda sid: "busy")}))
    r = client.get(f"/api/habit/{tk}").json()
    assert r["estado"] == "sin_respuesta" and r["llamada_estado"] == "busy" and r["llamado_en"] is None
    assert "llamada_sid" not in r


def test_sin_twilio_el_error_se_entiende():
    with pytest.raises(RuntimeError, match="Twilio is not set up yet"):
        twilio.whatsapp("+15550100123", "hola")


def test_si_whatsapp_pide_plantilla_cae_a_sms(monkeypatch):
    usados = []
    monkeypatch.setattr(twilio, "whatsapp", lambda t, x: (_ for _ in ()).throw(RuntimeError('Twilio Messages 400: {"code":21654}')))
    monkeypatch.setattr(twilio, "sms", lambda t, x: usados.append(("sms", x)) or "SM1")
    assert twilio.mensaje("+15550100123", "hola") == "SM1" and usados == [("sms", "hola")]
    monkeypatch.setattr(twilio, "whatsapp", lambda t, x: (_ for _ in ()).throw(RuntimeError("Twilio Messages 401")))
    with pytest.raises(RuntimeError, match="401"):
        twilio.mensaje("+15550100123", "hola")


def test_canal_sms_directo(monkeypatch):
    monkeypatch.setenv("HABITO_CANAL", "sms")
    monkeypatch.setattr(twilio, "whatsapp", lambda t, x: pytest.fail("no debe usar WhatsApp"))
    monkeypatch.setattr(twilio, "sms", lambda t, x: "SM2")
    assert twilio.mensaje("+15550100123", "hola") == "SM2"


def test_telefono_de_la_llamada(monkeypatch):
    mx_whatsapp, mx_voz = f"+{ciclo.PAIS_MEXICO}14421234567", f"+{ciclo.PAIS_MEXICO}4421234567"
    assert ciclo.telefono_llamada(mx_whatsapp) == mx_voz
    assert ciclo.telefono_llamada("+15550100123") == "+15550100123"
    monkeypatch.setenv("HABITO_LLAMADA_A", f"{mx_whatsapp}=+15550100999, +15550100123 = +15550100777")
    assert ciclo.telefono_llamada(mx_whatsapp) == "+15550100999"
    assert ciclo.telefono_llamada("+15550100123") == "+15550100777"


def test_la_llamada_usa_el_otro_numero(conn, monkeypatch):
    monkeypatch.setenv("HABITO_ESPERA_MIN", "0")
    monkeypatch.setenv("HABITO_LLAMADA_A", "+15550100123=+15550100999")
    _rec(conn)
    env = Enviar()
    vence = T0 + timedelta(days=180)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    ciclo.procesar(conn, vence, lambda r: _hoy(), enviar=env)
    assert env.llamadas[0][0] == "+15550100999"
