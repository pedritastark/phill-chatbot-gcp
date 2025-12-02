const OpenAI = require('openai');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');

/**
 * Servicio de Inteligencia Artificial usando OpenAI
 */
class AIService {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.openai.apiKey,
    });
    this.systemPrompt = this.getSystemPrompt();
  }

  /**
   * Obtiene las definiciones de herramientas para OpenAI
   */
  getTools() {
    return [
      {
        type: "function",
        function: {
          name: "register_transaction",
          description: "Registrar un nuevo gasto o ingreso financiero",
          parameters: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["income", "expense"],
                description: "Tipo de transacción: 'income' (ingreso) o 'expense' (gasto)"
              },
              amount: {
                type: "number",
                description: "Monto de la transacción"
              },
              description: {
                type: "string",
                description: "Descripción de la transacción (ej: 'comida', 'salario')"
              },
              account: {
                type: "string",
                description: "Cuenta afectada (ej: 'Nequi', 'Bancolombia', 'Efectivo'). SOLO incluir si el usuario menciona explícitamente una cuenta."
              },
              category: {
                type: "string",
                description: "Categoría de la transacción. Opcional."
              }
            },
            required: ["type", "amount", "description"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "set_reminder",
          description: "Programar un recordatorio",
          parameters: {
            type: "object",
            properties: {
              message: {
                type: "string",
                description: "Mensaje del recordatorio"
              },
              datetime: {
                type: "string",
                description: "Fecha y hora ISO 8601 con zona horaria (ej: 2023-10-27T15:00:00-05:00)"
              },
              is_recurring: {
                type: "boolean",
                description: "Si el recordatorio se repite periódicamente"
              },
              recurrence_pattern: {
                type: "string",
                enum: ["daily", "weekly", "monthly", "yearly"],
                description: "Patrón de repetición (solo si is_recurring es true)"
              }
            },
            required: ["message", "datetime"]
          }
        }
      }
    ];
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

    **IMPORTANTE SOBRE DATOS FINANCIEROS:**
    * Recibirás un "Contexto financiero" con el balance real y el desglose por cuentas.
    * USA ESTOS DATOS como la verdad absoluta.
    * NO intentes calcular el balance sumando/restando mensajes del chat. El "Contexto financiero" ya tiene el cálculo correcto de la base de datos.
    * Si el usuario pregunta "¿cuánto tengo?", responde usando el "BALANCE TOTAL REAL" y el "Desglose por cuenta" del contexto.

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
   * Usa el nombre del usuario de vez en cuando para que la conversación se sienta personal, pero no en cada mensaje.

7. **REGLA DE ORO (No Negociable):** Eres un educador, NO un consejero de inversiones. NUNCA das consejos financieros específicos o recomendaciones de compra/venta de activos. Si preguntan "en qué invertir", reenfoca hacia educación sobre evaluación de opciones, diversificación y perfiles de riesgo.

8. **🚫 PROHIBICIÓN DE RECOMENDAR OTRAS APPS:**
   * NUNCA recomiendes descargar otras aplicaciones móviles o servicios externos
   * Los usuarios están usando Phill (esta app) y queremos que se queden aquí
   * Si preguntan sobre herramientas o apps, enfócate en explicar conceptos y métodos que puedan aplicar directamente en Phill
   * Ejemplo MALO: "Puedes usar la app X para hacer Y"
   * Ejemplo BUENO: "Te explico cómo funciona Y y puedes registrarlo aquí mismo en Phill"
   * Si mencionan apps específicas, reconoce la pregunta pero redirige hacia cómo Phill puede ayudarles con eso

9. **Funcionalidad de Registro:** Los usuarios pueden registrar gastos e ingresos. Usa la herramienta 'register_transaction' cuando detectes esta intención.

10. **Recordatorios:** Los usuarios pueden pedir recordatorios. Usa la herramienta 'set_reminder' cuando detectes esta intención.

11. **🚨 LÍMITE CRÍTICO DE CARACTERES - MÁXIMA PRIORIDAD:**
   
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
   
   ✅ Objetivo: Respuestas útiles, claras, CON 💜 al final, y SIEMPRE bajo 700 caracteres.`;
  }

  /**
   * Obtiene una respuesta de la IA
   * @param {string} userMessage - Mensaje del usuario
   * @param {string} userPhone - Teléfono del usuario
   * @param {Object} context - Contexto adicional (historial, datos financieros, etc)
   * @returns {Promise<Object>} - Respuesta de la IA (content + tool_calls)
   */
  async getResponse(userMessage, userPhone, context = {}) {
    try {
      Logger.ai(`Procesando mensaje de ${userPhone}`);
      Logger.ai(`Mensaje: "${userMessage}"`);

      // Construir el mensaje actual con contexto financiero y fecha
      // Usar formato ISO para evitar ambigüedad (YYYY-MM-DD)
      const now = new Date();
      // Ajustar a zona horaria Colombia (-5) manualmente para asegurar ISO correcto con offset
      const colombiaTime = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // UTC-5
      const isoString = colombiaTime.toISOString().replace('Z', '-05:00');

      let currentMessageContent = `[Fecha y hora actual (ISO 8601): ${isoString}]\n\n${userMessage}`;

      if (context.userName) {
        currentMessageContent = `[Nombre del usuario: ${context.userName}]\n\n${currentMessageContent}`;
      }

      if (context.financialSummary) {
        currentMessageContent = `[Contexto financiero: ${context.financialSummary}]\n\n${currentMessageContent}`;
      }

      // Preparar mensajes para OpenAI
      const messages = [
        { role: 'system', content: this.systemPrompt }
      ];

      // Si hay historial de conversación, agregarlo
      if (context.conversationHistory && context.conversationHistory.length > 0) {
        Logger.info(`📜 Usando historial de ${context.conversationHistory.length} mensajes`);

        for (const msg of context.conversationHistory) {
          let role = 'user';
          let content = '';

          // Adaptar formato Gemini si es necesario
          if (msg.role === 'model') role = 'assistant';
          else if (msg.role === 'user') role = 'user';

          if (msg.parts && msg.parts[0] && msg.parts[0].text) {
            content = msg.parts[0].text;
          } else if (msg.content) {
            content = msg.content;
          }

          if (content) {
            messages.push({ role, content });
          }
        }
      } else {
        Logger.info('📝 Sin historial previo, iniciando nueva conversación');
      }

      // Agregar mensaje actual
      messages.push({ role: 'user', content: currentMessageContent });

      const completion = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: messages,
        tools: this.getTools(),
        tool_choice: "auto",
        max_tokens: 1000,
      });

      const message = completion.choices[0].message;

      Logger.success('Respuesta de IA generada exitosamente');
      return message; // Retornamos el objeto mensaje completo (puede tener content o tool_calls)

    } catch (error) {
      Logger.error('Error al consultar OpenAI', error);

      // Manejar errores específicos
      if (error.status === 401) {
        throw new Error('Error de autenticación con OpenAI');
      }

      if (error.status === 429) {
        return { content: 'Lo siento, el servicio está temporalmente ocupado. Por favor, inténtalo en unos momentos. 💜' };
      }

      throw new Error('Error al procesar tu mensaje con la IA');
    }
  }
}

module.exports = new AIService();

