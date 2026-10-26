# Glosario

Términos del dominio con un significado propio en este proyecto. Se agregan cuando una palabra empieza a cargar decisiones de diseño (ver `docs/adr/`).

## Subtema

Cada uno de los puntos en que se descompone un **Tema** de un examen. Un subtema tiene la misma forma que un tema (`id`, `title`, `completed`) y vive **embebido dentro de su tema**, que a su vez viaja embebido dentro del examen. Hay **un solo nivel**: un subtema no tiene subtemas. Marcar un tema marca todos sus subtemas; desmarcar el tema no toca los subtemas; marcar todos los subtemas no marca el tema. El progreso de la tarjeta sigue contando temas completados sobre total de temas.

## Evento de todo el día

Un evento de calendario que ocupa el día completo, sin hora. En Google se representa con `start.date` y un `end.date` **exclusivo del día siguiente**; en el almacenamiento local, con fechas sin hora. Los eventos que una entidad crea para sí misma son siempre de todo el día (ver ADR 0010).

## Vínculo de entidad a evento

La relación entre una entidad (examen o tarea) y un evento de calendario, guardada como par `calendarId + eventId` en la misma fila de la entidad. Es unidireccional: la entidad es la fuente de verdad de su título y su fecha. Un vínculo **vigente** es el que apunta a un evento que existe y cae en el mismo día que la entidad; uno huérfano o de otro día degrada en silencio. Esa validez **del mismo día** rige el ciclo de vida (actualizar el evento al cambiar el título o la fecha, borrarlo junto con la entidad y deduplicar la agenda); en cambio, la **agenda del día** ubica a una tarea en el día de su evento: si la tarea tiene evento, el día del evento manda sobre su vencimiento. Ver ADR 0010.

## Bloque

La unidad con nombre y color del Cronograma semanal (`ScheduleBlock`): un título compartido por una o más ocurrencias. Cambiar el título o el color de un bloque cambia todas sus ocurrencias a la vez. Un bloque sin horarios no tiene nada que mostrar: se borra en cascada al eliminar su último horario.

## Horario (ocurrencia, slot)

Una aparición concreta de un bloque en la semana (`ScheduleSlot`): día (`day_of_week`, 0 = lunes) e inicio y fin en minutos desde la medianoche, al minuto, sin cuantizar a la granularidad visual. La interacción del modo edición (mover, estirar, borrar, copiar) opera sobre el horario, no sobre el bloque completo.

## Ventana visible

El rango de minutos que la grilla del Cronograma semanal muestra (`VisibleWindow`). Sin horarios es el default 08:00–18:00; con horarios abraza del más temprano al más tardío, redondeando hacia afuera a horas enteras. Nunca se persiste: es un valor derivado (ver ADR 0005), y durante un gesto puede crecer de a una hora hacia el borde que el puntero se acerca.
