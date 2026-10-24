import pytest


@pytest.fixture(autouse=True)
def sin_claves_de_sponsors(monkeypatch, tmp_path):
    """Las pruebas nunca llaman a Gemini, ElevenLabs ni Tiger Data, aunque .env tenga claves."""
    for k in ("GEMINI_API_KEY", "ELEVENLABS_API_KEY", "TIGER_DATABASE_URL"):
        monkeypatch.delenv(k, raising=False)
    from explain import resumen, voz
    monkeypatch.setattr(voz, "CACHE", tmp_path / "audio")
    resumen._guardados.clear()
    resumen.generados.clear()
    from explain import asesor
    asesor._guardadas.clear()
