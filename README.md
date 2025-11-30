# 💜 Phill - Asesor Financiero Personal vía WhatsApp

**Phill** es un chatbot inteligente de WhatsApp que funciona como tu asesor financiero personal. Construido con Node.js, Google Gemini AI y Twilio, Phill te ayuda a:

- 🎓 **Aprender sobre finanzas**: Explica conceptos complejos de forma simple y accesible
- 💰 **Registrar gastos e ingresos**: Lleva control de tus finanzas directamente desde WhatsApp
- 📊 **Obtener insights financieros**: Recibe análisis automáticos de tus hábitos de gasto
- 💬 **Conversar naturalmente**: Pregunta lo que quieras sobre finanzas personales

## 🌟 Características

### Educación Financiera
- Explica conceptos como ETFs, interés compuesto, inflación, presupuestos
- Usa analogías y lenguaje sencillo
- Responde dudas en tiempo real
- **NUNCA da consejos de inversión específicos** (solo educa)

### Registro de Transacciones
- Registra gastos: `"Gasto: $50 comida"`
- Registra ingresos: `"Ingreso: $1000 salario"`
- Categorización automática
- Resúmenes financieros personalizados

### Arquitectura Profesional
```
src/
├── config/          # Configuración centralizada
├── controllers/     # Lógica de rutas y webhooks
├── services/        # Lógica de negocio (IA, finanzas, mensajes)
├── models/          # Modelos de datos
└── utils/           # Utilidades (logger, TwiML)
```

### Manejo de Mensajes Largos
- **División automática**: Mensajes > 1024 caracteres se dividen inteligentemente
- **División por contexto**: Divide por párrafos → oraciones → palabras
- **Indicadores visuales**: Emojis 📨 para mostrar continuación
- **Configurable**: Todos los límites son ajustables
- [📖 Ver documentación completa](./MENSAJES_LARGOS.md)

## 📋 Requisitos Previos

