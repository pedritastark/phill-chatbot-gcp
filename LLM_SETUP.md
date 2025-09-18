# Configuración de la Capa LLM para Phill Chatbot

## Descripción

Se ha agregado una **capa de decisión LLM** que usa Google AI Studio (Gemini) para determinar automáticamente si el usuario necesita:

1. **Proceso Automatizado**: Para tareas específicas como registrar gastos, consultar balance, etc.
2. **Conversación con Asesor**: Para consultas complejas, consejos personalizados, o conversaciones generales

## Arquitectura

```
Usuario envía mensaje → LLM decide → Proceso automatizado O Conversación con asesor
```

### Flujo de Decisión

1. **Análisis LLM**: El mensaje se analiza con Gemini para determinar la intención
2. **Decisión**: Se decide entre proceso automatizado o conversación con asesor
3. **Ejecución**: Se ejecuta el flujo correspondiente

## Configuración Requerida

### 1. Google AI Studio API Key

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una nueva API key
3. Configura la variable de entorno:

```bash
export GOOGLE_AI_API_KEY="AIzaSyDnrHL0j86EHfzFC5X-cScxCgZw5_yPgbo"
```

### 2. Instalar Dependencias

```bash
pip install google-generativeai==0.3.2
```

### 3. Variables de Entorno

Agrega estas variables a tu entorno:

```bash
# Google AI Studio
GOOGLE_AI_API_KEY=tu-api-key-de-google-ai-studio

# Google Cloud (ya existente)
PROJECT_ID=tu-proyecto-gcp
GOOGLE_APPLICATION_CREDENTIALS=ruta/a/tu/service-account-key.json
```

## Funcionalidades

### Procesos Automatizados

El LLM detecta automáticamente cuando el usuario quiere:
- Registrar gastos: "Gasté $50,000 en comida"
- Registrar ingresos: "Recibí $1,000,000 de salario"
- Consultar balance: "¿Cuánto tengo?"
- Ver resumen: "Muéstrame mis gastos del mes"
- Crear recordatorios: "Recuérdame pagar el 15"
- Solicitar tips básicos: "Dame un consejo financiero"

### Conversación con Asesor

El LLM activa el modo asesor para:
- Consultas complejas: "¿Cómo puedo mejorar mis finanzas?"
- Análisis personalizado: "¿Qué me recomiendas para ahorrar?"
- Conversaciones generales: "Hola, ¿cómo estás?"
- Preguntas sobre inversiones: "¿Dónde debería invertir mi dinero?"
- Planificación financiera: "¿Cómo hago un presupuesto?"
- Dudas conceptuales: "¿Qué es el interés compuesto?"

## Archivos Modificados

1. **`llm_decision_layer.py`** - Nueva capa de decisión LLM
2. **`main.py`** - Actualizado para usar la nueva arquitectura
3. **`streamlit_app.py`** - Actualizado para mostrar ambos modos
4. **`requirements.txt`** - Agregada dependencia de Google AI

## Ejemplos de Uso

### Proceso Automatizado
```
Usuario: "Gasté $30,000 en transporte"
LLM: PROCESO_AUTOMATIZADO
Sistema: Ejecuta handle_registrar_gasto()
```

### Conversación con Asesor
```
Usuario: "¿Cómo puedo ahorrar más dinero?"
LLM: CONVERSACION_ASESOR
Sistema: Genera respuesta personalizada con Gemini
```

## Ventajas

1. **Inteligencia**: El LLM entiende mejor la intención del usuario
2. **Flexibilidad**: Puede manejar consultas complejas y conversaciones naturales
3. **Personalización**: Usa el contexto financiero del usuario para dar consejos
4. **Escalabilidad**: Fácil de mejorar y expandir
5. **Fallback**: Si el LLM falla, usa el sistema de intents local

## Monitoreo

El sistema incluye logging detallado para monitorear:
- Decisiones del LLM
- Confianza de las decisiones
- Razonamiento del LLM
- Errores y fallbacks

## Próximos Pasos

1. Configurar la API key de Google AI Studio
2. Probar con diferentes tipos de mensajes
3. Ajustar los prompts según sea necesario
4. Monitorear el rendimiento y la precisión
5. Expandir las capacidades del asesor financiero
