require('dotenv').config();
const { query, closePool } = require('../src/config/database');
const Logger = require('../src/utils/logger');

async function fixSchema() {
    console.log('🔧 Iniciando Reparación de Esquema Database...');

    const commands = [
        // 1. Currency
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'COP'`,

        // 2. Status
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'completed'`,

        // 3. Constraints (Drop first to be safe)
        `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transaction_currency`,
        `ALTER TABLE transactions ADD CONSTRAINT chk_transaction_currency CHECK (currency IN ('COP', 'USD', 'EUR', 'GBP'))`,

        `ALTER TABLE transactions DROP CONSTRAINT IF EXISTS chk_transaction_status`,
        `ALTER TABLE transactions ADD CONSTRAINT chk_transaction_status CHECK (status IN ('pending', 'completed', 'failed', 'cancelled'))`
    ];

    for (const cmd of commands) {
        try {
            console.log(`Ejecutando: ${cmd}`);
            await query(cmd);
            console.log('✅ OK');
        } catch (error) {
            console.error('❌ Error en comando:', error.message);
            // We continue, maybe it failed because it exists or similar
        }
    }

    // 4. Indexes (Separate try/catch)
    try {
        await query(`CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(user_id, currency)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(user_id, status)`);
        console.log('✅ Índices verificados');
    } catch (error) {
        console.error('⚠️ Error índices:', error.message);
    }

    console.log('🏁 Reparación finalizada.');
    await closePool();
}

fixSchema();
