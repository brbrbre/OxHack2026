# explain/ - summary, tutor and voice

- `resumen.py` (Gemini): turns the output of `decide()` or `plan()` into two or three plain sentences ("In short"). If the text lacks the amount the rule computed, it is dropped and the template is used.
- `asesor.py` (Gemini): "Ask Horizon", a money tutor for beginners. It explains what the company on screen does and general money questions, with everyday examples. It never says buy or sell, never predicts prices and never changes a number.
- `fichas.py`: a fact sheet for each of the 21 assets (what it is, where you see it in daily life) and a glossary. Gemini gets it as context, and it is the answer when Gemini is unavailable.
- `voz.py` (ElevenLabs): the MP3 for "Listen" and for the reminder call, cached in `data/cache/audio/`. Without a key, the app uses the browser's voice.

Routes and contract: `api/README.md`. Tests: `tests/test_resumen.py` (no internet needed).
