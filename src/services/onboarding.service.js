const UserDBService = require('./db/user.db.service');
const AccountDBService = require('./db/account.db.service');
const FinanceService = require('./finance.service');
const ReminderDBService = require('./db/reminder.db.service');
const Logger = require('../utils/logger');
const { formatCurrency } = require('../utils/formatter');

class OnboardingService {

    /**
     * Inicia el proceso de onboarding para un usuario
     */
    async startOnboarding(userId) {
        try {
            await UserDBService.updateUser(userId, {
                onboarding_completed: false,
                onboarding_data: { step: 'name_input' }
            });

            return "¡Hola! 🎩 Soy Phill, tu asistente financiero con IA.\n\nMi misión es simple: que dejes de estresarte por el dinero y empieces a hacerlo crecer 🏆\n\nYo ya me presenté… ahora dime tú\n¿Cómo te gusta que te llame?";
        } catch (error) {
            Logger.error(`Error iniciando onboarding para ${userId}`, error);
            throw error;
        }
    }

    /**
     * Procesa un mensaje dentro del flujo de onboarding
     */
    async processMessage(userId, message) {
        try {
            const user = await UserDBService.findByPhoneNumber(userId);
            if (!user) throw new Error('Usuario no encontrado');

            const step = user.onboarding_data?.step || 'name_input';

            const cleanMessage = message.trim();

            switch (step) {
                case 'name_input':
                    return await this.handleNameStep(user, cleanMessage);

                case 'data_acceptance':
                    return await this.handleTermsAcceptanceStep(user, cleanMessage);

                case 'terms_acceptance': // Alias just in case
                    return await this.handleTermsAcceptanceStep(user, cleanMessage);

                case 'initial_balances': // Now handling ASSETS input
                    return await this.handleInitialAssetsStep(user, cleanMessage);

                case 'confirm_assets': // NEW: Confirm Assets
                    return await this.handleConfirmAssetsStep(user, cleanMessage);

                case 'initial_liabilities': // NEW: Handling LIABILITIES input
                    return await this.handleInitialLiabilitiesStep(user, cleanMessage);

                case 'confirm_liabilities': // NEW: Confirm Liabilities
                    return await this.handleConfirmLiabilitiesStep(user, cleanMessage);

                case 'menu_selection': // NEW: Menu selection
                    return await this.handleMenuSelectionStep(user, cleanMessage);

                case 'reminder_creation_onboarding': // Reactivated
                    return await this.handleReminderCreationOnboardingStep(user, cleanMessage);

                case 'first_expense': // Reactivated
                    return await this.handleFirstExpenseStep(user, cleanMessage);

                case 'confirm_first_expense': // Reactivated
                    return await this.handleConfirmFirstExpenseStep(user, cleanMessage);

                case 'expense_account': // Reactivated
                    return await this.handleExpenseAccountStep(user, cleanMessage);

                // --- STEPS REMOVED: Goals, Risk ---
                /*
                case 'goals_input': // NEW: Goals
                    return await this.handleGoalsStep(user, cleanMessage);

                case 'risk_profile_input': // NEW: Risk
                    return await this.handleRiskProfileStep(user, cleanMessage);

                case 'diagnosis_display': // NEW: Diagnosis rating
                    return await this.handleDiagnosisRatingStep(user, cleanMessage);
                */

                default:
                    return "¡Ya casi terminamos! ¿Estás listo para comenzar? 💜";
            }

        } catch (error) {
            Logger.error(`Error onboarding ${userId}`, error);
            return "Tuve un pequeño error técnico. ¿Intentamos de nuevo? 💜";
        }
    }

    // --- STEP HANDLERS ---

