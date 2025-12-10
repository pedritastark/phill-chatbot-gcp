const { config } = require('../../../config/environment');
const OpenAI = require('openai');

// Capa 4: Fallback profundo usando gpt-4o
// Para casos complejos o ambiguos
class LlmLayer {
    constructor() {
        this.client = new OpenAI({ apiKey: config.openai.apiKey });
        this.model = 'gpt-4o'; // Standard model for reasoning
    }

    async predict(text) {
        try {
            const prompt = `
            Analiza este mensaje financiero complejo y extrae la intención y categoría.
            Mensaje: "${text}"
            
            Categorías válidas: Alimentación, Transporte, Entretenimiento, Salud, Educación, Servicios, Compras, Otros, Ingreso.
            
            Responde EXCLUSIVAMENTE un JSON:
            {
               "categoria": "...",
               "confianza": 0.9,
               "explicacion": "..."
            }
            `;

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: "Eres un analista financiero senior." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);

        } catch (error) {
            console.error('LLM Layer Error:', error.message);
            return null;
        }
    }
}

module.exports = LlmLayer;
