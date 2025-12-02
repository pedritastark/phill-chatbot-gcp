const OnboardingService = require('../src/services/onboarding.service');
const Logger = require('../src/utils/logger');

function testParseAmount(input, expected) {
    const result = OnboardingService.parseAmount(input);
    if (result === expected) {
        Logger.success(`✅ '${input}' -> ${result}`);
    } else {
        Logger.error(`❌ '${input}' -> Expected ${expected}, got ${result}`);
    }
}

Logger.info('Testing parseAmount logic...');

testParseAmount('1000', 1000);
testParseAmount('10k', 10000);
testParseAmount('10K', 10000);
testParseAmount('1.5k', 1500);
testParseAmount('2m', 2000000);
testParseAmount('2M', 2000000);
testParseAmount('10 barras', 10000);
testParseAmount('5 lucas', 5000);
testParseAmount('Hola', 0);
testParseAmount('Tengo 150.000 pesos', 150000);
testParseAmount('2.000.000', 2000000);
testParseAmount('1,500.50', 1500.5); // Formato US/UK a veces pasa
testParseAmount('1.500,50', 1500.5); // Formato CO

Logger.info('Done.');
