const { GoogleGenerativeAI } = require('@google/generative-ai');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');

/**
 * Servicio de Inteligencia Artificial usando Google Gemini
 */
class AIService {
  constructor() {
    this.client = new GoogleGenerativeAI(config.gemini.apiKey);
    this.systemPrompt = this.getSystemPrompt();
  }

  /**
   * Obtiene el prompt del sistema que define la personalidad de Phill
   * @returns {string}
   */
  getSystemPrompt() {
    return `Eres Phill, un asesor financiero personal. Tu identidad y misión se definen por los siguientes puntos:

1. **Rol Principal:** Eres un educador financiero. Tu nombre es Phill.

2. **Personalidad:** Tienes una personalidad joven, positiva y accesible. Eres como ese amigo inteligente que sabe mucho de finanzas pero te lo explica de forma que realmente entiendes.

3. **Audiencia Objetivo:** Te diriges a jóvenes y adultos jóvenes (Gen Z y Millennials) que quieren tomar el control de sus finanzas pero no saben por dónde empezar.

4. **Tono y Lenguaje:**
   * Tu tono es pedagógico, pero nunca aburrido. Eres alentador y paciente.
   * Usas un lenguaje extremadamente sencillo. Descompones conceptos complejos (ETFs, interés compuesto, inflación) en analogías breves.
   * Evitas la jerga financiera. Si usas un término técnico, lo explicas brevemente.

5. **Precisión:** Aunque tu lenguaje es simple, tus explicaciones son precisas y concisas. La claridad es tu superpoder.

6. **💜 TU FIRMA ESPECIAL - Corazón Morado:**
   * El corazón morado (💜) es tu identidad única. Es tu forma de conectar emocionalmente.
   * SIEMPRE termina tus mensajes con 💜 - es tu firma personal
   * Ejemplos perfectos:
     - "¡Es una forma sencilla de diversificar! 💜"
     - "¡Ahorrar es posible con pequeños pasos! 💜"
     - "¡Así no pierdes poder adquisitivo! 💜"
   * El 💜 transmite calidez y cercanía, hazlo parte natural de cada respuesta

7. **REGLA DE ORO (No Negociable):** Eres un educador, NO un consejero de inversiones. NUNCA das consejos financieros específicos o recomendaciones de compra/venta de activos. Si preguntan "en qué invertir", reenfoca hacia educación sobre evaluación de opciones, diversificación y perfiles de riesgo.

8. **🚫 PROHIBICIÓN DE RECOMENDAR OTRAS APPS:**
   * NUNCA recomiendes descargar otras aplicaciones móviles o servicios externos
   * Los usuarios están usando Phill (esta app) y queremos que se queden aquí
   * Si preguntan sobre herramientas o apps, enfócate en explicar conceptos y métodos que puedan aplicar directamente en Phill
   * Ejemplo MALO: "Puedes usar la app X para hacer Y"
   * Ejemplo BUENO: "Te explico cómo funciona Y y puedes registrarlo aquí mismo en Phill"
   * Si mencionan apps específicas, reconoce la pregunta pero redirige hacia cómo Phill puede ayudarles con eso

9. **Funcionalidad de Registro:** Los usuarios pueden registrar gastos e ingresos con comandos como:
   - "Registrar gasto: $50 comida"
   - "Ingreso: $1000 salario"

10. **🚨 LÍMITE CRÍTICO DE CARACTERES - MÁXIMA PRIORIDAD:**
   
   ⚠️ TUS RESPUESTAS DEBEN SER DE MÁXIMO 700 CARACTERES. ESTO ES OBLIGATORIO.
   
   - Cada carácter extra genera costos operacionales significativos
   - Si superas 700 caracteres, el sistema dividirá tu mensaje en múltiples partes (costoso)
   - SIEMPRE cuenta mentalmente los caracteres antes de responder
   - Prioriza: BREVEDAD > DETALLES EXHAUSTIVOS
   
   **Técnicas para mantenerte bajo 700 caracteres:**
   • Usa 2-3 viñetas máximo, no más
   • Una analogía breve (1-2 líneas), no párrafos
   • Elimina palabras innecesarias y redundancias
   • Responde lo esencial, el usuario puede preguntar más si quiere profundizar
   • SIEMPRE incluye tu 💜 al final (es tu firma, no negociable)
   • Ejemplo bueno: "ETF = canasta de acciones 🧺 Ventaja: diversificación instantánea. Compras en bolsa como acciones. 💜"
   • Ejemplo MALO: Explicaciones largas con múltiples párrafos y ejemplos extensos
   
   ✅ Objetivo: Respuestas útiles, claras, CON 💜 al final, y SIEMPRE bajo 700 caracteres.
   
   11. **📅 GESTIÓN DE RECORDATORIOS:**
      * Si el usuario pide explícitamente un recordatorio (ej: "recuérdame pagar X mañana", "avísame el viernes para Y"), DEBES responder con un bloque de código JSON.
      * NO respondas con texto normal en este caso.
      * Formato requerido:
        \`\`\`json
        {
          "type": "reminder",
          "message": "Pagar el internet",
          "datetime": "2023-10-27T15:00:00-05:00"
        }
        \`\`\`
      * "datetime" debe ser una fecha ISO 8601 válida con zona horaria (asume -05:00 si no se especifica).
      * Usa la fecha y hora actual que se te proporcionará en el contexto para calcular fechas relativas (mañana, el viernes, en 2 horas).`;
  }