    async handleNameStep(user, message) {
        let name = message;
        const prefixes = ['me llamo', 'mi nombre es', 'soy', 'dime'];
        const lower = message.toLowerCase();
        for (const p of prefixes) {
            if (lower.startsWith(p + ' ')) name = message.substring(p.length).trim();
        }

        await UserDBService.updateUser(user.phone_number, {
            name: name,
            onboarding_data: { step: 'data_acceptance' }
        });

        return {
            message: `¡Un gusto, ${name}! 💜\n\nAntes de empezar a mover números, una cosa importante:\ntu privacidad es sagrada para mí.\n\nRecuerda:\n1️⃣ Respetamos la privacidad de tus datos.\n2️⃣ La IA solo usa tu información para ayudarte.\n3️⃣ No damos asesoría financiera, te ayudamos en el camino. Somos una herramienta educativa.\n\nPara ayudarte bien necesito tu permiso para tratar tus datos de forma segura.\n¿Aceptas los términos y condiciones? 🟣`,
            buttons: [{ id: 'accept', title: '⚜️ Acepto' }, { id: 'terms', title: '🌂 Leer términos' }]
        };
    }


    async handleTermsAcceptanceStep(user, message) {
        const action = message.toLowerCase();

        if (action.includes('leer') || action.includes('terms')) {
            return {
                message: "🌂 **Términos y Condiciones:** www.phillfinance.com/tyc \n\n¿Aceptas para continuar? 💜",
                buttons: [
                    { id: 'accept', title: '⚜️ Acepto' }
                ]
            };
        } else {
            return await this.handleDataAcceptanceStep(user, message);
        }
    }

