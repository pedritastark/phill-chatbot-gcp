# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

---

## [2.1.0] - 2025-11-06

### ✨ Agregado

#### Sistema de Manejo de Mensajes Largos
- **División automática de mensajes** que exceden el límite de 1024 caracteres de WhatsApp Business API
- **División inteligente** por jerarquía: párrafos → oraciones → palabras
- **Indicadores visuales** (📨) para mostrar continuación entre mensajes divididos
- **Configuración centralizada** de límites de mensajes en `environment.js`
- **Logging completo** para debugging y monitoreo de mensajes divididos

#### Nuevas Funciones
- `TwiMLHelper.splitMessage()` - División inteligente de mensajes largos
- `TwiMLHelper.generateMultipleResponses()` - Generación de TwiML para múltiples mensajes
- `TwiMLHelper.generateSmartResponse()` - Manejo automático con división
- `Logger.debug()` - Método de logging para debugging (oculto en producción)

#### Testing
- Script de prueba `test-message-splitting.js` para validar división de mensajes
- Comando npm `npm run test:messages` para ejecutar tests
- 4 casos de prueba cubriendo diferentes longitudes de mensajes

#### Documentación
- `MENSAJES_LARGOS.md` - Documentación técnica completa del sistema
- `CHANGELOG.md` - Historial de versiones del proyecto
- Actualización de `README.md` con información sobre manejo de mensajes largos

#### Variables de Entorno
- `MESSAGE_MAX_LENGTH` - Límite máximo de caracteres (default: 1024)
- `MESSAGE_SAFETY_MARGIN` - Margen de seguridad (default: 50)
- `MESSAGE_RECOMMENDED_LENGTH` - Longitud recomendada (default: 900)
- `ENABLE_AUTO_SPLIT` - Habilitar división automática (default: true)
- `SHOW_CONTINUATION_MARKERS` - Mostrar indicadores 📨 (default: true)

### 🔧 Modificado

#### Configuración
- `src/config/environment.js` - Agregada sección `messaging` con configuración de límites

#### Controladores
- `src/controllers/webhook.controller.js`:
  - Análisis de longitud de respuesta antes de enviar
  - Logging mejorado según tamaño del mensaje
  - Uso de `generateSmartResponse()` para manejo automático

#### Servicios
- `src/services/message.service.js`:
  - Warnings cuando la IA genera respuestas largas
  - Warnings en confirmaciones de transacciones largas
  - Sugerencias para optimizar respuestas

- `src/services/ai.service.js`:
  - Prompt actualizado con regla #9 sobre límites de mensajes
  - Instrucciones para generar respuestas concisas (~900 caracteres)
  - Enfoque en claridad y brevedad

#### Utilidades
- `src/utils/twiml.js`:
  - Refactorización completa para soportar división de mensajes
  - Logging integrado en cada operación
  - Funciones privadas para lógica de división

- `src/utils/logger.js`:
  - Agregado método `debug()` para logs de desarrollo
  - Respeta `NODE_ENV` y `LOG_LEVEL`

#### Scripts
- `package.json` - Agregado script `test:messages`

### 📚 Documentación

- README actualizado con:
  - Sección "Manejo de Mensajes Largos"
  - Variables de entorno opcionales para configuración
  - Comando de test para división de mensajes

### ✅ Tests

- ✅ Mensaje corto (21 chars) → 1 parte
- ✅ Mensaje medio (448 chars) → 1 parte
- ✅ Mensaje largo (1646 chars) → 2 partes
- ✅ Mensaje muy largo (3933 chars) → 5 partes

---

## [2.0.0] - 2024-XX-XX

### ✨ Agregado
- Sistema de registro de gastos e ingresos
- Integración con Google Gemini AI
- Categorización automática de transacciones
- Resúmenes financieros personalizados
- Arquitectura modular profesional
- Sistema de logging con emojis
- Validación de variables de entorno

### 🔧 Modificado
- Refactorización completa del código base
- Organización en carpetas (controllers, services, models, utils)
- Mejoras en el sistema de prompt de IA

---

## [1.0.0] - 2024-XX-XX

### ✨ Agregado
- Implementación inicial del chatbot de WhatsApp
- Integración básica con Twilio
- Webhook para recibir mensajes
- Respuestas de IA básicas

---

## Tipos de Cambios

- **✨ Agregado** - Para nuevas funcionalidades
- **🔧 Modificado** - Para cambios en funcionalidad existente
- **🗑️ Eliminado** - Para funcionalidad eliminada
- **🐛 Corregido** - Para corrección de bugs
- **🔒 Seguridad** - Para cambios relacionados con seguridad
- **📚 Documentación** - Para cambios en documentación
- **⚡ Rendimiento** - Para mejoras de rendimiento
- **♻️ Refactorización** - Para cambios de código sin afectar funcionalidad

---

## [Unreleased]

### Planeado
- Sistema de recordatorios financieros
- Integración con bancos (Open Banking)
- Gráficas de gastos por categoría
- Exportación de datos a CSV/Excel
- Sistema de presupuestos y metas
- Notificaciones proactivas
- Multi-idioma (inglés, español)

