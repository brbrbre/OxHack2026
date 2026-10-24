# decision/ - la regla de decisión (Rocco)

Recibe la salida de `predict()`, el monto, el plazo y el calendario de eventos.
Devuelve **INVERTIR**, **ESPERAR** o **NO POR AHORA**, con sus razones y recomendaciones.

Ejemplo de razón: "La Fed decide el 28 de octubre. Espera a después de esa fecha."

El backtest de la decisión mide en dinero: seguir la app contra invertir siempre el primer día.