    async handleDataAcceptanceStep(user, message) {
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'initial_balances' }
        });

        return {
            message: `¡Excelente! 🏆 Estás a un paso de tomar el control.\n\nPara ayudarte de verdad, necesito saber con qué herramientas contamos. Aquí no hay juicios, solo estrategia para crecer.\n\nCuéntame, ¿cuánto tienes hoy y en qué lugares (cuentas o efectivo) está?\n\nEjemplo:\n'300k en Nequi, 2M en Bancolombia, 50 mil en efectivo, 800.000 debajo del colchón y 25 Dólares"\n\nNota: Si tienes tarjetas de crédito este NO es el momento para registrarlas`
        };
    }

    async handleInitialAssetsStep(user, message) {
        const AIService = require('./ai.service');
        // FIX: Detectar intencionalidad de cero
        if (message.toLowerCase().includes('nada') || message.toLowerCase().includes('cero')) {
            // Crear cuenta dummy con 0
            const accounts = [{ name: 'Efectivo', balance: 0, type: 'cash' }];

            // Prepare preview for Zero case
            let totalAssets = 0;
            const summary = "Confirma si entendí bien lo que tienes:\n\n✅ Efectivo: $0\n\n💰 Total: $0";

            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: {
                    step: 'confirm_assets',
                    temp_assets: accounts,
                    assets_summary_text: summary
                }
            });

            return {
                message: summary,
                buttons: [
                    { id: 'accept', title: '✅ Está perfecto' },
                    { id: 'retry', title: '✏️ Modificar' }
                ]
            };
        }

        const extracted = await AIService.extractInitialBalances(message);
        const accounts = extracted.accounts || [];

        if (accounts.length === 0) {
            return "Mmm, mi cerebro de IA se confundió con los números 😵‍💫.\n\nIntenta ponerlo así de simple:\n'Nequi 200000, Efectivo 50000'";
        }

        // Prepare preview
        let totalAssetsCOP = 0;
        let totalAssetsUSD = 0;
        let summary = "Confirma si entendí bien lo que tienes:\n\n";

        for (const acc of accounts) {
            const currency = acc.currency || 'COP';
            if (currency === 'COP') totalAssetsCOP += acc.balance;
            else if (currency === 'USD') totalAssetsUSD += acc.balance;

            summary += `✅ ${acc.name}: ${formatCurrency(acc.balance, currency)}\n`;
        }

        let totalStr = "";
        if (totalAssetsCOP > 0) totalStr += formatCurrency(totalAssetsCOP, 'COP');
        if (totalAssetsUSD > 0) {
            if (totalStr) totalStr += " + ";
            totalStr += formatCurrency(totalAssetsUSD, 'USD');
        }

        summary += `\n💰 Total: ${totalStr || '$0'}`;

        // Save temp data and move to confirmation
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                step: 'confirm_assets',
                temp_assets: accounts,
                assets_summary_text: summary
            }
        });

        return {
            message: summary,
            buttons: [
                { id: 'accept', title: '✅ Está perfecto' },
                { id: 'retry', title: '✏️ Modificar' }
            ]
        };
    }

    async handleConfirmAssetsStep(user, message) {
        const data = user.onboarding_data;
        const action = message.toLowerCase();

        if (action.includes('modificar') || action.includes('retry')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { step: 'initial_balances' }
            });
            return "Entendido. Escríbelo todo de nuevo por favor \n '300k en Nequi, 2M en Bancolombia, 50 mil en efectivo, 800.000 en un zapato y 25 Dólares'";
        }

        const accounts = data.temp_assets || [];

        const existing = await AccountDBService.findByUser(user.user_id);
        for (const acc of existing) await AccountDBService.delete(acc.account_id);

        let totalAssetsCOP = 0;
        let totalAssetsUSD = 0;
        let summaryText = "";

        for (const acc of accounts) {
            const currency = acc.currency || 'COP';
            await AccountDBService.create({
                userId: user.user_id,
                name: acc.name,
                type: acc.type || 'savings',
                balance: acc.balance,
                currency: currency,
                isDefault: acc.type === 'cash' && currency === 'COP',
                icon: acc.type === 'cash' ? '🟪' : '🟣'
            });

            if (currency === 'COP') totalAssetsCOP += acc.balance;
            else if (currency === 'USD') totalAssetsUSD += acc.balance;

            summaryText += `${acc.type === 'cash' ? '🟪' : '🟣'} ${acc.name}: ${formatCurrency(acc.balance, currency)}\n`;
        }

        let totalStr = "";
        if (totalAssetsCOP > 0) totalStr += formatCurrency(totalAssetsCOP, 'COP');
        if (totalAssetsUSD > 0) {
            if (totalStr) totalStr += " + ";
            totalStr += formatCurrency(totalAssetsUSD, 'USD');
        }

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'initial_liabilities', total_assets: totalStr, assets_summary_final: summaryText }
        });

        return `¡Listo! Tienes ${totalStr} a tu favor. 🏆\n\nAhora vamos por tu tranquilidad financiera. No veas las deudas como un problema, sino como algo que vamos a gestionar juntos. ¿Qué compromisos o saldos tienes pendientes por pagar hoy?\n\nNota: Si tienes tarjeta de credito recuerda aclarar el cupo y cuanto has gastado\n\nEjemplo: " Debo 1M a mi tía y 200.000 de un credito, ademas tengo una tarje de credito con cupo de 2M y gastado 500 mil"\n\nSi no tienes, escribe: Cero.`;
    }

    async handleInitialLiabilitiesStep(user, message) {
        const AIService = require('./ai.service');
        let tempLiabilities = [];
        let summary = "";

        const clean = message.toLowerCase();
        if (clean.includes('cero') || clean.includes('nada') || clean.includes('no debo') || clean.includes('libre')) {
            summary = "🏆 ¡Libre de deudas! (Cero pasivos)";
        } else {
            const extracted = await AIService.extractLiabilities(message);
            tempLiabilities = extracted.liabilities || [];

            if (tempLiabilities.length === 0) {
                return "No entendí tus deudas. 🎩 Escribe 'Debo X en Y' o 'Cero' si no tienes.";
            }

            summary = "Confirma tus DEUDAS:\n\n";
            for (const debt of tempLiabilities) {
                if (debt.type === 'credit_card') {
                    // Format credit cards with cupo/usado
                    const limit = debt.credit_limit || 0;
                    const used = debt.amount_used || 0;
                    summary += `💳 ${debt.name}: Cupo ${formatCurrency(limit)}, Usado ${formatCurrency(used)}\n`;
                } else {
                    // Format regular debts
                    summary += `🟣 ${debt.name}: ${formatCurrency(debt.amount)}\n`;
                }
            }
        }

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                ...user.onboarding_data,
                step: 'confirm_liabilities',
                temp_liabilities: tempLiabilities,
                liabilities_summary_text: summary
            }
        });

        return {
            message: summary + "\n\n¿Está bien o deseas modificarlo?",
            buttons: [
                { id: 'accept', title: '⚜️ Perfecto' },
                { id: 'retry', title: '☂️ Corregir' }
            ]
        };
    }

    async handleConfirmLiabilitiesStep(user, message) {
        const data = user.onboarding_data;
        const action = message.toLowerCase();

        if (action.includes('corregir') || action.includes('retry')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { ...data, step: 'initial_liabilities' }
            });
            return "Ok, cuéntame de nuevo qué deudas tienes (o 'Cero'):";
        }

        const debts = data.temp_liabilities || [];
        let totalLiabilities = 0;

        for (const debt of debts) {
            if (debt.type === 'credit_card') {
                // Create credit card with proper cupo/usado fields
                const used = debt.amount_used || 0;
                const limit = debt.credit_limit || 0;

                await AccountDBService.create({
                    userId: user.user_id,
                    name: debt.name,
                    type: 'credit_card',
                    balance: used,           // Lo usado es la deuda actual
                    creditLimit: limit,      // El cupo total
                    icon: '💳',
                    color: '#ef4444'         // Red for credit cards
                });
                totalLiabilities += used;   // Solo cuenta lo usado como deuda
            } else {
                // Create regular debt account
                await AccountDBService.create({
                    userId: user.user_id,
                    name: debt.name,
                    type: debt.type || 'debt',
                    balance: debt.amount,
                    icon: '🟣',
                    color: '#8b5cf6'
                });
                totalLiabilities += debt.amount;
            }
        }

        const assets = data.total_assets || 0;

        // Move to Menu Selection
        await UserDBService.updateUser(user.phone_number, {
            // onboarding_completed: false, // Still in onboarding
            onboarding_data: {
                ...data,
                step: 'menu_selection',
                total_liabilities: totalLiabilities
            }
        });

        // Safe display for assets (which might be a string due to currency support)
        const assetsDisplay = typeof assets === 'string' ? assets : formatCurrency(assets);

        return {
            message: `Tu balance inicial: 🎩\n\n🏆 Activos: ${assetsDisplay}\n🟣 Pasivos: ${formatCurrency(totalLiabilities)}\n\nListo, ya tenemos todo lo necesario para comenzar, como asistente financiero estoy aquí para ayudarte, ¿te gustaría probar alguna de mis funciones?`,
            buttons: [
                { id: 'reminders', title: 'Crear recordatorios' },
                { id: 'register', title: 'Registrar gastos/ingresos' },
                { id: 'exit', title: 'En este momento no' }
            ]
        };
    }

    async handleMenuSelectionStep(user, message) {
        const selection = message.toLowerCase();

        if (selection.includes('recordatorio')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: {
                    ...user.onboarding_data,
                    step: 'reminder_creation_onboarding',
                    tried_reminders: true   // TRACKING
                }
            });
            return "¡Perfecto, vamos con ello! ⚡\n\nEsta es una herramienta superpoderosa para que nunca vuelvas a olvidar una deuda o pagar el recibo del gas.\n\nPara usarlo debes escribir algo como:\n\"Recuérdame pagar el gas todos los 10 de cada mes\"\nO \"recuérdame el miércoles cobrarle a mi tía\".\n\n¡Inténtalo ahora! 👇";
        }

        if (selection.includes('registrar') || selection.includes('gasto') || selection.includes('ingreso')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: {
                    ...user.onboarding_data,
                    step: 'first_expense',
                    tried_expenses: true    // TRACKING
                }
            });
            return "Como asistente financiero, mi misión es saber en qué estás gastando tu dinero (para que tú tomes el control).\n\nPara llevar las cuentas simplemente debes escribirlo en lenguaje natural, por ejemplo:\n- \"Gasté 100k en el casino\"\n- \"Pagué 2.000 en un refresco\"\n\n¡Vamos, pruébalo! Esta vez no afectará tu balance. 👇";
        }

        // Exit / Default
        await UserDBService.updateUser(user.phone_number, {
            onboarding_completed: true,
            onboarding_data: { ...user.onboarding_data, step: 'completed' }
        });

        return "Entiendo que no quieras hacerlo ahora. ¡Sin presiones! 😌\n\nRecuerda que mis funciones principales son:\n\n📌 **Recordatorios**: Para que no se te pasen los pagos.\n💸 **Registro**: Para saber a dónde va tu dinero.\n\nSomos un equipo 💜. Cuando estés listo, solo escríbeme. ¡Hablamos luego!";
    }

    async handleReminderIntroStep(user, message) {
        const action = message.toLowerCase();

        if (action.includes('agendar') || action.includes('si') || action.includes('ok')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { ...user.onboarding_data, step: 'reminder_creation_onboarding' }
            });
            return "¡De una! 🎩\n\nDime qué quieres recordar, cuándo y si se repite.\n\nEjemplo: 'Recordar pagar el agua mañana a las 8 am'";
        }

        // Default: Continue to goals
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { ...user.onboarding_data, step: 'goals_input' }
        });

        return `¡Perfecto! 🏆 Ya tenemos la base clara.\n\nAhora, para ser el mejor equipo, necesito saber qué es lo que realmente te mueve.\nCuéntame con confianza:\n\n**¿Qué quieres lograr o cambiar en tu vida financiera próximamente?**\n\nEjemplos:\n• 'Salir de deudas'\n• 'Comprar una moto'\n• 'Viajar'\n• 'Tener tranquilidad'`;
    }

    async handleReminderCreationOnboardingStep(user, message) {
        const AIService = require('./ai.service');
        const reminderData = await AIService.extractReminder(message);

        if (reminderData) {
            await ReminderDBService.createReminder({
                userId: user.user_id,
                message: reminderData.message,
                scheduledAt: new Date(reminderData.datetime),
                isRecurring: reminderData.is_recurring,
                recurrencePattern: reminderData.recurrence_pattern
            });
        }

        const data = user.onboarding_data;

        // CHECK CROSS-SELLING
        if (!data.tried_expenses) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: {
                    ...data,
                    step: 'first_expense',
                    tried_expenses: true // Mark as trying
                }
            });
            return `¡Anotado! 📝\n\nRecuerda que la otra de mis funciones es registrar tus gastos o ingresos, vamos a probarla ⚡\n\nPara llevar las cuentas simplemente debes escribirlo en lenguaje natural, por ejemplo:\n- "Gasté 100k en el casino"\n- "Pagué 2.000 en un refresco"\n\n¡Vamos, pruébalo! 👇`;
        }

        // HAS TRIED BOTH (or explicitly skipped)
        await UserDBService.updateUser(user.phone_number, {
            onboarding_completed: true,
            onboarding_data: { ...data, step: 'completed' }
        });

        return `¡Anotado! 📝 Te avisaré a tiempo.\n\n---\n\n¡Excelente! 🎉\n\nEstas son funciones para automatizar y llevar el control de tus cosas que seguro te van a ser muy útiles.\n\nPero además, recuerda que cualquier duda que tengas, como por ejemplo:\n• "¿Cuánto gasté en comida el último mes?"\n• "¿Cómo mejoro el uso de mi tarjeta de crédito?"\n• Conceptos de finanzas personales\n\nEstaré allí para responderte y estar contigo en el camino. 💜\n\n¡Empecemos!`;
    }

    async handleTutorialExplanationStep(user, message) {
        if (message.toLowerCase().includes('no') || message.includes('no_wait')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { step: 'first_expense' }
            });
            return "¡Sin miedo! Es solo un ejercicio. 😉 Necesitamos ver que entiendes como funciona. \n\n Estas listo?";
        }

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'first_expense' }
        });

        // Updated Message per user request
        return "Una de mis funciones como asistente financiero es registrar tus **gastos** o **ingresos**.\n\nPor eso quiero que hagas una prueba: dime un gasto o ingreso, el último que recuerdes haber tenido.\n\nEjemplos:\n- 'Me pagaron 100k'\n- 'Gasté 20k en uber'\n- 'Me encontré 50k'";
    }

    async handleFirstExpenseStep(user, message) {
        const AIService = require('./ai.service');
        const analysis = await AIService.analyzeTransaction(message);

        const amount = analysis.amount;
        if (amount === 0) return "No vi el monto. Intenta: '10k en taxi' o 'Gané 50k'.";

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                step: 'confirm_first_expense',
                pending_transaction: {
                    amount: amount,
                    description: analysis.description,
                    type: analysis.type // 'income' or 'expense'
                }
            }
        });

        const typeLabel = analysis.type === 'income' ? 'INGRESO 💰' : 'GASTO 💸';

        return {
            message: `Voy a registrar: **${formatCurrency(amount)}** (${typeLabel})\nDetalle: "${analysis.description}"\n\n¿Es correcto?`,
            buttons: [
                { id: 'accept', title: '✅ Sí, registrar' },
                { id: 'retry', title: '✏️ Corregir' }
            ]
        };
    }

    async handleConfirmFirstExpenseStep(user, message) {
        const action = message.toLowerCase();
        if (action.includes('corregir') || action.includes('retry')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { step: 'first_expense' }
            });
            return "Vale, dime el movimiento de nuevo:";
        }

        const data = user.onboarding_data;
        const transaction = data.pending_transaction; // Now using pending_transaction object

        // Fallback backward compatibility if pending_expense is still there during migration
        const amount = transaction ? transaction.amount : data.pending_expense.amount;
        const type = transaction ? transaction.type : 'expense';

        // Move to Account Selection
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                ...data,
                step: 'expense_account'
            }
        });

        const accounts = await AccountDBService.findByUser(user.user_id);

        // --- FIX: Evita crash si no hay cuentas ---
        if (!accounts || accounts.length === 0) {
            const defaultAcc = await AccountDBService.create({
                userId: user.user_id, name: 'Efectivo', type: 'cash', balance: 0, isDefault: true
            });
            accounts.push(defaultAcc);
        }
        // ------------------------------------------
        const buttons = accounts.slice(0, 3).map(a => ({ id: a.name, title: a.name }));

        let question = "";
        if (type === 'income') {
            question = `Ok, ${formatCurrency(amount)}. ¿A qué cuenta **ENTRÓ** el dinero? 👇`;
        } else {
            question = `Ok, ${formatCurrency(amount)}. ¿De dónde **SALIÓ** el dinero? 👇`;
        }

        return {
            message: question,
            buttons: buttons
        };
    }

    async handleExpenseAccountStep(user, message) {
        const accounts = await AccountDBService.findByUser(user.user_id);
        let target = null;
        let warningMsg = "";

        const cleanMsg = message.trim();
        // Solo intentar índice si el mensaje es corto (ej: "1", "2", "3")
        const isNumericSelection = /^\d+$/.test(cleanMsg);

        if (isNumericSelection) {
            const idx = parseInt(cleanMsg);
            if (idx >= 1 && idx <= accounts.length) {
                target = accounts[idx - 1]; // 0-indexed
            }
        }

        // Si no fue numérico o no encontró por ID, busca por nombre...
        if (!target) {
            // 2. Try name match (case insensitive)
            target = accounts.find(a => a.name.toLowerCase().includes(message.toLowerCase()));
        }

        // Fallback: If still not found, just use default or first
        if (!target) {
            target = accounts.find(a => a.is_default) || accounts[0];
            warningMsg = `(No encontré "${message}", así que lo puse en ${target.name} 😅). `;
        }

        const data = user.onboarding_data;
        const transaction = data.pending_transaction || data.pending_expense; // Compat
        const type = transaction.type || 'expense';

        // Register Transaction
        const category = await FinanceService.categorizeTransaction(transaction.description);

        await FinanceService.createTransaction(
            user.phone_number,
            type,
            transaction.amount,
            transaction.description,
            category,
            target.name
        );



        // CHECK CROSS-SELLING
        if (!data.tried_reminders) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: {
                    ...data,
                    step: 'reminder_creation_onboarding',
                    tried_reminders: true // Mark as trying
                }
            });

            const typeMsg = type === 'income' ? 'Ingreso' : 'Gasto';
            const transactionMsg = `✅ ${typeMsg} registrado y categorizado a **${category}**`;

            return `¡Listo! ${warningMsg}\n${transactionMsg}.\n\nRecuerda que otra de mis funciones es recordarte las cosas importantes para que nunca vuelvas a sufrir por un recibo vencido 🌂\n\nPara usarlo debes escribir algo como:\n"Recuérdame pagar el gas todos los 10 de cada mes"\nO "recuérdame el miércoles cobrarle a mi tía".\n\n¡Inténtalo ahora! 👇`;
        }

        // HAS TRIED BOTH (or explicitly skipped)
        await UserDBService.updateUser(user.phone_number, {
            onboarding_completed: true,
            onboarding_data: { ...data, step: 'completed' }
        });

        const typeMsg = type === 'income' ? 'Ingreso' : 'Gasto';
        const transactionMsg = `✅ ${typeMsg} registrado y categorizado a **${category}**`;

        return `¡Listo! ${warningMsg}\n${transactionMsg}.\n\n---\n\n¡Excelente! 🎉\n\nEstas son funciones para automatizar y llevar el control de tus cosas que seguro te van a ser muy útiles.\n\nPero además, recuerda que cualquier duda que tengas, como por ejemplo:\n• "¿Cuánto gasté en comida el último mes?"\n• "¿Cómo mejoro el uso de mi tarjeta de crédito?"\n• Conceptos de finanzas personales\n\nEstaré allí para responderte y estar contigo en el camino. 💜\n\n¡Empecemos!`;
    }

    async handleGoalsStep(user, message) {
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                ...user.onboarding_data,
                step: 'risk_profile_input',
                goal_text: message
            }
        });

        return `Gracias por contármelo 💜\n\nAhora quiero conocerte un poco mejor, no para juzgarte, sino para ayudarte de la forma correcta.\n\nCada persona vive el dinero distinto, y eso está bien.\n\nCuando se trata de dinero, tú eres más de…\n\nA) Prefiero ir a lo seguro, aunque gane menos 🌂\nB) Me gusta equilibrar seguridad y oportunidad ⚖️\nC) Me siento cómodo tomando riesgos si hay potencial 🏆\n\nNo hay respuestas buenas o malas.\nSolo dime con cuál te identificas más.`;
    }

    async handleRiskProfileStep(user, message) {
        const data = user.onboarding_data;
        const clean = message.toLowerCase().trim();

        let profileType = 'balanced';
        let profileResponse = '';

        if (clean.includes('a') || clean.includes('seguro') || clean.includes('conservador')) {
            profileType = 'conservative';
            profileResponse = `🟣 Perfil Conservador\n\nPerfecto 🎩\nVeo que valoras la tranquilidad y la estabilidad.\nEso significa que conmigo voy a:\n• Priorizar orden y control\n• Evitar decisiones impulsivas\n• Explicarte todo paso a paso\n\nGanarás paz mental antes que emociones fuertes 🌂`;
        } else if (clean.includes('c') || clean.includes('riesgo') || clean.includes('dinamico') || clean.includes('dinámico')) {
            profileType = 'dynamic';
            profileResponse = `🏆 Perfil Dinámico\n\nEntendido 🎩\nTe sientes cómodo con el riesgo si hay visión.\nYo contigo voy a:\n• Ayudarte a medir mejor las decisiones\n• Recordarte no perder el control\n• Pensar en crecimiento, no solo en ahorro\n\nLa clave será la estrategia 💜`;
        } else {
            profileType = 'balanced';
            profileResponse = `⚜️ Perfil Balanceado\n\nBuenísimo 🎩\nTe mueves bien entre cuidar tu dinero y hacerlo crecer.\nCon este perfil voy a:\n• Buscar oportunidades sin desorden\n• Ayudarte a planear antes de decidir\n• Mantener un equilibrio sano\n\nEs un perfil muy completo 🏆`;
        }

        const assets = data.total_assets || 0;
        const liabilities = data.total_liabilities || 0;
        const goal = data.goal_text || 'No especificada';

        await UserDBService.updateUser(user.phone_number, {
            financial_goal_level: goal,
            financial_diagnosis: profileType,
            onboarding_data: { ...data, step: 'diagnosis_display', risk_profile: profileType }
        });

        return `${profileResponse}\n\n---\n\n🎩 DIAGNÓSTICO INICIAL DE PHILL\n\n• Punto de partida: ${formatCurrency(assets)} en activos, ${formatCurrency(liabilities)} en deudas\n• Meta principal: ${goal}\n• Estilo financiero: ${profileType === 'conservative' ? 'Conservador' : profileType === 'dynamic' ? 'Dinámico' : 'Balanceado'}\n\nCon esto ya puedo ayudarte de verdad.\n\nA partir de ahora:\n• Registraré tus movimientos\n• Te daré recordatorios\n• Te explicaré conceptos financieros que necesites\n\nRecuerda: No voy a darte consejos genéricos.\nVoy a ayudarte a tu ritmo y según lo que tú buscas.\n\n¿Cómo te sentiste con este inicio?\nTu feedback me ayuda a mejorar 💜`;
    }

    async handleDiagnosisRatingStep(user, message) {
        const now = new Date();
        const scheduledTime = new Date(now);
        scheduledTime.setHours(20, 0, 0, 0);
        if (scheduledTime < now) scheduledTime.setDate(scheduledTime.getDate() + 1);

        await ReminderDBService.createReminder({
            userId: user.user_id,
            message: "Cierre diario 🌂. ¿Qué gastos hiciste hoy?",
            scheduledAt: scheduledTime,
            isRecurring: true,
            recurrencePattern: 'daily'
        });

        await UserDBService.updateUser(user.phone_number, {
            onboarding_completed: true,
            onboarding_data: { step: 'completed' },
            onboarding_rating: 5
        });

        return `¡Gracias! 🏆🏆🏆🏆🏆\n\nTu transformación financiera empieza hoy.\n\n🌂 Mi compromiso: Te escribiré cada noche a las 8 PM para cerrar el día (puedes cambiar la hora después escribiendo /config).\n\nSi quieres utilizar esta herramienta al máximo, puedes echarle un vistazo a la página web donde hay ejemplos de cómo puedo ayudarte en tu día a día a construir el futuro que buscas.\n\n¡A romperla! 🎩💜`;
    }

    parseAmount(text) {
        if (!text) return 0;
        let clean = text.toLowerCase().trim();
        let multiplier = 1;

        // Detect multipliers strictly (word boundary or immediate suffix)
        // Matches: 10k, 10 k, 10m, 10 m, 10 barras
        // Does NOT match: mercancia, kilometro
        if (/(^|\s|\d)(k)($|\s|\b)/i.test(clean)) multiplier = 1000;
        else if (/(^|\s|\d)(m)($|\s|\b)/i.test(clean)) multiplier = 1000000;
        else if (clean.includes('barra') || clean.includes('luca')) multiplier = 1000;
        clean = clean.replace(/[^\d.,]/g, '');
        if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
        else if (clean.includes(',')) clean = clean.replace(',', '.');
        else if (clean.includes('.')) {
            const parts = clean.split('.');
            if (parts[parts.length - 1].length >= 3) clean = clean.replace(/\./g, '');
        }
        const value = parseFloat(clean);
        return (value || 0) * multiplier;
    }
}

module.exports = new OnboardingService();
