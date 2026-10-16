# Glosario

Términos del dominio con un significado propio en este proyecto. Se agregan cuando una palabra empieza a cargar decisiones de diseño (ver `docs/adr/`).

## Subtema

Cada uno de los puntos en que se descompone un **Tema** de un examen. Un subtema tiene la misma forma que un tema (`id`, `title`, `completed`) y vive **embebido dentro de su tema**, que a su vez viaja embebido dentro del examen. Hay **un solo nivel**: un subtema no tiene subtemas. Marcar un tema marca todos sus subtemas; desmarcar el tema no toca los subtemas; marcar todos los subtemas no marca el tema. El progreso de la tarjeta sigue contando temas completados sobre total de temas.

## Evento de todo el día

Un evento de calendario que ocupa el día completo, sin hora. En Google se representa con `start.date` y un `end.date` **exclusivo del día siguiente**; en el almacenamiento local, con fechas sin hora. Los eventos que una entidad crea para sí misma son siempre de todo el día (ver ADR 0010).

## Vínculo de entidad a evento

La relación entre una entidad (examen o tarea) y un evento de calendario, guardada como par `calendarId + eventId` en la misma fila de la entidad. Es unidireccional: la entidad es la fuente de verdad de su título y su fecha. Un vínculo **vigente** es el que apunta a un evento que existe y cae en el mismo día que la entidad; uno huérfano o de otro día degrada en silencio. Ver ADR 0010.
