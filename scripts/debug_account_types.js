require('dotenv').config();
const { AccountDBService, UserDBService } = require('../src/services/db');
const { closePool } = require('../src/config/database');

const TEST_PHONE = 'whatsapp:+573000000XXX';

async function checkTypes() {
    try {
        const user = await UserDBService.findByPhoneNumber(TEST_PHONE);
        if (!user) return console.log('User not found');

        const accounts = await AccountDBService.findByUser(user.user_id);
        console.log('User Accounts:', accounts.map(a => ({ name: a.name, type: a.type })));

    } catch (e) { console.error(e); }
    finally { await closePool(); }
}

checkTypes();
