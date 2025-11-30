# Guía de Despliegue en Railway

Este proyecto está preparado para ser desplegado en [Railway](https://railway.app/).

## Requisitos Previos

1.  Una cuenta en Railway.
2.  Una base de datos PostgreSQL (puedes crear una en Railway y vincularla).
3.  Una cuenta de Twilio (SID, Token y número).
4.  Una API Key de Google Gemini.

## Pasos para Desplegar

1.  **Nuevo Proyecto**: En Railway, crea un "New Project" y selecciona "Deploy from GitHub repo".
2.  **Seleccionar Repositorio**: Elige este repositorio.
3.  **Variables de Entorno**: Antes de que termine el despliegue (o en la configuración después), añade las siguientes variables:

    | Variable | Descripción | Ejemplo |
    | :--- | :--- | :--- |
    | `NODE_ENV` | Entorno de ejecución | `production` |
    | `TWILIO_ACCOUNT_SID` | SID de tu cuenta Twilio | `AC...` |
    | `TWILIO_AUTH_TOKEN` | Token de autenticación Twilio | `...` |
    | `TWILIO_PHONE_NUMBER` | Tu número de Twilio | `whatsapp:+1234567890` |
    | `GEMINI_API_KEY` | Tu API Key de Google AI | `AIza...` |
    | `DATABASE_URL` | URL de conexión a PostgreSQL | `postgresql://user:pass@host:port/db` |
    | `MESSAGE_MAX_LENGTH` | (Opcional) Límite de caracteres | `1024` |

4.  **Base de Datos**:
    *   Si creas una base de datos PostgreSQL en el mismo proyecto de Railway, la variable `DATABASE_URL` se inyectará automáticamente.
    *   Asegúrate de ejecutar las migraciones si es necesario (el proyecto tiene scripts en `package.json` como `db:migrate`, pero verifica si necesitas ejecutarlos manualmente o como parte del build).

## Webhook de Twilio

Una vez desplegado, obtendrás una URL pública (ej. `https://mi-proyecto.up.railway.app`).

1.  Ve a tu consola de Twilio > Messaging > Senders > WhatsApp Senders.
2.  Edita tu sender.
3.  En "Webhook URL for incoming messages", coloca tu URL + `/webhook`.
    *   Ejemplo: `https://mi-proyecto.up.railway.app/webhook`
4.  Guarda los cambios.

## Verificación

*   Envía un mensaje de WhatsApp a tu número.
*   Revisa los logs en Railway para ver si llegan los mensajes.
