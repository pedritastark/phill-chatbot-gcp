const twilio = require('twilio');
const { config } = require('../config/environment');
const Logger = require('../utils/logger');

class WhatsappService {
    constructor() {
        this.client = twilio(config.twilio.accountSid, config.twilio.authToken);
        this.from = `whatsapp:${config.twilio.phoneNumber}`;
    }

    /**
     * Envia un mensaje con botones interactivos
     * @param {string} to - Número de destino (formato whatsapp:+57...)
     * @param {string} body - Texto del mensaje
     * @param {Array<{id: string, title: string}>} buttons - Lista de botones (máx 3)
     */
    async sendButtonMessage(to, body, buttons) {
        try {
            if (!to.startsWith('whatsapp:')) {
                to = `whatsapp:${to}`;
            }

            Logger.info(`Enviando botones a ${to}: ${buttons.map(b => b.title).join(', ')}`);

            // Twilio API for logic session buttons (without templates) is limited.
            // We will structure this as a text message with clear options as a robust fallback,
            // but the method signature allows for future upgrade to Content API.

            let messageBody = `${body}\n\n`;
            buttons.forEach((btn, index) => {
                // Simple bullet point style for clarity
                messageBody += `➤ ${btn.title}\n`;
            });
            messageBody += `\n(Toca una opción o escribe)`;

            const message = await this.client.messages.create({
                body: messageBody,
                from: this.from,
                to: to
            });

            return message.sid;

        } catch (error) {
            Logger.error('Error enviando mensaje de WhatsApp', error);
            throw error;
        }
    }

    /**
     * Envia un mensaje de texto simple (wrapper)
     */
    async sendMessage(to, body) {
        if (!to.startsWith('whatsapp:')) {
            to = `whatsapp:${to}`;
        }
        return await this.client.messages.create({
            body: body,
            from: this.from,
            to: to
        });
    }
}

module.exports = new WhatsappService();
