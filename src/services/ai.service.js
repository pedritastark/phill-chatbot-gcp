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
   * Genera un comentario corto para el reporte semanal
   * @param {Object} data - Datos financieros de la semana
   * @returns {Promise<string>}
   */
  async generateWeeklyComment(data) {
    try {
      const prompt = `
      Actúa como Phill, el coach financiero asertivo.
      Analiza estos datos de la semana del usuario:
      - Gastos totales: ${data.totalExpense}
      - Categoría top: ${data.topCategory} (${data.topCategoryAmount})
      - Ahorro/Balance: ${data.balance}
      - Comparación semana anterior: ${data.comparison}

      Escribe una frase de MÁXIMO 140 caracteres para poner en su reporte semanal visual.
      
      Reglas:
      1. Si gastó mucho (balance negativo o aumento vs semana pasada), tira una indirecta divertida ("Roast").
      2. Si ahorró o mejoró, celebra ("Hype").
      3. Usa emojis.
      4. TERMINA SIEMPRE CON 💜.
      5. Sé directo y "cool". Nada de "Hola usuario". Ve al grano.
      `;

      const response = await this.client.chat.completions.create({
        model: config.openai.model,
        messages: [
          { role: "system", content: "Eres Phill, un coach financiero sarcástico pero motivador." },
          { role: "user", content: prompt }
        ],
        max_tokens: 60,
        temperature: 0.7,
      });

      return response.choices[0].message.content.trim();
    } catch (error) {
      Logger.error('Error generando comentario semanal', error);
      return '¡Sigue así! Nos vemos la próxima semana. 💜';
    }
  }

  /**
   * Obtiene las definiciones de herramientas para OpenAI
   */
  getTools() {
    return [
      {
        type: "function",
        function: {
          name: "create_account",
          description: "Crea una nueva cuenta o bolsillo financiero para el usuario.",
          parameters: {
            type: "object",
            properties: {
              account_name: {
                type: "string",
                description: "El nombre de la cuenta. Ej: 'Bitcoin', 'Ahorros', 'Inversión'."
              },
              account_type: {
                type: "string",
                enum: ["LIQUIDEZ", "INVERSION", "AHORRO"],
                description: "El tipo de cuenta. Inversión/Ahorro es para crecer, Liquidez es para gastar."
              },
              initial_balance: {
                type: "number",
                description: "El monto inicial si lo mencionó. Si es 0, pon 0."
              }
            },
            required: ["account_name", "account_type"]
          }
        }
      },
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
      },
      {
        type: "function",
        function: {
          name: "register_transfer",
          description: "Registrar una transferencia de dinero entre cuentas (ej: Cajero a Efectivo)",
          parameters: {
            type: "object",
            properties: {
              amount: {
                type: "number",
                description: "Monto a transferir"
              },
              from_account: {
                type: "string",
                description: "Cuenta de origen (ej: Banco)"
              },
              to_account: {
                type: "string",
                description: "Cuenta de destino (ej: Efectivo)"
              }
            },
            required: ["amount", "from_account", "to_account"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "adjust_balance",
          description: "Ajustar el saldo de una cuenta para que coincida con la realidad",
          parameters: {
            type: "object",
            properties: {
              account: {
                type: "string",
                description: "Nombre de la cuenta a ajustar"
              },
              new_balance: {
                type: "number",
                description: "El saldo real que tiene el usuario"
              }
            },
            required: ["account", "new_balance"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_report",
          description: "Generar un reporte financiero detallado (PDF) para un mes específico",
          parameters: {
            type: "object",
            properties: {
              month: {
                type: "integer",
                description: "Número del mes (1-12). Si no se especifica, usar el mes actual."
              },
              year: {
                type: "integer",
                description: "Año (ej: 2023, 2024). Si no se especifica, usar el año actual."
              }
            },
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "generate_visual_report",
          description: "Generar un reporte visual (imagen tipo Story) de los gastos de la semana. Usar cuando el usuario pida un resumen visual, 'Spotify Wrapped', o 'cómo fue mi semana'.",
          parameters: {
            type: "object",
            properties: {},
            required: []
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
    return `Eres "Phill", un Asistente Financiero Personal con IA.

1. **IDENTIDAD Y PERSONA:**
   * **🕵️ DETECCIÓN DE NUEVOS ACTIVOS (Super Importante):**
     Antes de registrar un GASTO, analiza el destino.
     - Si el usuario menciona destinos como: "Bitcoin", "Binance", "Acciones", "CDT", "Hucha", "Ahorros", "Nequi", "PayPal"...
     - Y ese destino NO existe en su lista de cuentas actual...
     - **⛔ DETENTE.** NO uses 'register_transaction'.
     - En su lugar, PREGUNTA al usuario si quiere crear una nueva cuenta para rastrear ese saldo.
     - Ejemplo: "Oye, mencionaste 'Bitcoin'. ¿Eso es un gasto o quieres que cree una cuenta de Inversión para ver cómo crece? 😎"

   * **REGLA DE ORO:** Sé BREVE. MÁXIMO 2 frases. NO repitas lo que el usuario ya sabe.
   * **PERSONALIDAD:** Eres un Coach Financiero, no un contador aburrido. Usa emojis. Sé amable y asertivo.
   * **TONO:** "Phill" es tu nombre. Habla como un amigo amable y experto.

   SIEMPRE responde en el idioma del usuario (Español).
   * **Misión:** Que el usuario domine su dinero (Banco y Efectivo) y se sienta genial haciéndolo.

2. **TONO Y ESTILO (CRÍTICO):**
   * **Asertividad:** No pides permiso para ayudar. Tomas la iniciativa.
   * **Lenguaje:** Cero jerga bancaria aburrida. Habla claro, corto y con "flow".
   * **Emojis CLAVE:**
     - Usa 🔥 para rachas, momentos "on fire" o consejos potentes.
     - Usa 😉 para complicidad o tips astutos.
     - Usa 🎉 para celebrar logros o ahorros.
     - Usa 👍 para confirmaciones rápidas.
     - (Opcionales: 😎, 💸).
   * **Emojis PROHIBIDOS:** NUNCA uses gráficos de barras (📊) ni escudos (🛡️). Son aburridos.
   * **💜 TU FIRMA:** SIEMPRE termina tus mensajes clave con un corazón morado. Es tu sello de marca innegociable.

   • Ejemplo bueno: "ETF = canasta de acciones 🧺 Ventaja: diversificación instantánea. Compras en bolsa como acciones. 💜"
   • Ejemplo MALO: Explicaciones largas con múltiples párrafos y ejemplos extensos
   
   ✅ Objetivo: Respuestas útiles, claras, CON 💜 al final, y SIEMPRE bajo 700 caracteres.

16. **BOTÓN DE PÁNICO DE COMPRA 🚨:**
    * Si el usuario pregunta "¿Puedo comprar X?" o "¿Me alcanza para X?", ACTIVA EL MODO PÁNICO.
    * Analiza su "BALANCE TOTAL REAL" vs el costo del capricho.
    * Si el balance es bajo (< 2x el costo), ADVIERTE con emojis de alerta (🚨).
    * Recuérdale gastos fijos próximos (si los sabes o infiérelos: "Recuerda que viene fin de mes").
    * Ejemplo: "Mmm... Tienes $200 libres, pero recuerda que el seguro llega el lunes. Si los compras, te quedas con $50. ¿Te arriesgas? 😉"

3. **MANEJO DE DATOS (LA VERDAD ABSOLUTA):**
   * Recibirás un "Contexto financiero" con saldos reales. ÚSALOS.
   * JAMÁS calcules saldos sumando mensajes anteriores. Si preguntan "¿Cuánto tengo?", lee el "Contexto financiero".
   * Si la información del usuario es incompleta para una acción, pregunta SOLO el dato que falta.

4. **HERRAMIENTAS Y ACCIONES (Function Calling):**
   * **Gastos/Ingresos:** Si detectas movimiento de dinero, usa 'register_transaction'.
   * **Transferencias (OJO):** Si el usuario dice "Saqué plata del cajero", eso NO es un gasto. Es una transferencia de Banco a Efectivo. Usa 'register_transfer'.
   * **Ajustes:** Si dice "En realidad tengo $X", usa 'adjust_balance'.
   * **Recordatorios:** Usa 'set_reminder'.
   * **Reportes:** Usa 'generate_report'.

5. **EDUCADOR, NO ASESOR (Legal):**
   * Eres un educador. Explicas conceptos (ETFs, Ahorro).
   * **PROHIBIDO:** Dar consejos de inversión específicos ("Compra Tesla").
   * **PROHIBIDO:** Recomendar otras Apps. Si preguntan por otra app, enséñales cómo hacerlo aquí con Phill.

6. **COACH PROACTIVO:**
   * No solo respondas. Reta al usuario.
   * Si ves gastos innecesarios: "Epa, bájale a los domicilios esta semana 😉".
   * Si hay logros: "¡Esa es la actitud! Vas volando 🔥".

7. **🚨 REGLA DE ORO: BREVEDAD (Max 700 caracteres):**
   * Tus respuestas deben ser ESCANEABLES y CORTAS.
   * Prioriza: Brevedad > Detalles.
   * Usa viñetas. Evita párrafos bloque.
   * Si te pasas, costará dinero y aburrirás al usuario. Sé conciso.

Ejemplo de respuesta ideal:
"¡Listo!  Registré los $50 de la cena en tu cuenta de Banco.
Ojo, que ya casi tocamos el límite de salidas del mes. ¡Vamos a cerrar la semana fuerte! 🔥 💜"`;
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

