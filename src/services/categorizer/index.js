const Logger = require('../../utils/logger');
const CacheLayer = require('./layers/cache.layer');
const RulesLayer = require('./layers/rules.layer');
const ApiLayer = require('./layers/api.layer');
const LlmLayer = require('./layers/llm.layer');

class HybridCategorizer {
    constructor() {
        this.cache = new CacheLayer();
        this.rules = new RulesLayer();
        this.api = new ApiLayer();
        this.llm = new LlmLayer();
    }

    /**
     * Categoriza un texto usando la estrategia híbrida de 4 capas
     * @param {string} text - Texto del usuario
     * @returns {Promise<Object>} - Resultado { categoria, confianza, fuente, detalles }
     */
    async categorize(text) {
        const cleanText = text.trim();
        if (!cleanText) return null;

        Logger.info(`🧠 Categorizando: "${cleanText}"`);

        // 1. Capa Cache (Instantáneo)
        const cached = this.cache.get(cleanText);
        if (cached) {
            Logger.info(`⚡️ Cache Hit: ${cached.categoria}`);
            return { ...cached, fuente: 'cache' };
        }

        // 2. Capa Reglas (Local < 10ms)
        const ruleResult = this.rules.predict(cleanText);
        if (ruleResult && ruleResult.confianza > 0.8) { // Umbral alto para reglas
            Logger.info(`📏 Rule Match: ${ruleResult.categoria}`);
            this.cache.set(cleanText, ruleResult);
            return { ...ruleResult, fuente: 'rules' };
        }

        // 3. Capa ML API (gpt-4o-mini - Balanceado)
        try {
            const apiResult = await this.api.predict(cleanText);
            if (apiResult && apiResult.confianza > 0.7) {
                Logger.info(`🤖 API Match: ${apiResult.categoria}`);
                this.cache.set(cleanText, apiResult);
                return { ...apiResult, fuente: 'ml_api' };
            }
        } catch (e) {
            Logger.error('Error en ML API Layer', e);
        }

        // 4. Capa LLM Fallback (gpt-4o - Profundo)
        try {
            Logger.info('🐢 Using LLM Fallback...');
            const llmResult = await this.llm.predict(cleanText);
            if (llmResult) {
                this.cache.set(cleanText, llmResult);
                return { ...llmResult, fuente: 'llm_fallback' };
            }
        } catch (e) {
            Logger.error('Error en LLM Fallback Layer', e);
        }

        // Fallback final
        return {
            categoria: 'Otros',
            confianza: 0,
            fuente: 'default',
            detalles: {}
        };
    }
}

module.exports = new HybridCategorizer();
