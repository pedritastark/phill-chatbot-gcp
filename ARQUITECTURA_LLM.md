# Arquitectura de Phill Chatbot con Capa LLM

## Diagrama de Flujo

```
┌─────────────────┐
│   Usuario       │
│   (WhatsApp)    │
└─────────┬───────┘
          │ Mensaje
          ▼
┌─────────────────┐
│  phill_chatbot  │
│   (main.py)     │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ get_user_context│
│ (Firestore)     │
└─────────┬───────┘
          │ Contexto
          ▼
┌─────────────────┐
│ LLM Decision    │
│ Layer           │
│ (Gemini)        │
└─────────┬───────┘
          │ Decisión
          ▼
    ┌─────────┐
    │ ¿Qué?   │
    └────┬────┘
         │
    ┌────▼────┐
    │ PROCESO │    ┌──────────────┐
    │AUTOMATIZADO│──▶│ Intent       │
    └─────────┘    │ Processor    │
                   └──────┬───────┘
                          │
                   ┌──────▼───────┐
                   │ Handlers      │
                   │ (registrar,   │
                   │  consultar,   │
                   │  etc.)        │
                   └───────────────┘
         │
    ┌────▼────┐
    │CONVERSACIÓN│   ┌──────────────┐
    │CON ASESOR │──▶│ Gemini        │
    └─────────┘    │ (Asesor       │
                   │  Financiero)  │
                   └───────────────┘
```

## Componentes

### 1. Capa de Decisión LLM (`llm_decision_layer.py`)
- **Función**: Analiza el mensaje del usuario y decide el flujo
- **Tecnología**: Google AI Studio (Gemini)
- **Entrada**: Mensaje + contexto del usuario
- **Salida**: Decisión (PROCESO_AUTOMATIZADO o CONVERSACION_ASESOR)

### 2. Contexto del Usuario (`get_user_context()`)
- **Función**: Obtiene datos financieros del usuario desde Firestore
- **Datos**: Gastos, ingresos, balance, categorías, etc.
- **Uso**: Informa al LLM para decisiones más inteligentes

### 3. Procesos Automatizados
- **Función**: Maneja tareas específicas y estructuradas
- **Componentes**:
  - Intent Processor (local)
  - Entity Extraction
  - Handlers específicos
- **Ejemplos**: Registrar gastos, consultar balance, crear recordatorios

### 4. Conversación con Asesor
- **Función**: Proporciona consejos personalizados y conversación natural
- **Tecnología**: Gemini con prompt especializado
- **Características**: Personalidad colombiana, consejos contextuales

## Flujo de Decisión

### Criterios para PROCESO_AUTOMATIZADO:
- Mensajes con estructura clara
- Acciones específicas (registrar, consultar, etc.)
- Datos numéricos o fechas
- Comandos directos

### Criterios para CONVERSACION_ASESOR:
- Preguntas abiertas
- Consultas complejas
- Necesidad de consejos personalizados
- Conversación general

## Ventajas de la Nueva Arquitectura

1. **Inteligencia Contextual**: El LLM entiende mejor la intención
2. **Flexibilidad**: Maneja tanto comandos como conversaciones
3. **Personalización**: Usa datos reales del usuario
4. **Escalabilidad**: Fácil de mejorar y expandir
5. **Robustez**: Fallback al sistema local si falla

## Ejemplos de Uso

### Proceso Automatizado
```
Usuario: "Gasté $50,000 en comida"
LLM: PROCESO_AUTOMATIZADO
Sistema: Ejecuta handle_registrar_gasto()
Respuesta: "✅ Gasto registrado: $50,000 en Alimentación"
```

### Conversación con Asesor
```
Usuario: "¿Cómo puedo ahorrar más dinero?"
LLM: CONVERSACION_ASESOR
Sistema: Genera respuesta con Gemini
Respuesta: "¡Hola parcero! Para ahorrar más, te recomiendo..."
```

## Configuración

### Variables de Entorno Requeridas:
- `GOOGLE_AI_API_KEY`: API key de Google AI Studio
- `PROJECT_ID`: ID del proyecto GCP
- `GOOGLE_APPLICATION_CREDENTIALS`: Credenciales de servicio

### Dependencias:
- `google-generativeai==0.3.2`
- `google-cloud-firestore==2.16.0`
- `twilio==9.1.0`
- `flask==3.0.3`
