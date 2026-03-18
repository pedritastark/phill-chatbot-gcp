const { google } = require('googleapis');
const { query: dbQuery } = require('./src/config/database');

async function directSync() {
  try {
    console.log('🔄 Sincronizando emails directamente...');
    
    // Get integration from DB
    const result = await dbQuery(
      'SELECT * FROM email_integrations WHERE user_id = $1 AND is_active = true',
      ['9c64777d-9365-4980-b7a2-6c1cb6609148']
    );
    
    if (result.rows.length === 0) {
      console.log('❌ No integration found');
      return;
    }
    
    const integration = result.rows[0];
    console.log(`✅ Found integration for ${integration.email_address}`);
    
    // Create Gmail client WITHOUT refresh token to avoid refresh attempt
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({
      access_token: integration.access_token,
    });
    
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    
    // Search for emails from test pattern
    const searchQuery = 'from:sebastianpedraza1010@gmail.com';
    console.log(`🔍 Buscando: ${searchQuery}`);
    
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery,
      maxResults: 5,
    });
    
    const messages = response.data.messages || [];
    console.log(`\n📨 Encontrados ${messages.length} mensajes:`);
    
    for (const msg of messages) {
      const fullMsg = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });
      
      const headers = fullMsg.data.payload.headers;
      const subject = headers.find(h => h.name === 'Subject')?.value;
      const from = headers.find(h => h.name === 'From')?.value;
      const date = headers.find(h => h.name === 'Date')?.value;
      
      console.log(`\n  📧 ID: ${msg.id}`);
      console.log(`  ✉️  From: ${from}`);
      console.log(`  📝 Subject: ${subject}`);
      console.log(`  📅 Date: ${date}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

directSync();
