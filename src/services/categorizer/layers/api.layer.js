const { config } = require('../../../config/environment');
const OpenAI = require('openai');

// Capa 3: ML API usando gpt-4o-mini
// Optimizado para velocidad y costo
class ApiLayer {
    constructor() {
        this.client = new OpenAI({ apiKey: config.openai.apiKey });
        this.model = 'gpt-4o-mini'; // Explicitly use mini model
    }

    async predict(text) {
        try {
            const prompt = `
            Clasifica este gasto financiero en Colombia.
            Texto: "${text}"
            Categorías: Alimentación, Transporte, Entretenimiento, Salud, Educación, Servicios, Compras, Otros.
            
            Responde JSON: { "categoria": "X", "comercio": "Y", "monto": 0, "confianza": 0.0-1.0 }
            Si no hay monto, pon 0.
            `;

            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    { role: "system", content: "Eres un clasificador financiero experto (JSON)." },
                    { role: "user", content: prompt }
                ],
                temperature: 0,
                max_tokens: 100,
                response_format: { type: "json_object" }
            });

            const content = JSON.parse(response.choices[0].message.content);
            return {
                categoria: content.categoria,
                confianza: content.confianza || 0.8,
                comercio: content.comercio,
                detalles: { amount: content.monto }
            };

        } catch (error) {
            console.error('API Layer Error:', error.message);
            return null;
        }
    }
}

module.exports = ApiLayer;
