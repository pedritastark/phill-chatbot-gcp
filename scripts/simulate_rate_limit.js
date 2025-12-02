const RateLimitService = require('../src/services/rate.limit.service');
const Logger = require('../src/utils/logger');

// Mock config for testing
const { config } = require('../src/config/environment');
config.security.rateLimitWindowMs = 2000; // 2 seconds
config.security.dailyMessageLimit = 5; // Low limit for testing

const TEST_USER = '+573001234567';

async function testRateLimit() {
    Logger.info('🧪 Testing Rate Limit (Spam Protection)...');

    // 1. First message (Should pass)
    let result = RateLimitService.checkLimit(TEST_USER);
    console.log(`Msg 1: ${result.allowed ? '✅ Allowed' : '❌ Blocked'} (${result.reason || ''})`);

    // 2. Second message immediately (Should fail)
    result = RateLimitService.checkLimit(TEST_USER);
    console.log(`Msg 2 (Immediate): ${result.allowed ? '✅ Allowed' : '❌ Blocked'} (${result.reason || ''})`);

    if (result.allowed) {
        console.error('❌ Failed: Immediate message should be blocked');
    } else {
        console.log('✅ Success: Immediate message blocked');
    }

    // 3. Wait 2.1 seconds
    console.log('⏳ Waiting 2.1 seconds...');
    await new Promise(resolve => setTimeout(resolve, 2100));

    // 4. Third message (Should pass)
    result = RateLimitService.checkLimit(TEST_USER);
    console.log(`Msg 3 (After wait): ${result.allowed ? '✅ Allowed' : '❌ Blocked'} (${result.reason || ''})`);

    if (!result.allowed) {
        console.error('❌ Failed: Message after wait should be allowed');
    } else {
        console.log('✅ Success: Message after wait allowed');
    }
}

async function testDailyLimit() {
    Logger.info('\n🧪 Testing Daily Limit...');

    // Reset for test
    RateLimitService.userDailyCounts.clear();
    RateLimitService.userTimestamps.clear();

    // Send 5 messages (Limit is 5)
    for (let i = 1; i <= 5; i++) {
        const result = RateLimitService.checkLimit(TEST_USER);
        console.log(`Msg ${i}: ${result.allowed ? '✅ Allowed' : '❌ Blocked'}`);
        // Mock wait to bypass rate limit
        RateLimitService.userTimestamps.set(TEST_USER, Date.now() - 3000);
    }

    // 6th message (Should fail)
    const result = RateLimitService.checkLimit(TEST_USER);
    console.log(`Msg 6 (Over limit): ${result.allowed ? '✅ Allowed' : '❌ Blocked'} (${result.reason || ''})`);

    if (result.allowed) {
        console.error('❌ Failed: 6th message should be blocked by daily limit');
    } else {
        console.log('✅ Success: Daily limit enforced');
    }
}

async function run() {
    await testRateLimit();
    await testDailyLimit();
}

run();
