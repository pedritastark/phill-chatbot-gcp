# Sistema de Manejo de Mensajes Largos

## 📋 Resumen

Este documento explica cómo el proyecto Phill maneja el **límite de 1024 caracteres** para agentes de IA en WhatsApp Business API, incluyendo la división automática de mensajes largos, logging y configuración.

---

## 🎯 Problema

WhatsApp Business API tiene un límite de **1024 caracteres** por mensaje para agentes de IA conversacionales. Si Phill genera respuestas largas (por ejemplo, explicando conceptos financieros complejos), el mensaje podría:

- ❌ Truncarse inesperadamente
- ❌ Fallar al enviarse
- ❌ Perder información importante

---

## ✅ Solución Implementada

### 1. **División Automática de Mensajes**

El sistema divide automáticamente mensajes largos en partes más pequeñas, respetando:

- **Límite seguro**: 974 caracteres (1024 - margen de seguridad de 50)
- **Límite recomendado**: 900 caracteres (para evitar divisiones innecesarias)
- **División inteligente**: Por párrafos → oraciones → palabras (en ese orden)

### 2. **Configuración Centralizada**

Todas las constantes están en `src/config/environment.js`:

```javascript
messaging: {
  maxLength: 1024,                  // Límite oficial de WhatsApp
  safetyMargin: 50,                 // Margen de seguridad
  recommendedLength: 900,           // Longitud recomendada
  enableAutoSplit: true,            // Habilitar división automática
  showContinuationMarkers: true,    // Mostrar indicadores de continuación
}
```

### 3. **Indicadores de Continuación**

Cuando un mensaje se divide, se agregan indicadores visuales:

**Primer mensaje:**
```
[Contenido del mensaje...]

📨 (continúa...)
```

**Mensaje intermedio:**
```
📨 (...continuación)

[Contenido del mensaje...]

📨 (continúa...)
```

**Último mensaje:**
```
📨 (...continuación)

[Contenido del mensaje...]
```

### 4. **Logging Completo**

El sistema registra detalladamente el proceso:

```
📏 Longitud de respuesta: 1500 caracteres
🚨 Mensaje excede el límite seguro - se dividirá automáticamente
📦 Estimado de partes: 2
📨 Mensaje dividido en 2 partes
  └─ Parte 1: 950 caracteres
  └─ Parte 2: 550 caracteres
✅ Mensaje dividido exitosamente en 2 partes
✉️  Respuesta enviada exitosamente
```

---

## 🔧 Configuración

### Variables de Entorno (Opcional)

Puedes personalizar el comportamiento agregando estas variables a tu `.env`:

```bash
# Límite máximo de caracteres por mensaje
MESSAGE_MAX_LENGTH=1024

# Margen de seguridad
MESSAGE_SAFETY_MARGIN=50

# Longitud recomendada antes de división
MESSAGE_RECOMMENDED_LENGTH=900

# Habilitar división automática (true/false)
ENABLE_AUTO_SPLIT=true

# Mostrar indicadores de continuación (true/false)
SHOW_CONTINUATION_MARKERS=true
```

**Si no defines estas variables, se usarán los valores predeterminados.**

---

## 📁 Archivos Modificados

### 1. `src/utils/twiml.js`

**Funciones nuevas:**

- `splitMessage(message, maxLength)` - Divide mensajes largos inteligentemente
- `generateMultipleResponses(messages)` - Genera TwiML para múltiples mensajes
- `generateSmartResponse(message)` - Maneja automáticamente la división
- `_splitByPeriods(text)` - División por oraciones (privado)
- `_splitByWords(text, maxLength)` - División por palabras (privado)
- `_addContinuationMarkers(chunks)` - Agrega indicadores (privado)

**Logging integrado:**

- ✅ Log cuando el mensaje cabe en un solo envío
- ⚠️  Warning cuando se acerca al límite
- 📨 Información detallada de cada parte al dividir

### 2. `src/controllers/webhook.controller.js`

**Mejoras:**

- Análisis de longitud de respuesta antes de enviar
- Logging detallado según el tamaño del mensaje
- Uso de `generateSmartResponse()` para manejo automático
- Estimación de partes cuando se requiere división

### 3. `src/services/message.service.js`

**Mejoras:**

- Log de advertencia cuando la IA genera respuestas largas
- Log de advertencia en confirmaciones de transacciones largas
- Sugerencias para optimizar respuestas

### 4. `src/services/ai.service.js`

**Mejoras en el prompt:**

- Se agregó una regla específica sobre límites de mensajes
- Se instruye a la IA para generar respuestas concisas (~900 caracteres)
- Se enfatiza claridad sobre extensión

### 5. `src/config/environment.js`

**Nueva sección:**

```javascript
messaging: {
  maxLength: 1024,
  safetyMargin: 50,
  recommendedLength: 900,
  enableAutoSplit: true,
  showContinuationMarkers: true,
}
```

---

## 🚀 Cómo Funciona (Flujo Completo)

1. **Usuario envía mensaje** → WhatsApp/Twilio → `webhook.controller.js`

2. **Procesamiento del mensaje** → `message.service.js`
   - Detecta comando financiero O consulta general
   - Genera respuesta (de IA o confirmación)
   - **⚠️ Log si la respuesta es larga**

3. **Análisis de longitud** → `webhook.controller.js`
   - Mide longitud de la respuesta
   - **✅ Log si está dentro del límite**
   - **⚠️ Log si está cerca del límite**
   - **🚨 Log si excede el límite**

