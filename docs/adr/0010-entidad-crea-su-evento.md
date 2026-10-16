# La entidad crea su propio evento; el evento no es la fuente de verdad

La spec #132 había decidido que un examen **no** crea un evento: solo podía vincularse a un evento que ya existía en el calendario, y el vínculo era un adorno. En la práctica eso degradaba en silencio (no había evento que crear sin salir de la app) y dejaba a las tareas sin ninguna relación con el calendario. La spec #139 cambia el modelo para exámenes y tareas por igual.

Decidimos que **cada entidad (examen o tarea) puede crear su propio evento y es la fuente de verdad de su título y su fecha**. La sincronización es de una sola dirección, de la entidad hacia el evento:

- Al crear o editar con la opción *Evento nuevo* o *Solo local*, primero se persiste la entidad y **después** se crea el evento. Si la creación falla, la entidad queda **sin vínculo**, el error de calendario se muestra y la operación se puede reintentar desde la edición. Nunca se pierde la entidad por un problema de calendario.
- Al editar con un vínculo vigente (mismo día) y cambiar el título o la fecha, se actualiza el evento. Pasar a *No crear evento* limpia el vínculo pero **no borra** el evento.
- El vínculo se guarda como par `calendarId + eventId` en la misma fila de la entidad. Un vínculo huérfano (el evento ya no existe) o de otro día **degrada en silencio**: la tarjeta, la lista y la agenda siguen funcionando.
- El evento de una entidad es **siempre de todo el día**. Google recibe `start.date` y un `end.date` exclusivo del día siguiente; el almacenamiento local guarda fechas sin hora.

Consecuencias: el vínculo puede quedar obsoleto sin que la app lo note (aceptado: el evento es conveniencia de calendario, la entidad manda). No hay back-sync —mover, editar o borrar el evento del lado de Google o del calendario local **no** actualiza la entidad—, ni reparación retroactiva de exámenes anteriores sin vínculo, ni series/repetition, ni hora propia del evento. La dedup del calendario anual y de la agenda del día usa las claves de vínculo resueltas para no pintar ni listar dos veces el mismo día. Un evento creado con *Solo local* vive en el almacenamiento local y no se sube a Google.

Esto **enmienda la decisión de la spec #132** (un examen no creaba evento y el vínculo era decorativo) y define el modelo compartido por exámenes y tareas.

Considered options: hacer del evento la fuente de verdad y que la entidad se sincronice desde él — descartado, porque la app funciona sin conexión y sin Google conectado, y porque importar eventos externos como entidades traería ruido y conflictos; mantener el vínculo como adorno y exigir crear el evento a mano — descartado, es la degradación silenciosa que motivó esta spec; sincronización bidireccional — descartada por el costo de reconciliación y por los casos ambiguos (evento movido, borrado o repetido) sin un dueño claro de la verdad.
