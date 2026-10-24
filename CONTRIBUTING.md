# Cómo trabajamos (guía del equipo)

## Quién toca qué

### Núcleo (asignado)

| Carpeta | Dueño | Para qué |
|---|---|---|
| `data/` | Rocco | Bajar precios y guardarlos en caché |
| `model/` | Felipe y Brisma | El modelo de predicción hecho a mano y su validación |
| `decision/` | Rocco | Convertir la predicción en INVERTIR / ESPERAR / NO POR AHORA |
| `app/` | Carlos | La app en Streamlit: lo que ve el usuario y el jurado |
| `notebooks/` | Felipe y Brisma | Exploración y gráficas; nada de lo que corre la app vive aquí |
| `tests/` | Cada quien, los suyos | Pruebas rápidas con pytest |
| `docs/` | Rocco y Brisma | Pitch, texto de Devpost, capturas |

Cada quien edita solo sus carpetas. Si necesitas cambiar algo de otra, avisa en el grupo.

### Extras para premios (sin asignar)

Se deciden en las revisiones, según cuánto tiempo sobre. Primero el núcleo.

| Extra | Carpeta | Candidatos |
|---|---|---|
| Tiger Data: guardar precios y predicciones | `data/` | Felipe y/o Rocco |
| Gemini: redactar la explicación | `explain/` | Rocco |
| ElevenLabs: botón "Escuchar" | `explain/` | Rocco |
| Vultr: URL pública | `deploy/` | Rocco |
| Delta (Zed) | - | Nadie por ahora |

## Ramas

- `main` siempre corre. Nadie sube código roto a `main`.
- Cada quien trabaja en su rama: `felipe/modelo`, `brisma/validacion`, `carlos/app`, `rocco/datos`.
- Para juntar: Pull Request a `main`. Otra persona le da un vistazo de 2 minutos y lo aprueba.
- Haz `git pull` antes de empezar y commits chicos y seguido.

## Arranque (una vez)

```bash
git clone https://github.com/brbrbre/OxHack2026.git
cd OxHack2026
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # pon tus claves aquí
```

## Reglas

- El repo es **público**. Ninguna clave en el código: todas van en `.env`, que no se sube.
- Los datos bajados van en `data/cache/`, que no se sube.
- El modelo se valida en orden de tiempo: se entrena con el pasado y se prueba con el futuro.
- Toda métrica del README sale de un comando que cualquiera puede correr.
- Gemini solo explica. Quien decide es nuestro modelo.

## Revisiones

- **19:00 sáb:** SPY de punta a punta (datos, modelo, decisión en pantalla).
- **00:00 dom:** métricas reales contra el baseline. Se decide qué extras entran y quién los hace.
- **09:00 dom:** se congela el código; solo arreglos.
- **11:30 dom:** envío en Devpost con el link de este repo.