- **Node.js** v14 o superior
- **Cuenta de Twilio** con WhatsApp habilitado
- **API Key de Google Gemini** ([Obtener aquí](https://makersuite.google.com/app/apikey))
- **ngrok** (para desarrollo local)

## 🚀 Instalación Rápida

### 1. Clonar e instalar dependencias

```bash
cd phill
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita el archivo `.env` con tus credenciales:

```env
PORT=3001
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=tu_token_aqui
TWILIO_PHONE_NUMBER=+14155238886
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-2.0-flash-exp

# Configuración opcional de mensajes (valores predeterminados)
MESSAGE_MAX_LENGTH=1024
MESSAGE_SAFETY_MARGIN=50
MESSAGE_RECOMMENDED_LENGTH=900
ENABLE_AUTO_SPLIT=true
SHOW_CONTINUATION_MARKERS=true
```

### 3. Iniciar el servidor

```bash
# Usando el script
./scripts/start.sh

# O directamente con npm
npm start
```

## 🔧 Configuración de Twilio

### Paso 1: Exponer tu servidor local

```bash
ngrok http 3001
```

Copia la URL HTTPS que ngrok te proporciona (ej: `https://abc123.ngrok.io`)

### Paso 2: Configurar el webhook en Twilio

1. Ve a [Twilio Console](https://console.twilio.com/)
2. Navega a **Messaging** → **Try it out** → **Send a WhatsApp message**
3. En la configuración del webhook, ingresa:
   ```
   https://tu-url-ngrok.ngrok.io/webhook
   ```
4. Guarda los cambios

### Paso 3: Conectar tu WhatsApp

1. Twilio te dará un código (ej: `join example-123`)
2. Envía ese código al número de WhatsApp Sandbox de Twilio
3. ¡Listo! Ya puedes hablar con Phill

## 💬 Cómo Usar Phill

### Preguntar sobre finanzas

```
"¿Qué es un ETF?"
"Explícame el interés compuesto"
"¿Cómo hago un presupuesto?"
```

### Registrar gastos

```
"Gasto: $50 comida"
"Gasté $200 en transporte"
"Registrar gasto: $30 café"
```

### Registrar ingresos

```
"Ingreso: $1000 salario"
"Recibí $50 propina"
"Registrar ingreso: $200 freelance"
```

### Ver tu resumen

Cada vez que registres una transacción, Phill te mostrará:
- Total de ingresos (últimos 30 días)
- Total de gastos (últimos 30 días)
- Balance actual
- Insights personalizados

## 🏗️ Arquitectura

### Flujo de Datos

```
Usuario → WhatsApp → Twilio → Webhook → Phill → Gemini AI → Respuesta
                                  ↓
                            Base de Datos
                          (JSON / Transacciones)
```

### Componentes Principales

#### 1. **Webhook Controller** (`src/controllers/webhook.controller.js`)
- Recibe mensajes de Twilio
- Valida y extrae información
- Coordina la respuesta

#### 2. **Message Service** (`src/services/message.service.js`)
- Procesa el mensaje del usuario
- Detecta comandos financieros
- Coordina con IA y finanzas

#### 3. **AI Service** (`src/services/ai.service.js`)
- Se comunica con Google Gemini
- Gestiona el prompt del sistema
- Detecta comandos de registro

#### 4. **Finance Service** (`src/services/finance.service.js`)
- Gestiona transacciones (gastos/ingresos)
- Genera resúmenes financieros
- Categoriza automáticamente

#### 5. **Models** (`src/models/`)
- `Transaction`: Modelo de transacciones
- `User`: Modelo de usuarios

## 📊 Almacenamiento de Datos

Los datos se guardan en archivos JSON en la carpeta `data/`:

```
data/
└── transactions.json    # Todas las transacciones de usuarios
```

**Formato de transacciones:**
```json
{
  "transactions": [
    {
      "id": "1699123456789",
      "userId": "whatsapp:+5215512345678",
      "type": "expense",
      "amount": 50.00,
      "category": "comida",
      "description": "comida",
      "date": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## 🔍 Endpoints

### `POST /webhook`
Endpoint principal del webhook de WhatsApp

**Request (de Twilio):**
```
Body: "¿Qué es un ETF?"
From: whatsapp:+5215512345678
To: whatsapp:+14155238886
```

**Response (TwiML):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>¡Hola! Un ETF es como una canasta...</Message>
</Response>
```

### `GET /health`
Verifica que el servidor esté funcionando

**Response:**
```json
{
  "status": "ok",
  "message": "Phill WhatsApp Bot is running",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🧪 Testing

### Test de división de mensajes

Prueba el sistema de manejo de mensajes largos:

```bash
npm run test:messages
```

Este script prueba:
- ✅ Mensajes cortos (< 900 caracteres)
- ✅ Mensajes medios (~500 caracteres)
- ✅ Mensajes largos (~1200 caracteres)
- ✅ Mensajes muy largos (> 4000 caracteres)

### Test local con curl

```bash
# Health check
curl http://localhost:3001/health

# Simular mensaje de Twilio
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=¿Qué es un ETF?&From=whatsapp:+5215512345678&To=whatsapp:+14155238886"
```

### Test con WhatsApp real

1. Configura ngrok y Twilio
2. Envía un mensaje al número de Sandbox
3. Verifica los logs en la terminal
4. Recibe la respuesta en WhatsApp

### Casos de prueba sugeridos

✅ **Educación:**
- "¿Qué es el interés compuesto?"
- "Explícame qué son los ETFs"
- "¿Cómo hago un presupuesto?"

✅ **Registro de gastos:**
- "Gasto: $50 comida"
- "Gasté $200 en uber"

✅ **Registro de ingresos:**
- "Ingreso: $1000 salario"
- "Recibí $50 propina"

## 📝 Logs

Phill usa un sistema de logging con emojis para facilitar el debugging:

- 📥 Request recibido
- 👤 Información del usuario
- 📨 Mensaje procesado
- 🤖 Consulta a IA
- 💰 Operación financiera
- ✅ Operación exitosa
- ⚠️ Advertencia
- ❌ Error

**Ver logs en tiempo real:**
```bash
npm start
```

## 🎨 Personalización

### Cambiar la personalidad de Phill

Edita el prompt del sistema en `src/services/ai.service.js`:

```javascript
getSystemPrompt() {
  return `Eres Phill, un asesor financiero personal...`;
}
```

### Agregar nuevas categorías

Edita `categorizeTransaction()` en `src/services/finance.service.js`:

```javascript
const categories = {
  tuCategoria: ['palabra1', 'palabra2'],
  // ...
};
```

### Cambiar el modelo de IA

Edita `.env`:
```env
GEMINI_MODEL=gemini-1.5-pro
```

Modelos disponibles:
- `gemini-2.0-flash-exp` (recomendado, rápido)
- `gemini-1.5-pro` (más potente)
- `gemini-1.5-flash` (balance)

## 🚀 Despliegue a Producción

### Opciones recomendadas:

1. **Railway** (recomendado)
   - Deploy automático desde GitHub
   - Variables de entorno fáciles
   - Dominio HTTPS incluido

2. **Heroku**
   - `git push heroku main`
   - Add-ons disponibles

3. **DigitalOcean**
   - VPS con control total
   - Configuración manual

4. **Google Cloud Run**
   - Serverless
   - Escala automáticamente

### Checklist para producción:

- ✅ Configurar `NODE_ENV=production`
- ✅ Usar dominio HTTPS permanente
- ✅ Configurar webhook en Twilio con URL de producción
- ✅ Implementar backup de datos
- ✅ Configurar monitoreo (opcional)
- ✅ Implementar rate limiting (opcional)

## 🔒 Seguridad

### Variables de entorno
- ✅ Nunca subas tu archivo `.env` a git
- ✅ Usa `.gitignore` para excluir archivos sensibles
- ✅ Rota tus API keys periódicamente

### Validación de Twilio (Producción)
Para producción, valida que los requests vengan de Twilio:

```javascript
const twilio = require('twilio');

app.use('/webhook', (req, res, next) => {
  const signature = req.headers['x-twilio-signature'];
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    req.body
  );
  
  if (!valid) {
    return res.status(403).send('Forbidden');
  }
  next();
});
```

## 🤝 Contribuir

Este proyecto es open source y las contribuciones son bienvenidas:

1. Fork el proyecto
2. Crea una rama: `git checkout -b feature/nueva-funcionalidad`
3. Commit: `git commit -m 'Agrega nueva funcionalidad'`
4. Push: `git push origin feature/nueva-funcionalidad`
5. Abre un Pull Request

## 📄 Licencia

ISC License

## 💜 Sobre Phill

Phill es un educador financiero diseñado para jóvenes y adultos jóvenes que quieren tomar el control de sus finanzas. Su misión es hacer que la educación financiera sea accesible, divertida y práctica.

**Recuerda:** Phill educa, NO aconseja. Te enseña a tomar decisiones informadas tú mismo.

---

Hecho con 💜 para ayudarte a mejorar tu salud financiera
