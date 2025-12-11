const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const HybridCategorizer = require('../src/services/categorizer');
const Logger = require('../src/utils/logger');

async function test() {
    Logger.info('🚀 Starting Hybrid Categorizer Test...');

    const examples = [
        { text: "Uber al trabajo", expectedSource: 'rules', expectedCat: 'Transporte' }, // Should hit rules
        { text: "Netflix", expectedSource: 'rules', expectedCat: 'Entretenimiento' }, // Should hit rules
        { text: "Uber al trabajo", expectedSource: 'cache', expectedCat: 'Transporte' }, // Should hit cache (second time)
        { text: "Gaste 50k en algo raro", expectedSource: 'ml_api', expectedCat: 'Otros' }, // Should hit API (no rule)
        // { text: "Transferencia compleja a Juan por la mitad del arriendo", expectedSource: 'llm_fallback' } // Might hit API or LLM depending on confidence
    ];

    for (const ex of examples) {
        console.log(`\n-----------------------------------`);
        console.log(`Testing: "${ex.text}"`);
        const start = Date.now();
        const result = await HybridCategorizer.categorize(ex.text);
        const duration = Date.now() - start;

        console.log(`Result:`, JSON.stringify(result, null, 2));
        console.log(`Time: ${duration}ms`);

        if (result.fuente === ex.expectedSource) {
            console.log(`✅ Source Match: ${result.fuente}`);
        } else {
            // API and LLM can be tricky to distinguish exactly without mocking, but we check if it's NOT rules/cache if expected
            if (ex.expectedSource === 'ml_api' && result.fuente === 'llm_fallback') {
                console.log(`⚠️ Fallback to LLM (Acceptable)`);
            } else {
                console.log(`❌ Source Mismatch. Expected ${ex.expectedSource}, got ${result.fuente}`);
            }
        }
    }
}

test();
