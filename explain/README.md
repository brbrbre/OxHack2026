# explain/ - resumen, tutor de dudas y audio (Rocco)

- `resumen.py` (Gemini): pasa la salida de decide() o plan() a dos o tres oraciones. Si el texto no trae el monto que calculó la regla, se descarta y se usa la plantilla.
- `asesor.py` (Gemini): tutor "finanzas para principiantes". Contesta qué hace la empresa en pantalla y dudas generales de dinero, con ejemplos del día a día. No dice comprar ni vender, no predice precios y no cambia números.
- `fichas.py`: ficha de cada uno de los 21 activos (qué es y dónde se ve en el día a día) y un glosario. Es la base que recibe Gemini y la respuesta cuando Gemini no está.
- `voz.py` (ElevenLabs): MP3 del resumen, guardado en `data/cache/audio/`. Sin clave, la app usa la voz del navegador.

Rutas y contrato: `api/README.md`. Pruebas: `tests/test_resumen.py` (no usan internet).
