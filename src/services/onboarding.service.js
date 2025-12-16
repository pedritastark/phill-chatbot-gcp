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

            return "¡Hola! 👋 Soy Phill, tu nuevo asistente financiero con IA.\n\nMi misión es simple: que dejes de estresarte por el dinero y empieces a hacerlo crecer. 🚀\n\nYo ya me presenté... ¿y tú eres? (Dime tu nombre o cómo te gusta que te llamen) 👇";
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

                case 'tutorial_explanation': // NEW: Bridge step
                    return await this.handleTutorialExplanationStep(user, cleanMessage);

                case 'first_expense':
                    return await this.handleFirstExpenseStep(user, cleanMessage);

                case 'confirm_first_expense': // NEW: Confirm Expense
                    return await this.handleConfirmFirstExpenseStep(user, cleanMessage);

                case 'expense_account':
                    return await this.handleExpenseAccountStep(user, cleanMessage);

                case 'goals_input': // NEW: Goals
                    return await this.handleGoalsStep(user, cleanMessage);

                case 'risk_profile_input': // NEW: Risk
                    return await this.handleRiskProfileStep(user, cleanMessage);

                case 'diagnosis_display': // NEW: Diagnosis rating
                    return await this.handleDiagnosisRatingStep(user, cleanMessage);

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
        // ... (Logic stays similar, reusing name extraction) ...
        // Simplified for brevity in this replace block, essentially same logic
        let name = message;
        // Basic extraction logic
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
            message: `¡Un gusto, ${name}! 💜\n\nAntes de empezar a hacer crecer tu dinero, pongámonos serios un segundo. Tu privacidad es sagrada para mí.\n\nNecesito que me des luz verde para tratar tus datos de forma segura. ¿Aceptas los términos y condiciones? 🔒`,
            buttons: [{ id: 'accept', title: 'Acepto' }, { id: 'terms', title: 'Leer Términos' }]
        };
    }


    async handleTermsAcceptanceStep(user, message) {
        const action = message.toLowerCase();


        if (action.includes('leer') || action.includes('terms')) {
            return {
                message: "📜 **Términos y Condiciones**\n\n1. Tus datos son tuyos. No los vendemos.\n2. El modelo de IA que usamos, solo usa tus datos solo para darte una mejor comprensión de lo que necesitas.\n3. Puedes borrar toda tu información escribiendo /reset.\n4. No somos un banco, somos una herramienta educativa.\n\n¿Aceptas para continuar? 💜",
                buttons: [
                    { id: 'accept', title: 'Acepto (Ahora sí)' }
                ]
            };
        } else {
            // Default: Accept
            return await this.handleDataAcceptanceStep(user, message);
        }
    }

    async handleDataAcceptanceStep(user, message) {
        // ... (Logic stays similar)
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'initial_balances' }
        });

        return {
            message: `¡Trato hecho! 🤝💜\n\nVamos a armar tu mapa financiero.\n\nPara ayudarte a crecer, primero necesito saber tu **Punto de Partida**. No necesito centavos exactos, con aproximados basta.\n\n¿Dónde tienes tu dinero hoy? (Ej: "300k en Nequi, 2M en Bancolombia y 50k en la billetera").`
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
        let totalAssets = 0;
        let summary = "Confirma si entendí bien lo que tienes:\n\n";
        for (const acc of accounts) {
            totalAssets += acc.balance;
            summary += `✅ ${acc.name}: ${formatCurrency(acc.balance)}\n`;
        }
        summary += `\n💰 Total: ${formatCurrency(totalAssets)}`;

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
        const action = message.toLowerCase(); // Check button ID or text

        if (action.includes('modificar') || action.includes('retry')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { step: 'initial_balances' }
            });
            return "Entendido. Escríbelo de nuevo por favor (Ej: 'Nequi 200k, Efectivo 50k'):";
        }

        // Accept
        const accounts = data.temp_assets || [];

        // Clean previous accounts (safety)
        const existing = await AccountDBService.findByUser(user.user_id);
        for (const acc of existing) await AccountDBService.delete(acc.account_id);

        let totalAssets = 0;
        let summaryText = "";

        for (const acc of accounts) {
            await AccountDBService.create({
                userId: user.user_id,
                name: acc.name,
                type: acc.type || 'savings',
                balance: acc.balance,
                isDefault: acc.type === 'cash',
                icon: acc.type === 'cash' ? '💵' : '🏦'
            });
            totalAssets += acc.balance;
            summaryText += `${acc.type === 'cash' ? '💵' : '🏦'} ${acc.name}: ${formatCurrency(acc.balance)}\n`;
        }

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'initial_liabilities', total_assets: totalAssets, assets_summary_final: summaryText }
        });

        return `¡Guardado! 💾\n\n**Tu Liquidez Total: ${formatCurrency(totalAssets)}**\n\n\nAhora vamos a la parte que a nadie le gusta, pero es necesaria para tener paz mental: **Las Deudas** 📉\n\n¿Tienes algún saldo pendiente? (Tarjetas, préstamos, o lo que le debes a un amigo).\n\nSi eres libre, escribe con orgullo "Cero".`;
    }

    async handleInitialLiabilitiesStep(user, message) {
        const AIService = require('./ai.service');
        let tempLiabilities = [];
        let summary = "";

        // Check for "no debts"
        const clean = message.toLowerCase();
        if (clean.includes('cero') || clean.includes('nada') || clean.includes('no debo') || clean.includes('libre')) {
            summary = "🎉 ¡Libre de deudas! (Cero pasivos)";
        } else {
            const extracted = await AIService.extractLiabilities(message);
            tempLiabilities = extracted.liabilities || [];

            if (tempLiabilities.length === 0) {
                return "No entendí tus deudas. 🧐 Escribe 'Debo X en Y' o 'Cero' si no tienes.";
            }

            summary = "Confirma tus DEUDAS:\n\n";
            for (const debt of tempLiabilities) {
                summary += `🔴 ${debt.name}: ${formatCurrency(debt.amount)}\n`;
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
            message: summary,
            buttons: [
                { id: 'accept', title: '✅ Perfecto' },
                { id: 'retry', title: '✏️ Corregir' }
            ]
        };
    }

    async handleConfirmLiabilitiesStep(user, message) {
        const data = user.onboarding_data;
        const action = message.toLowerCase();

        if (action.includes('corregir') || action.includes('retry')) {
            await UserDBService.updateUser(user.phone_number, {
                onboarding_data: { step: 'initial_liabilities' }
            });
            return "Ok, cuéntame de nuevo qué deudas tienes (o 'Cero'):";
        }

        // Create Liabilities
        const debts = data.temp_liabilities || [];
        let totalLiabilities = 0;

        for (const debt of debts) {
            await AccountDBService.create({
                userId: user.user_id,
                name: debt.name,
                type: debt.type || 'debt',
                balance: debt.amount,
                icon: '📉',
                color: '#ef4444'
            });
            totalLiabilities += debt.amount;
        }

        const assets = data.total_assets || 0;
        const netWorth = assets - totalLiabilities;

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                step: 'tutorial_explanation',
                net_worth: netWorth
            }
        });

        return {
            message: `Lista la primera parte. \n\n💰💰 **Tu Dinero:** ${formatCurrency(assets)}\n📉 **Lo que debes:** ${formatCurrency(totalLiabilities)}\n\n\nAhora, ** 2.EL HÁBITO** 🧠\n\n Usualmente la gente cree que gasta menos dinero que lo que gasta. Estas "fugas" te están afectando.\n\nVamos a hacer una prueba de lo que puedo hacer. ¿Listo para registrar tu primer movimiento?`,
            buttons: [
                { id: 'yes_start', title: 'Sí, ¡Vamos con eso! 🔥' },
                { id: 'no_wait', title: 'Mmm... mejor no 🐢' }
            ]
        };
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

        return "¡Esa es la actitud! 💪\n\nDime un gasto que hayas hecho hoy (o ayer). Lo que sea.\n\nEjemplo: 'Me comí una empanada de 3k' o 'Pagué 50k de internet'.";
    }

    async handleFirstExpenseStep(user, message) {
        const amount = this.parseAmount(message);
        if (amount === 0) return "No vi el monto. Intenta: '10k en taxi'.";

        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                step: 'confirm_first_expense',
                pending_expense: { amount, description: message }
            }
        });

        return {
            message: `Voy a registrar: **${formatCurrency(amount)}**\nDetalle: "${message}"\n\n¿Es correcto?`,
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
            return "Vale, dime el gasto de nuevo (Ej: '10k taxi'):";
        }

        const data = user.onboarding_data;
        const amount = data.pending_expense.amount;

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
            // Crear una cuenta por defecto de emergencia
            const defaultAcc = await AccountDBService.create({
                userId: user.user_id, name: 'Efectivo', type: 'cash', balance: 0, isDefault: true
            });
            accounts.push(defaultAcc);
        }
        // ------------------------------------------
        const buttons = accounts.slice(0, 3).map(a => ({ id: a.name, title: a.name }));

        return {
            message: `Ok, ${formatCurrency(amount)}. Ahora, ¿De dónde salió la plata? 👇`,
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
        const expense = data.pending_expense;

        // Register Transaction
        // FinanceService already imported at top level
        const category = await FinanceService.categorizeTransaction(expense.description);

        await FinanceService.createTransaction(
            user.phone_number,
            'expense',
            expense.amount,
            expense.description,
            category,
            target.name
        );

        // Move to Goals
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: { step: 'goals_input' }
        });

        // Detect account type for custom messaging
        const isLiability = ['credit_card', 'loan', 'debt'].includes(target.type);
        let transactionMsg = "";

        if (isLiability) {
            transactionMsg = `🔴 Deuda aumentada en ${target.name} por ${formatCurrency(expense.amount)}`;
        } else {
            transactionMsg = `✅ Descontado de ${target.name}`;
        }

        return `¡Listo! ${warningMsg}${transactionMsg}.\n\n📂 **Categoría:** ${category}\n\n💡 **Dato Curioso:**\nTus gastos se organizan automáticamente. Así luego podrás preguntarme cosas como:\n_"¿Cuánto he gastado en transporte este mes?"_ ó _"¿En qué se me fue la plata la semana pasada?"_\n\n---\n\nAhora sí, **FASE 3: EL FUTURO** 🚀\n\n¿Para qué quieres organizar tu dinero?\n\nEjemplos:\n- "Quiero comprar una moto"\n- "Salir de deudas"\n- "Viajar a Europa"\n- "Tener paz mental"`;
    }

    async handleGoalsStep(user, message) {
        // Store Goal text temporarily
        await UserDBService.updateUser(user.phone_number, {
            onboarding_data: {
                step: 'risk_profile_input',
                goal_text: message
            }
        });

        return `Anotado. 🎯\n\nÚltima pregunta vital (Psicología pura 🧠):\n\nSi mañana tus inversiones caen un 20% por una crisis mundial..., que harías?\n\nA) ¿Vendes todo en pánico para no perder más? 😱\nB) ¿Esperas tranquilo? 😐\nC) ¿Aprovechas y compras más barato? 🤑\n\n(Dime qué harías sinceramente).`;
    }

    async handleRiskProfileStep(user, message) {
        const AIService = require('./ai.service');
        const data = user.onboarding_data;

        // Analyze Profile
        const analysis = await AIService.analyzeFinancialProfile(data.goal_text, message);

        // Save to DB
        await UserDBService.updateProfile(user.user_id, {
            primaryGoal: data.goal_text, // or mapped enum
            riskTolerance: analysis.risk_profile,
            // Custom fields need to be handled in UserDBService or just generalized
            // For now, we update specific columns via generic update if supported 
        });

        // Specific columns added in migration
        await UserDBService.updateUser(user.phone_number, {
            financial_goal_level: analysis.goal_level,
            financial_diagnosis: analysis.triage_text,
            onboarding_data: { step: 'diagnosis_display' }
        });

        return `🔍 **DIAGNÓSTICO FINAL DE PHILL**\n\n${analysis.triage_text}\n\nVeo que tienes una meta clara y tu perfil de riesgo influye en cómo lograrla.\n\nHe configurado tu plan. 🏁\n\n¿Qué te pareció este inicio? (Califícame para mejorar)`;
    }

    async handleDiagnosisRatingStep(user, message) {
        // Extract rating if possible, or just buttons
        // Assuming buttons sent 1-5 or user typed

        // Set Reminder
        const now = new Date();
        const scheduledTime = new Date(now);
        scheduledTime.setHours(20, 0, 0, 0);
        if (scheduledTime < now) scheduledTime.setDate(scheduledTime.getDate() + 1);

        await ReminderDBService.createReminder({
            userId: user.user_id,
            message: "Cierre diario 🌙. ¿Qué gastos hiciste hoy?",
            scheduledAt: scheduledTime,
            isRecurring: true,
            recurrencePattern: 'daily'
        });

        await UserDBService.updateUser(user.phone_number, {
            onboarding_completed: true,
            onboarding_data: { step: 'completed' },
            onboarding_rating: 5 // Default or parsed
        });

        return `¡Gracias! ⭐⭐⭐⭐⭐\n\nTu transformación financiera empieza hoy.\n\n🔔 **Mi compromiso:** Te escribiré cada noche a las 8 PM para cerrar el día (puedes cambiar la hora después escribiendo /config).\n\n¡A romperla! 🔥💜`;
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
