"""Audio del resumen con ElevenLabs. Si no hay clave o falla, la app usa la voz del navegador."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path

VOZ = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb")
MODELO = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")
CACHE = Path(__file__).resolve().parent.parent / "data" / "cache" / "audio"


def audio(texto: str) -> bytes | None:
    """MP3 del texto, guardado en disco para no pagar dos veces el mismo resumen."""
    archivo = CACHE / (hashlib.sha256(f"{VOZ}|{MODELO}|{texto}".encode()).hexdigest()[:24] + ".mp3")
    if archivo.exists():
        return archivo.read_bytes()
    clave = os.getenv("ELEVENLABS_API_KEY")
    if not clave:
        return None
    from elevenlabs.client import ElevenLabs

    try:
        cliente = ElevenLabs(api_key=clave)
        partes = cliente.text_to_speech.convert(VOZ, text=texto, model_id=MODELO, output_format="mp3_44100_128")
        datos = b"".join(partes)
    except Exception:
        return None
    CACHE.mkdir(parents=True, exist_ok=True)
    archivo.write_bytes(datos)
    return datos
