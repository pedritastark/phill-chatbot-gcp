require('dotenv').config();
const { query } = require('../src/config/database');

async function check() {
    try {
        console.log('🔍 Checking user CategoryTester...');
        const u = await query("SELECT * FROM users WHERE phone_number = 'whatsapp:+573009998877'");
        console.log('Users found:', u.rows.length);
        console.log(JSON.stringify(u.rows, null, 2));

        if (u.rows.length > 0) {
            const uid = u.rows[0].user_id;
            console.log('🔍 Checking transactions for user:', uid);
            const globalCount = await query('SELECT count(*) FROM transactions');
            console.log('Global transaction count:', globalCount.rows[0].count);

            const allTrans = await query('SELECT user_id, amount, description FROM transactions LIMIT 10');
            console.log('All transactions:', JSON.stringify(allTrans.rows, null, 2));

            const t = await query('SELECT t.*, c.name as category_name FROM transactions t LEFT JOIN categories c ON t.category_id = c.category_id WHERE t.user_id = $1', [uid]);
            console.log('Transactions found:', t.rows.length);
            console.log(JSON.stringify(t.rows, null, 2));
        } else {
            console.log('❌ No users found matching pattern.');
        }
        process.exit(0);
    } catch (e) {
        console.error('❌ Error:', e);
        process.exit(1);
    }
}

check();