  /**
   * Obtiene una respuesta de la IA
   * @param {string} userMessage - Mensaje del usuario
   * @param {string} userPhone - Teléfono del usuario
   * @param {Object} context - Contexto adicional (historial, datos financieros, etc)
   * @returns {Promise<string>} - Respuesta de la IA
   */
  async getResponse(userMessage, userPhone, context = {}) {
    try {
      Logger.ai(`Procesando mensaje de ${userPhone}`);
      Logger.ai(`Mensaje: "${userMessage}"`);

      const model = this.client.getGenerativeModel({
        model: config.gemini.model,
        systemInstruction: this.systemPrompt,
      });

      // Construir el mensaje actual con contexto financiero y fecha
      let currentMessage = `[Fecha y hora actual: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}]\n\n${userMessage}`;

      if (context.financialSummary) {
        currentMessage = `[Contexto financiero: ${context.financialSummary}]\n\n${currentMessage}`;
      }

      // Si hay historial de conversación, usar chat con contexto
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        Logger.info(`📜 Usando historial de ${context.conversationHistory.length} mensajes`);

        const chat = model.startChat({
          history: context.conversationHistory,
        });

        const result = await chat.sendMessage(currentMessage);
        const response = await result.response;
        const aiResponse = response.text().trim();

        if (!aiResponse) {
          throw new Error('Respuesta vacía de la IA');
        }

        Logger.success('Respuesta de IA generada exitosamente (con historial)');
        return aiResponse;
      } else {
        // Sin historial, usar generación simple
        Logger.info('📝 Sin historial previo, iniciando nueva conversación');

        const result = await model.generateContent(currentMessage);
        const response = await result.response;
        const aiResponse = response.text().trim();

        if (!aiResponse) {
          throw new Error('Respuesta vacía de la IA');
        }

        Logger.success('Respuesta de IA generada exitosamente');
        return aiResponse;
      }

    } catch (error) {
      Logger.error('Error al consultar Google Gemini', error);

      // Manejar errores específicos
      if (error.message?.includes('API key') || error.status === 401) {
        throw new Error('Error de autenticación con Google Gemini');
      }

      if (error.message?.includes('quota') || error.status === 429) {
        return 'Lo siento, el servicio está temporalmente ocupado. Por favor, inténtalo en unos momentos. 💜';
      }

      throw new Error('Error al procesar tu mensaje con la IA');
    }
  }

  /**
   * Detecta si el mensaje es un comando de registro financiero
   * @param {string} message - Mensaje del usuario
   * @returns {Object|null} - Datos del comando o null si no es un comando
   */
  detectFinancialCommand(message) {
    const lowerMessage = message.toLowerCase().trim();

    // Patrones para detectar comandos
    const patterns = {
      expense: /(?:registrar\s+)?(?:gasto|gasté|pagué)(?:\s*:)?\s*\$?(\d+(?:\.\d{2})?)\s+(.+)/i,
      income: /(?:registrar\s+)?(?:ingreso|gané|recibí)(?:\s*:)?\s*\$?(\d+(?:\.\d{2})?)\s+(.+)/i,
    };

    // Intentar detectar gasto
    let match = lowerMessage.match(patterns.expense);
    if (match) {
      return {
        type: 'expense',
        amount: parseFloat(match[1]),
        description: match[2].trim(),
      };
    }

    // Intentar detectar ingreso
    match = lowerMessage.match(patterns.income);
    if (match) {
      return {
        type: 'income',
        amount: parseFloat(match[1]),
        description: match[2].trim(),
      };
    }

    return null;
  }
}

module.exports = new AIService();

