# Propuesta pendiente: plan entre activos elegidos

Esta es una propuesta para Rocco; no sustituye el contrato vigente de api/README.md. La app real sigue enviando las peticiones actuales. El selector interactivo de revisión está separado, en la carpeta local ignorada .vite/selected-assets-review/.

## Qué queremos

La persona puede elegir uno o varios activos por nombre, con sus logos, y un presupuesto común. Con uno se conserva el análisis individual. Con dos o más se pide un plan únicamente entre los seleccionados, usando las mismas reglas de Python. Elegir VOO y Gold no debe incluir los demás ETFs.

## Limitación actual comprobada

PlanRequest solo admite monto, plazo_dias, perfil y tipos. La ruta expande todos los símbolos de cada categoría. Añadir simbolos al cuerpo actual se ignora silenciosamente, así que la app no debe habilitar esa petición hasta que exista soporte explícito.

## Extensión propuesta de POST /api/plan

Mantener las peticiones actuales e incorporar simbolos como filtro opcional:

```json
{
  "monto": 5000,
  "plazo_dias": 90,
  "perfil": "moderado",
  "tipos": ["ETFs"],
  "simbolos": ["VOO", "GLD"]
}
```

El monto de este ejemplo sigue en USD, como la interfaz actual. No implica conversión de pesos mexicanos. El usuario también pidió un selector discreto USD / MXN / GBP / EUR; su integración se acordará por separado, como se explica abajo.

- Si se omite simbolos, conservar el comportamiento por categorías.
- Si se incluye, exigir al menos un símbolo, sin duplicados. Lista vacía o duplicada: 400.
- Símbolo desconocido: 404. Símbolo fuera de tipos: 400. Mantener el error actual para tipos desconocidos.
- Limitar los grupos antes de descargar precios, predecir y llamar al planificador existente.
- Reutilizar las reglas actuales de decisión, correlación, riesgo, pesos y efectivo. No repartir en React ni filtrar visualmente una cartera calculada para todo un grupo.

## Respuesta y comprobación en la app

La forma de PlanResponse no cambia. Cada símbolo pedido aparece exactamente una vez entre invertir, esperar y no_por_ahora, con sus razones. cartera solo puede incluir seleccionados que calificaron para invertir; no tiene que incluirlos todos. No puede aparecer un símbolo ajeno a la selección.

La app comprobará ese conjunto exacto, además del monto, plazo, perfil y grupos que ya valida. Un resultado con símbolos adicionales o faltantes será un error, no un plan parcialmente oculto. La activación requiere que Rocco confirme el contrato y que una prueba real con VOO + GLD devuelva exclusivamente esos dos en las listas de decisiones.

Conservar peso <= 0.40, el máximo actual de cinco posiciones y la igualdad invertido + efectivo = monto. Con dos activos, el máximo conjunto es 80 % y queda al menos 20 % en efectivo; las señales o el riesgo pueden dejar más. El selector no debe prometer invertir todo el presupuesto.

## Mensaje listo para compartir con Rocco

Queremos permitir que el usuario elija varios activos concretos (por ejemplo VOO y GLD) y pida un plan solo entre esos símbolos. ¿Puedes añadir a POST /api/plan un filtro opcional simbolos, manteniendo tipos y la respuesta actual? Debe filtrar antes del modelo/planificador, validar símbolos y conservar intactas las reglas de riesgo, correlación, máximo 40 % por activo y efectivo. La respuesta debe clasificar exactamente los símbolos pedidos, sin añadir otros ETFs. La app esperará la confirmación del contrato para conectarlo. El presupuesto sigue en USD por ahora.

## También solicitado: moneda del presupuesto

El usuario quiere un selector pequeño junto al importe con USD, MXN, GBP y EUR. La vista previa permite revisar esa interacción, sin conversión ni cálculo financiero. La app real conserva USD hasta acordar cómo obtener y aplicar los tipos de cambio.

La integración deberá definir con Rocco la fuente, el sentido y la fecha del tipo de cambio; la unidad de cada importe enviado y recibido; y cómo conservar coherentes presupuesto, asignaciones, efectivo, estimaciones de pérdida/ganancia y texto de las razones. Los precios de los activos conservan sus unidades de cotización propias. Mostrar la moneda elegida y el cambio usado; si no hay un cambio disponible, informar del error y permitir seguir en USD. No asumir equivalencia entre monedas ni enviar una cifra en MXN/GBP/EUR al API actual como si fuera USD.

Mensaje adicional: También queremos presupuestos en USD, MXN, GBP y EUR mediante un selector discreto. Antes de activarlo, acordemos el contrato de conversión y las unidades de los importes y explicaciones. Podemos mantener primero el filtro por símbolos con USD y añadir después las otras monedas.
