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

            // Validación: Si no hay botones, enviar texto normal
            if (!buttons || buttons.length === 0) {
                Logger.warn(`Intentando enviar mensaje con botones vacío a ${to}. Enviando texto plano.`);
                return await this.sendMessage(to.replace('whatsapp:', ''), body);
            }

            Logger.info(`Enviando botones a ${to}: ${buttons.map(b => b.title).join(', ')}`);

            // Definir payload según la cantidad de botones
            // WhatsApp Quick Reply limita a 3 botones.
            // Para más de 3, usamos List Picker (Menú de opciones).
            let contentTypes = {};

            if (buttons.length <= 3) {
                // Quick Reply (Botones visibles)
                contentTypes = {
                    "twilio/quick-reply": {
                        "body": body,
                        "actions": buttons.map(b => ({
                            "id": b.id,
                            "title": b.title.substring(0, 20) // WhatsApp limita títulos a 20 chars
                        }))
                    }
                };
            } else {
                // List Picker (Menú desplegable)
                contentTypes = {
                    "twilio/list-picker": {
                        "body": body,
                        "button": "Seleccionar",
                        "items": buttons.map(b => ({
                            "item": b.title.substring(0, 24), // WhatsApp limita items a 24 chars
                            "id": b.id,
                            "description": ""
                        }))
                    }
                };
            }

            // Crear el recurso de contenido dinámico (Content API)
            // Nota: Esto crea un template en la cuenta de Twilio.
            // En producción idealmente se reusarían templates, pero para dinamismo total lo creamos on-the-fly.
            const content = await this.client.content.v1.contents.create({
                friendlyName: `Dynamic_Msg_${Date.now()}`,
                language: 'es',
                types: contentTypes
            });

            // Enviar el mensaje usando el contentSid generado
            const message = await this.client.messages.create({
                contentSid: content.sid,
                from: this.from,
                to: to
            });

            return message.sid;

        } catch (error) {
            Logger.error('Error enviando mensaje de WhatsApp (Content API)', error);

            // Fallback silencioso a texto si falla la Content API
            // (Por ejemplo si las credenciales no tienen permiso de Content API)
            try {
                Logger.warn('Intentando fallback a texto plano...');
                let fallbackBody = `${body}\n\n`;
                buttons.forEach(btn => { fallbackBody += `➤ ${btn.title}\n`; });
                return await this.sendMessage(to, fallbackBody);
            } catch (fallbackError) {
                throw error; // Si falla el fallback, lanzamos el original
            }
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
