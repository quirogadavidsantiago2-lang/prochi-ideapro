# PROCHI · IDEAPRO

Asistente web de IDEAPRO para orientar a empresas, registrar diagnósticos y agendar citas en Google Calendar. El chat está en [`index.html`](index.html) y su flujo de n8n en [`n8n/prochi.json`](n8n/prochi.json).

## Configurar n8n

1. Importa `n8n/prochi.json` desde el editor de n8n. El flujo se preparó con n8n 2.35.7 y se importa como borrador.
2. Selecciona tus credenciales de Google Gemini, PostgreSQL, Google Calendar y Gmail en los nodos correspondientes.
3. En el nodo **Calendario y correo**, `calendarId` empieza vacío. Pega el ID del calendario que recibirá las citas. En Google Calendar aparece en **Configuración y uso compartido → Integrar el calendario → ID del calendario**. Configura `teamEmail` si quieres enviar avisos internos. [Consultar el ID de un calendario](https://support.google.com/calendar/answer/44105?hl=es)
4. Conecta los nodos de registro a la tabla `public.leads` del proyecto. La tabla usa `session_id`, `nombre_contacto`, `correo_contacto`, `nit`, `sector`, `tamano`, `objetivo`, `contrato_previo`, `respuesta_sector`, `nivel_madurez`, `servicio_recomendado` y `tipo`. Para citas también usa `fecha_cita`, `hora_cita` y `calendar_event_link`.
5. En el nodo **Webhook**, abre **Options → Allowed Origins (CORS)** y agrega el origen del sitio donde se sirve el chat, por ejemplo `http://localhost:8080` para desarrollo.
6. Para una prueba manual, selecciona **Listen for test event** en el nodo **Webhook** y usa su URL de prueba. Publica el flujo cuando termines de configurar las credenciales y destinos para habilitar la URL de producción. [Documentación del nodo Webhook](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/)

El flujo consulta la disponibilidad en Google Calendar y confirma la cita al chat cuando se crea el evento. Usa bloques de una hora en la zona `America/Bogota`. Dos solicitudes simultáneas para la misma hora pueden coincidir entre la consulta y la creación del evento. El registro y los correos posteriores a la respuesta se pueden revisar en el historial de ejecuciones en caso de error.

## Abrir el chat localmente

Desde la raíz del proyecto, inicia un servidor de archivos con Python.

```powershell
python -m http.server 8080
```

Abre `http://localhost:8080/`. En local, el chat usa por defecto `http://localhost:5678/webhook/prochi-chat` cuando el flujo está publicado. Para usar otra instancia o una URL de prueba, asigna la URL completa a `webhookUrl` en [`config.js`](config.js). El navegador puede leer ese archivo, así que las credenciales se configuran en n8n.

## Alojar el chat en GitHub Pages

Si el repositorio admite GitHub Pages, selecciona la rama del proyecto y su carpeta raíz como origen de publicación. En `config.js` indica la URL HTTPS del webhook de producción de n8n, accesible desde los equipos de los visitantes. Agrega el origen de Pages en **Allowed Origins (CORS)** del webhook. El flujo de n8n se ejecuta en la instancia donde lo importaste y publicaste. [Configurar el origen de publicación de GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Agregar el botón flotante a otro sitio

[`widget-demo.html`](widget-demo.html) muestra el botón, que abre el chat en una pestaña nueva. Copia esta etiqueta en la página donde quieras mostrarlo y ajusta las URL a tu sitio.

```html
<script src="https://example.com/prochi/prochi-widget.js"
        data-prochi-url="https://example.com/prochi/index.html"
        defer></script>
```
