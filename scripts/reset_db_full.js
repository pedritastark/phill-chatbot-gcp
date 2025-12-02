const { query } = require('../src/config/database');
const Logger = require('../src/utils/logger');

async function resetDatabase() {
    try {
        Logger.info('🗑️  Iniciando limpieza de base de datos...');

        // 1. Eliminar datos dependientes primero
        await query('DELETE FROM transactions');
        await query('DELETE FROM reminders');
        await query('DELETE FROM accounts');
        await query('DELETE FROM categories');
        await query('DELETE FROM conversations');

        // 2. Eliminar usuarios
        await query('DELETE FROM users');

        Logger.success('✅ Base de datos limpiada exitosamente');

        // 3. Crear usuario admin si es necesario (opcional, ya que se creará al interactuar)
        // Pero el prompt dice "recuerda que el +573218372110 es el admin"
        // Si queremos que empiece en onboarding, simplemente dejamos que se cree cuando escriba.
        // Si queremos pre-crearlo como admin, podríamos hacerlo aquí, pero el requerimiento dice "todos empiecen en el onboarding".
        // Así que lo mejor es dejarlo limpio.

        Logger.info('ℹ️  Todos los usuarios iniciarán desde cero (Onboarding)');

    } catch (error) {
        Logger.error('Error limpiando la base de datos', error);
    } finally {
        process.exit();
    }
}

resetDatabase();
