# Análisis de Costos - Phill Chatbot con LLM

## Resumen de Consumo de Créditos

Tu bot actualmente consume créditos de Google AI Studio (Gemini) de la siguiente manera:

### **Por Cada Mensaje del Usuario:**

#### 1. **Análisis de Decisión** (SIEMPRE se ejecuta)
- **Función**: `analyze_user_intent()`
- **Tokens de entrada**: ~800-1,200 tokens
- **Tokens de salida**: ~50-100 tokens
- **Costo por mensaje**: ~$0.001-0.002 USD

#### 2. **Respuesta del Asesor** (SOLO si decide CONVERSACION_ASESOR)
- **Función**: `get_advisor_response()`
- **Tokens de entrada**: ~400-600 tokens
- **Tokens de salida**: ~100-300 tokens
- **Costo por mensaje**: ~$0.001-0.004 USD

## Cálculo Detallado

### **Prompt de Decisión (analyze_user_intent)**
```
System prompt: ~600 tokens
User message: ~20-50 tokens
User context: ~100-300 tokens
Total entrada: ~720-950 tokens
Respuesta JSON: ~50-100 tokens
```

### **Prompt del Asesor (get_advisor_response)**
```
System prompt: ~200 tokens
User context: ~100-300 tokens
User message: ~20-50 tokens
Total entrada: ~320-550 tokens
Respuesta del asesor: ~100-300 tokens
```

## Costos por Escenario

### **Escenario 1: Proceso Automatizado (70% de los casos)**
- Solo análisis de decisión: **$0.001-0.002 USD**
- Total por mensaje: **$0.001-0.002 USD**

### **Escenario 2: Conversación con Asesor (30% de los casos)**
- Análisis de decisión: **$0.001-0.002 USD**
- Respuesta del asesor: **$0.001-0.004 USD**
- Total por mensaje: **$0.002-0.006 USD**

## Estimación de Costos Mensuales

### **Uso Moderado (100 mensajes/mes)**
- 70 procesos automatizados: 70 × $0.002 = **$0.14**
- 30 conversaciones: 30 × $0.005 = **$0.15**
- **Total mensual: $0.29 USD**

### **Uso Intensivo (1,000 mensajes/mes)**
- 700 procesos automatizados: 700 × $0.002 = **$1.40**
- 300 conversaciones: 300 × $0.005 = **$1.50**
- **Total mensual: $2.90 USD**

### **Uso Empresarial (10,000 mensajes/mes)**
- 7,000 procesos automatizados: 7,000 × $0.002 = **$14.00**
- 3,000 conversaciones: 3,000 × $0.005 = **$15.00**
- **Total mensual: $29.00 USD**

## Comparación con Alternativas

### **Google AI Studio (Actual)**
- **Gratuito**: 15 requests/minuto, 1M tokens/día
- **Pago**: $1.25/millón tokens entrada, $10/millón tokens salida
- **Ventaja**: Muy económico, fácil de usar

### **OpenAI GPT-4**
- **Costo**: ~$0.03-0.06 por request
- **Tu bot costaría**: $3-6 USD por 100 mensajes
- **10x más caro** que Gemini

### **Sistema Local (Sin LLM)**
- **Costo**: $0 USD
- **Limitación**: Solo procesos automatizados, sin conversación natural

## Optimizaciones para Reducir Costos

### **1. Cache de Decisiones**
```python
# Implementar cache para decisiones repetitivas
decision_cache = {}
if message in decision_cache:
    return decision_cache[message]
```

### **2. Prompts Más Cortos**
- Reducir el system prompt de 600 a 300 tokens
- Ahorro: ~30% en tokens de entrada

### **3. Fallback Inteligente**
- Usar análisis local para casos obvios
- Solo usar LLM para casos ambiguos
- Ahorro: ~50% en requests

### **4. Límite de Contexto**
- Limitar el contexto del usuario a datos esenciales
- Ahorro: ~20% en tokens de entrada

## Recomendaciones

### **Para Uso Personal/Pequeño**
- **Costo estimado**: $0.30-3 USD/mes
- **Recomendación**: Usar el plan gratuito de Google AI Studio
- **Límite**: 15 requests/minuto es suficiente

### **Para Uso Comercial**
- **Costo estimado**: $3-30 USD/mes
- **Recomendación**: Plan de pago de Google AI Studio
- **ROI**: Muy bueno comparado con alternativas

### **Para Uso Empresarial**
- **Costo estimado**: $30-300 USD/mes
- **Recomendación**: Implementar optimizaciones
- **Considerar**: Cache, prompts optimizados, fallbacks

## Monitoreo de Costos

### **Implementar Logging**
```python
def log_token_usage(request_tokens, response_tokens, cost):
    print(f"Tokens: {request_tokens} entrada, {response_tokens} salida")
    print(f"Costo estimado: ${cost:.4f}")
```

### **Alertas de Costo**
- Configurar alertas cuando se superen $10/mes
- Monitorear picos de uso inusual

## Conclusión

**Tu bot es MUY económico** comparado con alternativas:
- **Costo por mensaje**: $0.001-0.006 USD
- **Costo mensual típico**: $0.30-3 USD
- **ROI excelente**: Funcionalidad avanzada a bajo costo

El uso de Google AI Studio es la opción más cost-effective para tu caso de uso.
