# 📁 Estructura del Proyecto Phill

## 🎯 Vista General

```
phill/
├── 📂 src/                      # Código fuente principal
│   ├── 📂 config/               # Configuración
│   │   └── environment.js       # Variables de entorno y validación
│   │
│   ├── 📂 controllers/          # Controladores (lógica de rutas)
│   │   └── webhook.controller.js  # Maneja webhooks de Twilio
│   │
│   ├── 📂 services/             # Servicios (lógica de negocio)
│   │   ├── ai.service.js        # Integración con Google Gemini
│   │   ├── finance.service.js   # Gestión de transacciones financieras
│   │   └── message.service.js   # Procesamiento de mensajes
│   │
│   ├── 📂 models/               # Modelos de datos
│   │   ├── transaction.model.js # Modelo de transacciones
│   │   └── user.model.js        # Modelo de usuarios
│   │
│   ├── 📂 utils/                # Utilidades
│   │   ├── logger.js            # Sistema de logging con emojis
│   │   └── twiml.js             # Generador de respuestas TwiML
│   │
│   └── app.js                   # Configuración de Express
│
├── 📂 data/                     # Almacenamiento de datos
│   ├── .gitkeep                 # Mantiene la carpeta en git
│   └── transactions.json        # Base de datos de transacciones (generado)
│
├── 📂 logs/                     # Archivos de log
│   └── .gitkeep                 # Mantiene la carpeta en git
│
├── 📂 scripts/                  # Scripts de utilidad
│   └── start.sh                 # Script de inicio del servidor
│
├── 📄 server.js                 # Punto de entrada de la aplicación
├── 📄 package.json              # Dependencias y scripts npm
├── 📄 .env.example              # Plantilla de variables de entorno
├── 📄 .gitignore                # Archivos ignorados por git
└── 📄 README.md                 # Documentación principal

```

## 🔄 Flujo de Datos

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUARIO (WhatsApp)                      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                           TWILIO                                │
│                    (Recibe mensaje)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼ POST /webhook
┌─────────────────────────────────────────────────────────────────┐
│                  WEBHOOK CONTROLLER                             │
│                  - Valida mensaje                               │
│                  - Extrae datos                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  MESSAGE SERVICE                                │
│                  - Detecta comandos financieros                 │
│                  - Obtiene contexto del usuario                 │
└─────────┬─────────────────────────────────────┬─────────────────┘
          │                                     │
          │ ¿Es comando?                        │ ¿Es pregunta?
          │                                     │
          ▼                                     ▼
┌──────────────────────┐              ┌──────────────────────┐
│  FINANCE SERVICE     │              │    AI SERVICE        │
│  - Registra          │              │    - Consulta        │
│    transacción       │              │      Gemini          │
│  - Categoriza        │              │    - Genera          │
│  - Genera resumen    │              │      respuesta       │
└──────────┬───────────┘              └──────────┬───────────┘
           │                                     │
           │                                     │
           └─────────────┬───────────────────────┘
                         │
                         ▼
           ┌─────────────────────────┐
           │   TWIML HELPER          │
           │   - Genera XML          │
           └────────────┬────────────┘
                        │
                        ▼
           ┌─────────────────────────┐
           │      TWILIO             │
           │   (Envía respuesta)     │
           └────────────┬────────────┘
                        │
                        ▼
           ┌─────────────────────────┐
           │   USUARIO (WhatsApp)    │
           │   (Recibe respuesta)    │
           └─────────────────────────┘
```

## 📦 Módulos Principales

### 1. **server.js** - Punto de Entrada
- Valida configuración
- Inicia servidor Express
- Maneja errores globales

### 2. **src/app.js** - Aplicación Express
- Configura middlewares
- Define rutas
- Manejadores de errores

### 3. **src/controllers/webhook.controller.js**
- Recibe mensajes de Twilio
- Valida mensajes
- Coordina respuestas

### 4. **src/services/message.service.js**
- Procesa mensajes
- Detecta comandos
- Coordina servicios

### 5. **src/services/ai.service.js**
- Integración con Google Gemini
- Gestión de prompts
- Detección de comandos financieros

### 6. **src/services/finance.service.js**
- CRUD de transacciones
- Categorización automática
- Generación de resúmenes

### 7. **src/models/**
- Define estructura de datos
- Validación de modelos
- Conversión de objetos

### 8. **src/utils/**
- Logger con emojis
- Generador de TwiML
- Funciones auxiliares

## 🗄️ Base de Datos

### Estructura de `data/transactions.json`

```json
{
  "transactions": [
    {
      "id": "1699123456789",
      "userId": "whatsapp:+5215512345678",
      "type": "expense",
      "amount": 50.00,
      "category": "comida",
      "description": "comida en restaurante",
      "date": "2024-01-15T10:30:00.000Z",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

## 🔐 Variables de Entorno

Ver `.env.example` para la configuración completa:

- `PORT`: Puerto del servidor (default: 3001)
- `NODE_ENV`: Entorno (development/production)
- `TWILIO_ACCOUNT_SID`: SID de cuenta Twilio
- `TWILIO_AUTH_TOKEN`: Token de autenticación
- `TWILIO_PHONE_NUMBER`: Número de WhatsApp
- `GEMINI_API_KEY`: API key de Google Gemini
- `GEMINI_MODEL`: Modelo a usar

## 🚀 Scripts Disponibles

### NPM Scripts
```bash
npm start        # Inicia el servidor en producción
npm run dev      # Inicia el servidor en modo desarrollo (con nodemon)
```

### Shell Scripts
```bash
./scripts/start.sh  # Verifica configuración e inicia servidor
```

## 📊 Categorías Automáticas

El sistema categoriza automáticamente las transacciones:

- **comida**: comida, restaurante, almuerzo, desayuno, cena, café
- **transporte**: uber, taxi, gasolina, metro, bus
- **entretenimiento**: cine, netflix, spotify, juego, concierto
- **salud**: doctor, medicina, farmacia, hospital, gym
- **servicios**: luz, agua, internet, teléfono, renta
- **educacion**: curso, libro, universidad, clases
- **salario**: salario, sueldo, pago, nómina
- **inversion**: inversión, dividendo, interés
- **otros**: Categoría por defecto

## 🎨 Sistema de Logging

Usa emojis para facilitar el debugging:

- 📥 Request recibido
- 👤 Usuario
- 📨 Mensaje
- 🤖 IA/AI
- 💰 Finanzas
- ✅ Éxito
- ⚠️ Advertencia
- ❌ Error
- ℹ️ Información
- 📤 Respuesta enviada

---

**Última actualización:** Noviembre 2024
**Versión:** 2.0.0

