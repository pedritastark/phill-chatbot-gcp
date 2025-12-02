# 💜 Phill - Asesor Financiero Personal vía WhatsApp

**Phill** es un chatbot inteligente de WhatsApp que funciona como tu asesor financiero personal. Construido con Node.js, OpenAI (GPT-4o) y Twilio, Phill te ayuda a:

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

### Registro de Transacciones Inteligente
- Registra gastos: `"Gasto: $50.000 comida"`
- Registra ingresos: `"Ingreso: $1.000.000 salario"`
- **Selección de cuenta inteligente**: Te pregunta dónde guardar el dinero si no lo especificas
- **Formato Colombiano**: Maneja montos en pesos colombianos (COP) con formato `$1.000.000`
- Categorización automática
- Resúmenes financieros personalizados basados en tu **patrimonio real** (suma de cuentas)

### Arquitectura Profesional
```
src/
├── config/          # Configuración centralizada
├── controllers/     # Lógica de rutas y webhooks
├── services/        # Lógica de negocio (IA, finanzas, mensajes, DB)
├── utils/           # Utilidades (logger, formatter)
└── scripts/         # Scripts de utilidad (chat local)
```

## 📋 Requisitos Previos

- **Node.js** v14 o superior
- **Cuenta de Twilio** con WhatsApp habilitado
- **API Key de OpenAI**
- **Base de Datos PostgreSQL**

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
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### 3. Iniciar el servidor

```bash
# Usando el script
./scripts/start.sh

# O directamente con npm
npm start
```

## 💬 Chat Local (Testing)

Puedes probar el chatbot directamente en tu terminal sin necesidad de Twilio o WhatsApp:

```bash
node scripts/local_chat.js
```

## 💬 Cómo Usar Phill

### Preguntar sobre finanzas

```
"¿Qué es un ETF?"
"Explícame el interés compuesto"
"¿Cómo hago un presupuesto?"
```

### Registrar gastos

```
"Gaste 50.000 en comida"
"Pague 200.000 de arriendo"
```

### Registrar ingresos

```
"Me pagaron 1.000.000 de salario"
"Recibí 50.000 de regalo"
```

### Ver tu resumen

Cada vez que registres una transacción, Phill te mostrará:
- Total de ingresos (últimos 30 días)
- Total de gastos (últimos 30 días)
- **Balance Real**: La suma total de dinero en tus cuentas
- Insights personalizados

## 🏗️ Arquitectura

### Flujo de Datos

```
Usuario → WhatsApp → Twilio → Webhook → Phill → OpenAI → Respuesta
                                   ↓
                             Base de Datos
                             (PostgreSQL)
```

### Componentes Principales

#### 1. **Message Service** (`src/services/message.service.js`)
- Procesa el mensaje del usuario
- Detecta comandos financieros
- Coordina con IA y finanzas

#### 2. **AI Service** (`src/services/ai.service.js`)
- Se comunica con OpenAI
- Gestiona el prompt del sistema y las herramientas (Function Calling)
- Detecta intenciones de usuario

#### 3. **Finance Service** (`src/services/finance.service.js`)
- Gestiona transacciones (gastos/ingresos)
- Genera resúmenes financieros
- Categoriza automáticamente

#### 4. **Database Services** (`src/services/db/`)
- Capa de acceso a datos para Usuarios, Cuentas, Transacciones, etc.

## 🤝 Contribuir

Este proyecto es open source y las contribuciones son bienvenidas.

## 📄 Licencia

ISC License

## 💜 Sobre Phill

Phill es un educador financiero diseñado para jóvenes y adultos jóvenes que quieren tomar el control de sus finanzas. Su misión es hacer que la educación financiera sea accesible, divertida y práctica.

**Recuerda:** Phill educa, NO aconseja. Te enseña a tomar decisiones informadas tú mismo.

---

Hecho con 💜 para ayudarte a mejorar tu salud financiera
