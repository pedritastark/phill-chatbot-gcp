const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

const TEST_PHONE = 'whatsapp:+573009998877';

async function run() {
    try {
        const userRes = await query('SELECT user_id FROM users WHERE phone_number = $1', [TEST_PHONE]);
        if (userRes.rowCount === 0) {
            console.log('User not found');
            return;
        }
        const userId = userRes.rows[0].user_id;

        console.log(`Checking transactions for user ${userId}...`);

        const res = await query(`
            SELECT t.description, t.amount, c.name as category_name, t.confidence_score, t.detected_by_ai
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.category_id
            WHERE t.user_id = $1
            ORDER BY t.created_at DESC
        `, [userId]);

        console.table(res.rows);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

run();