4. **División inteligente** → `twiml.js` → `generateSmartResponse()`
   - Si el mensaje cabe → Envía directamente
   - Si no cabe → Divide automáticamente
   - Agrega indicadores de continuación
   - **📨 Log de cada parte generada**

5. **Envío TwiML** → Twilio → WhatsApp → Usuario
   - Si hay 1 parte: Usuario recibe 1 mensaje
   - Si hay N partes: Usuario recibe N mensajes consecutivos

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Mensaje Normal (< 900 caracteres)

```javascript
// Respuesta de Phill
const response = "¡Hola! Un ETF es como..."; // 500 caracteres

// Log:
// ✅ Mensaje dentro del límite: 500 caracteres
// ✅ Mensaje dentro del límite recomendado (900 caracteres)
// ✉️ Respuesta enviada exitosamente
```

**Usuario recibe:** 1 mensaje

---

### Ejemplo 2: Mensaje Largo (> 1024 caracteres)

```javascript
// Respuesta de Phill explicando interés compuesto
const response = "El interés compuesto es..."; // 1500 caracteres

// Log:
// 📏 Longitud de respuesta: 1500 caracteres
// ⚠️ Mensaje largo detectado: 1500 caracteres (recomendado: 900)
// 🚨 Mensaje excede el límite seguro - se dividirá automáticamente
// 📦 Estimado de partes: 2
// 📨 Mensaje dividido en 2 partes
//   └─ Parte 1: 950 caracteres
//   └─ Parte 2: 550 caracteres
// ✅ Mensaje dividido exitosamente en 2 partes
// ✉️ Respuesta enviada exitosamente
```

**Usuario recibe:** 2 mensajes consecutivos con indicadores 📨

---

## 🎨 Estrategia de División

La división sigue esta jerarquía para mantener la coherencia:

1. **Por párrafos** (saltos de línea `\n`)
   - Mantiene bloques de contenido juntos
   - Respeta la estructura del mensaje

2. **Por oraciones** (puntos, signos de exclamación/interrogación)
   - Si un párrafo es muy largo
   - Divide en puntos naturales del texto

3. **Por palabras** (espacios)
   - Último recurso si las oraciones son muy largas
   - Garantiza que el texto se divida sin truncar

---

## 🔍 Monitoreo y Debugging

### Logs Importantes a Revisar

**En desarrollo (`npm run dev`):**

```bash
# Mensaje normal
✅ Mensaje dentro del límite: 500 caracteres
✉️ Respuesta enviada exitosamente

# Mensaje largo
⚠️ IA generó respuesta larga: 1200 caracteres (recomendado: 900)
🚨 Mensaje excede el límite seguro - se dividirá automáticamente
📨 Mensaje dividido en 2 partes
✅ Mensaje dividido exitosamente en 2 partes
```

### Nivel de Logs

Configura el nivel en `.env`:

```bash
LOG_LEVEL=info     # Logs normales
LOG_LEVEL=debug    # Logs detallados (incluye cada parte del mensaje)
LOG_LEVEL=warning  # Solo advertencias y errores
```

---

## 🛠️ Personalización

### Desactivar División Automática

Si quieres manejar mensajes largos de otra forma:

```bash
# .env
ENABLE_AUTO_SPLIT=false
```

**⚠️ Advertencia:** Los mensajes > 1024 caracteres podrían fallar.

### Cambiar Límite Recomendado

Para respuestas más cortas:

```bash
# .env
MESSAGE_RECOMMENDED_LENGTH=700
```

Esto hará que Gemini intente generar respuestas más concisas.

### Ocultar Indicadores de Continuación

Para una experiencia más limpia:

```bash
# .env
SHOW_CONTINUATION_MARKERS=false
```

Los mensajes se dividirán sin los emojis 📨.

---

## ✅ Beneficios de Esta Implementación

1. **✅ Confiabilidad**
   - Los mensajes largos nunca se truncan inesperadamente
   - División inteligente mantiene la coherencia del texto

2. **✅ Configurabilidad**
   - Todas las constantes son configurables
   - Fácil de ajustar según necesidades

3. **✅ Transparencia**
   - Logging completo para debugging
   - Advertencias proactivas cuando se generan respuestas largas

4. **✅ Experiencia de Usuario**
   - Indicadores claros de continuación
   - Los mensajes se envían en orden correcto

5. **✅ Mantenibilidad**
   - Código bien documentado
   - Funciones privadas para lógica compleja
   - Configuración centralizada

---

## 🧪 Testing

Para probar la división de mensajes:

1. Envía a Phill una pregunta compleja que requiera respuesta larga:
   ```
   Explícame en detalle qué es el interés compuesto, cómo funciona, 
   ejemplos prácticos y cómo puedo aprovecharlo en mis finanzas
   ```

2. Observa los logs en la consola del servidor

3. Verifica que recibas múltiples mensajes en WhatsApp

---

## 📚 Referencias

- [WhatsApp Business API - Agent Message Limits](https://developers.facebook.com/docs/whatsapp/pricing)
- [Twilio WhatsApp API Documentation](https://www.twilio.com/docs/whatsapp/api)

---

## 🤝 Contribuciones

Si encuentras mejoras para el sistema de división de mensajes:

1. Ajusta las constantes en `environment.js`
2. Mejora la lógica de división en `twiml.js`
3. Actualiza esta documentación

---

**Documentación creada:** Noviembre 6, 2025
**Versión del sistema:** 1.0
**Autor:** Implementación profesional para manejo de límites de WhatsApp

