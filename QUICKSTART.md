# ⚡ Quick Start - Phill

## 🚀 Inicio Rápido (3 pasos)

### 1️⃣ Instalar dependencias
```bash
npm install
```

### 2️⃣ Configurar .env
```bash
cp .env.example .env
# Edita .env con tus credenciales
```

### 3️⃣ Iniciar servidor
```bash
npm start
```

## 📱 Probar con WhatsApp

### Opción A: Con ngrok (Desarrollo)
```bash
# Terminal 1: Iniciar servidor
npm start

# Terminal 2: Exponer con ngrok
ngrok http 3001
```

1. Copia la URL de ngrok (ej: `https://abc123.ngrok.io`)
2. Ve a [Twilio Console](https://console.twilio.com/)
3. Configura webhook: `https://abc123.ngrok.io/webhook`
4. Envía mensaje al número de Twilio Sandbox
5. ¡Listo! 💜

### Opción B: Test Local con curl
```bash
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=Hola Phill&From=whatsapp:+5215512345678"
```

## 💬 Ejemplos de Mensajes

### 🎓 Preguntas de finanzas
```
¿Qué es un ETF?
Explícame el interés compuesto
¿Cómo hacer un presupuesto?
```

### 💰 Registrar gastos
```
Gasto: $50 comida
Gasté $200 en uber
Registrar gasto: $30 café
```

### 💵 Registrar ingresos
```
Ingreso: $1000 salario
Recibí $50 propina
Registrar ingreso: $200 freelance
```

## 🔧 Comandos Útiles

```bash
# Modo desarrollo (con auto-reload)
npm run dev

# Ver health del servidor
curl http://localhost:3001/health

# Verificar logs
tail -f logs/*.log
```

## 📚 Documentación Completa

- **README.md** - Documentación completa y detallada
- **ESTRUCTURA.md** - Arquitectura y flujos del sistema
- **QUICKSTART.md** - Esta guía de inicio rápido

## ❓ Problemas Comunes

### Error: "Faltan variables de entorno"
✅ Verifica que `.env` exista y tenga todas las variables

### Error: "Cannot find module"
✅ Ejecuta `npm install`

### No recibo mensajes en WhatsApp
✅ Verifica que ngrok esté corriendo
✅ Verifica que la URL en Twilio sea correcta
✅ Verifica que el servidor esté corriendo

## 🎯 Estructura de Archivos

```
phill/
├── src/              # Código fuente
├── data/             # Base de datos (JSON)
├── logs/             # Archivos de log
├── scripts/          # Scripts útiles
├── server.js         # Punto de entrada
├── package.json      # Dependencias
└── .env              # Tu configuración (no subir a git)
```

## 🌐 Endpoints

- `POST /webhook` - Recibe mensajes de WhatsApp
- `GET /health` - Estado del servidor

## 💜 ¡Disfruta usando Phill!

Para más información, consulta el **README.md** completo.

