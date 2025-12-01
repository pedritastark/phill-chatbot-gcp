require('dotenv').config();
const AIService = require('../src/services/ai.service');
const Logger = require('../src/utils/logger');

async function testOpenAI() {
    try {
        console.log('Testing OpenAI integration...');
        const response = await AIService.getResponse('Hola, ¿quién eres?', 'test-user');
        console.log('\nResponse from OpenAI:');
        console.log(response);

        if (response && response.includes('Phill')) {
            console.log('\n✅ Test passed: OpenAI responded correctly.');
        } else {
            console.log('\n⚠️ Test warning: Response format unexpected.');
        }
    } catch (error) {
        console.error('\n❌ Test failed:', error);
    }
}

testOpenAI();
