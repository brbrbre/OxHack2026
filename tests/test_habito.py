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
    def __init__(self, falla=False):
        self.wa, self.llamadas, self.falla = [], [], falla

    def whatsapp(self, tel, texto):
        if self.falla:
            raise RuntimeError("Twilio 400")
        self.wa.append((tel, texto))

    def llamar(self, tel, url, texto):
        self.llamadas.append((tel, url, texto))


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


def test_gemini_solo_si_trae_link_y_activo():
    rec = {"nombre": "Walmart de México", "decision": "ESPERAR", "plazo_dias": 180, "sugerido": 579.0, "monto": 1000.0}
    bueno = "Hi! Your wait on Walmart de México is over. Today: invest $800. Review: http://x/r/abc"
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: bueno) == (bueno, "gemini")
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: "Hi! Walmart de México is great.")[1] == "template"
    assert mensajes.whatsapp(rec, _hoy(), "http://x/r/abc", llamar=lambda h: "Review http://x/r/abc")[1] == "template"


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
    assert almacen.obtener(conn, rec["token"])["estado"] == "llamado"


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


def test_link_marca_abierto_y_abre_la_app_con_el_plan(client):
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    r = client.get(f"/r/{tk}", follow_redirects=False)
    assert r.status_code in (302, 307) and r.headers["location"] == "/?simbolo=SPY&monto=1000&plazo=180&perfil=moderado"
    assert client.get(f"/api/habit/{tk}").json()["abierto_en"] is not None


def test_ahora_solo_en_demo(client, monkeypatch):
    tk = client.post("/api/habit/remind", json=BODY).json()["token"]
    assert client.post(f"/api/habit/{tk}/now").status_code == 403
    from api import main
    enviados = []
    monkeypatch.setenv("HABITO_DEMO", "1")
    monkeypatch.setattr(main.habito_ciclo, "twilio", type("T", (), {"whatsapp": staticmethod(lambda t, x: enviados.append(x)),
                                                                     "llamar": staticmethod(lambda *a: None)}))
    r = client.post(f"/api/habit/{tk}/now")
    assert r.status_code == 200 and r.json()["estado"] == "enviado" and f"/r/{tk}" in enviados[0]


def test_sin_twilio_el_error_se_entiende():
    with pytest.raises(RuntimeError, match="Twilio is not set up yet"):
        twilio.whatsapp("+15550100123", "hola")
