import pytest


@pytest.fixture(autouse=True)
def sin_claves_de_sponsors(monkeypatch, tmp_path):
    """Las pruebas nunca llaman a Gemini, ElevenLabs ni Tiger Data, aunque .env tenga claves."""
    for k in ("GEMINI_API_KEY", "ELEVENLABS_API_KEY", "TIGER_DATABASE_URL", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
              "HABITO_DEMO", "HABITO_PERMITIDOS", "HABITO_LLAMADA_A", "HABITO_CANAL", "DEMO_PHONE", "PUBLIC_URL", "HABITO_ESPERA_MIN"):
        monkeypatch.delenv(k, raising=False)
    from habito import almacen
    monkeypatch.setattr(almacen, "ARCHIVO", tmp_path / "habito.sqlite")
    import api.main as main
    monkeypatch.setattr(main, "_habito", None)
    from explain import resumen, voz
    monkeypatch.setattr(voz, "CACHE", tmp_path / "audio")
    resumen._guardados.clear()
    resumen.generados.clear()
    from explain import asesor
    asesor._guardadas.clear()
