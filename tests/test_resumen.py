"""Resumen y audio: Gemini solo redacta y la plantilla cubre cualquier falla. No usan internet."""

import pytest

from explain import resumen, voz


def _decision(fraccion, monto=1000.0):
    return {
        "nombre": "Bitcoin", "razones": ["r1", "r2"],
        "numeros": {"monto": monto, "monto_sugerido": monto * fraccion, "plazo_dias": 30,
                    "rendimiento_esperado": 0.053, "prob_perdida": 0.5, "peor_caso": -254.2,
                    "perfil": "moderado"},
    }


def _plan(cartera):
    invertido = sum(c["monto"] for c in cartera)
    return {"cartera": cartera, "efectivo": 5000 - invertido,
            "numeros": {"monto": 5000, "invertido": invertido, "plazo_dias": 90, "peor_caso": -408.0, "tolerancia": 0.10}}


def test_plantilla_parcial_total_y_cero():
    sin_red = lambda h: None
    assert resumen.resumir_decision(_decision(0.39338), sin_red)["texto"].startswith(
        "Invest $393 of your $1,000 in Bitcoin now, and keep $607 for later.")
    assert resumen.resumir_decision(_decision(1.0), sin_red)["texto"].startswith("Invest the full $1,000 in Bitcoin now.")
    r = resumen.resumir_decision(_decision(0.0), sin_red)
    assert r["texto"].startswith("Keep your $1,000 for now.") and r["fuente"] == "template"


def test_usa_gemini_si_respeta_el_monto():
    r = resumen.resumir_decision(_decision(0.39338), lambda h: "Put $393 into Bitcoin today. Keep the rest.")
    assert r == {"texto": "Put $393 into Bitcoin today. Keep the rest.", "fuente": "gemini"}


@pytest.mark.parametrize("propuesto", ["Put $400 into Bitcoin today.", "Bitcoin looks fine.", "x" * 600 + " $393"])
def test_descarta_gemini_si_cambia_el_monto_o_se_alarga(propuesto):
    assert resumen.resumir_decision(_decision(0.39338), lambda h: propuesto)["fuente"] == "template"


def test_si_gemini_falla_usa_la_plantilla():
    def falla(h):
        raise TimeoutError("sin red")
    assert resumen.resumir_decision(_decision(0.5), falla)["fuente"] == "template"


def test_no_llama_dos_veces_por_lo_mismo():
    llamadas = []
    def cuenta(h):
        llamadas.append(h)
        return "Invest $500 now."
    resumen.resumir_decision(_decision(0.5), cuenta)
    resumen.resumir_decision(_decision(0.5), cuenta)
    assert len(llamadas) == 1


def test_plantilla_del_plan():
    vacio = resumen.resumir_plan(_plan([]), lambda h: None)["texto"]
    assert vacio.startswith("Keep your $5,000 in cash for now.")
    lleno = resumen.resumir_plan(_plan([{"monto": 3000.0, "nombre": "S&P 500"}, {"monto": 1500.0, "nombre": "Gold"}]),
                                 lambda h: None)["texto"]
    assert lleno.startswith("Invest $4,500 now: $3,000 in S&P 500, $1,500 in Gold. Keep $500 in cash.")


def test_sin_clave_no_hay_audio():
    assert voz.audio("hola") is None


def test_audio_guardado_no_vuelve_a_pedirse(monkeypatch):
    voz.CACHE.mkdir(parents=True)
    import hashlib
    nombre = hashlib.sha256(f"{voz.VOZ}|{voz.MODELO}|hola".encode()).hexdigest()[:24] + ".mp3"
    (voz.CACHE / nombre).write_bytes(b"ID3")
    assert voz.audio("hola") == b"ID3"


# --- Tutor de dudas ---------------------------------------------------------------

from explain import asesor, fichas  # noqa: E402
from data.assets import all_symbols  # noqa: E402


def test_cada_activo_tiene_ficha():
    assert set(fichas.FICHAS) == set(all_symbols())


def test_el_prompt_lleva_ficha_numeros_e_historial():
    p = asesor.armar_prompt("What does it do?", "WALMEX.MX", "Walmart de México", {"invest_now": "$393"},
                            [{"pregunta": "q1", "respuesta": "a1"}])
    assert "Bodega Aurrerá" in p and '"invest_now": "$393"' in p and "Earlier question: q1" in p
    assert p.endswith("Question: What does it do?")


def test_sin_gemini_contesta_con_la_ficha():
    r = asesor.responder("What does it do?", "FEMSAUBD.MX", "FEMSA", llamar=lambda p: None)
    assert r["fuente"] == "local" and "OXXO" in r["respuesta"]
    assert "fund you buy like a share" in asesor.responder("What is an ETF?", llamar=lambda p: None)["respuesta"]
    assert asesor.responder("Tell me a joke", llamar=lambda p: None)["fuente"] == "offline"


def test_sin_gemini_un_concepto_no_devuelve_la_ficha():
    r = asesor.responder("What is a dividend?", "WALMEX.MX", "Walmart de México", llamar=lambda p: None)
    assert "profit paid to its shareholders" in r["respuesta"] and "Bodega" not in r["respuesta"]


def test_con_gemini_usa_su_respuesta():
    r = asesor.responder("What is an ETF?", llamar=lambda p: "An ETF is a basket of investments.")
    assert r == {"respuesta": "An ETF is a basket of investments.", "fuente": "gemini"}


def test_si_gemini_falla_no_rompe():
    def falla(p):
        raise ConnectionError("sin red")
    assert asesor.responder("What does it do?", "AAPL", "Apple", llamar=falla)["fuente"] == "local"
