# 🚀 Guía de Migración a PostgreSQL

Esta guía te llevará paso a paso para migrar tu chatbot Phill de JSON a PostgreSQL.

## 📋 Pre-requisitos

- Node.js instalado
- PostgreSQL instalado y ejecutándose
- Acceso a la terminal

---

## Paso 1: Instalar PostgreSQL

### macOS (con Homebrew)

```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Windows

Descarga e instala desde: https://www.postgresql.org/download/windows/

---

## Paso 2: Crear la Base de Datos

```bash
# Conectar a PostgreSQL
psql postgres

# Crear base de datos
CREATE DATABASE phill_db;

# Crear usuario (opcional, si no usas postgres)
CREATE USER phill_user WITH PASSWORD 'tu_password_seguro';
GRANT ALL PRIVILEGES ON DATABASE phill_db TO phill_user;

# Salir
\q
```

---

## Paso 3: Configurar Variables de Entorno

Crea o actualiza tu archivo `.env`:

```bash
# ====================================
# BASE DE DATOS POSTGRESQL
# ====================================

# Opción 1: Configuración Individual (Desarrollo Local)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=phill_db
DB_USER=postgres
DB_PASSWORD=tu_password_aqui

# Opción 2: URL Completa (Producción - Heroku, AWS, etc.)
# DATABASE_URL=postgresql://usuario:password@host:puerto/nombre_db

# Configuración del Pool
DB_POOL_MAX=20
DB_POOL_MIN=2
DB_IDLE_TIMEOUT=30000
DB_CONNECT_TIMEOUT=5000

# SSL (true para producción)
DB_SSL=false
```

---

## Paso 4: Instalar Dependencias Nuevas

```bash
npm install
```

Esto instalará las nuevas dependencias:
- `pg` - Cliente de PostgreSQL
- `pg-pool` - Pool de conexiones

---

## Paso 5: Ejecutar el Setup de la Base de Datos

Este comando creará todas las tablas, índices, triggers y vistas:

```bash
npm run db:setup
```

**Salida esperada:**

```
🚀 Iniciando configuración de la base de datos...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📡 Probando conexión con PostgreSQL...
✅ Conexión exitosa

📄 Leyendo archivo schema.sql...
✅ Schema leído correctamente

🔨 Creando tablas, índices y triggers...
✅ Base de datos configurada correctamente

🔍 Verificando tablas creadas...
✅ 9 tablas creadas:
   • users
   • accounts
   • categories
   • transactions
   • budgets
   • financial_goals
   • conversations
   • messages
   • ai_insights

🔍 Verificando vistas creadas...
✅ 3 vistas creadas:
   • user_financial_summary
   • monthly_expenses_by_category
   • goals_progress

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 ¡Base de datos configurada exitosamente!
```

---

## Paso 6: Migrar Datos Existentes (Opcional)

Si ya tienes datos en `data/conversations.json` y `data/transactions.json`, mígralos:

```bash
npm run db:migrate
```

Este script:
- ✅ Lee tus archivos JSON actuales
- ✅ Crea usuarios desde los números de teléfono
- ✅ Migra todas las conversaciones y mensajes
- ✅ Migra todas las transacciones
- ✅ Crea categorías y cuentas predeterminadas

**Nota**: Los archivos JSON originales NO se eliminan, se mantienen como respaldo.

---

## Paso 7: O Usar Datos de Ejemplo

Si prefieres empezar con datos de ejemplo:

```bash
npm run db:seed
```

Esto creará:
- 1 usuario de ejemplo (`whatsapp:+1234567890`)
- 5 categorías
- 2 cuentas
- 6 transacciones
- 1 meta financiera
- 1 conversación con mensajes

---

## Paso 8: Verificar la Instalación

Verifica que todo funcione correctamente:

```bash
npm start
```

**Salida esperada:**

```
Validando configuración...
✅ Configuración válida

Verificando conexión a PostgreSQL...
✅ Conexión a PostgreSQL exitosa
🕐 Hora del servidor: 2025-11-07 12:00:00...

============================================================
🚀 Phill WhatsApp Bot iniciado
📡 Puerto: 3000
🌍 Entorno: development
🤖 Modelo: gemini-1.5-flash
📍 Webhook: http://localhost:3000/webhook
💚 Health: http://localhost:3000/health
🗄️  PostgreSQL: 2 conexiones activas
============================================================

Esperando mensajes de WhatsApp... 💜
```

---

## Paso 9: Probar el Bot

1. **Verifica el endpoint de health**:
   ```bash
   curl http://localhost:3000/health
   ```

2. **Envía un mensaje de prueba por WhatsApp**

3. **Verifica que se guardó en PostgreSQL**:
   ```bash
   psql phill_db
   
   SELECT phone_number, name, total_messages 
   FROM users 
   WHERE is_active = true;
   ```

---

## Verificación de Datos

### Ver todos los usuarios

```sql
psql phill_db

SELECT phone_number, name, total_messages, last_interaction
FROM users
ORDER BY last_interaction DESC;
```

### Ver transacciones de un usuario

```sql
SELECT * FROM user_financial_summary
WHERE phone_number = 'whatsapp:+TU_NUMERO';
```

### Ver mensajes recientes

```sql
SELECT m.role, m.content, m.created_at
FROM messages m
JOIN users u ON m.user_id = u.user_id
WHERE u.phone_number = 'whatsapp:+TU_NUMERO'
ORDER BY m.created_at DESC
LIMIT 10;
```

---

## Solución de Problemas

### ❌ Error: "ECONNREFUSED"

**Problema**: PostgreSQL no está ejecutándose.

**Solución**:
```bash
# macOS
brew services start postgresql@15

# Linux
sudo systemctl start postgresql

# Verificar status
psql --version
pg_isready
```

### ❌ Error: "password authentication failed"

**Problema**: Credenciales incorrectas en `.env`

**Solución**:
1. Verifica el usuario y password en `.env`
2. O conecta con el usuario por defecto:
   ```bash
   psql postgres
   \password postgres
   ```

### ❌ Error: "database phill_db does not exist"

**Problema**: No has creado la base de datos.

**Solución**:
```bash
createdb phill_db
# o
psql postgres -c "CREATE DATABASE phill_db;"
```

### ⚠️ Migración parcial o errores

**Solución**: Borra y vuelve a crear la BD

```bash
# CUIDADO: Esto borrará todos los datos
dropdb phill_db
createdb phill_db
npm run db:setup
npm run db:migrate  # o npm run db:seed
```

---

## Backup y Restauración

### Crear Backup

```bash
# Backup completo
pg_dump phill_db > backup_$(date +%Y%m%d).sql

# Backup solo datos
pg_dump -a phill_db > backup_data_$(date +%Y%m%d).sql

# Backup solo schema
pg_dump -s phill_db > backup_schema_$(date +%Y%m%d).sql
```

### Restaurar Backup

```bash
# Restaurar desde backup
psql phill_db < backup_20251107.sql
```

---

## Migración a Producción

### Opción 1: Heroku

```bash
# Agregar addon de PostgreSQL
heroku addons:create heroku-postgresql:mini

# La variable DATABASE_URL se configura automáticamente
# Asegúrate de tener DB_SSL=true en Config Vars

# Deploy
git push heroku main

# Ejecutar setup
heroku run npm run db:setup

# Migrar datos (si los tienes)
heroku run npm run db:migrate
```

### Opción 2: AWS RDS

1. Crea una instancia de PostgreSQL en RDS
2. Configura el Security Group para permitir tu IP
3. Obtén el endpoint de conexión
4. Configura las variables de entorno:
   ```
   DATABASE_URL=postgresql://usuario:password@endpoint:5432/phill_db
   DB_SSL=true
   ```
5. Ejecuta el setup:
   ```bash
   npm run db:setup
   npm run db:migrate
   ```

### Opción 3: Railway.app

1. Crea un proyecto en railway.app
2. Agrega PostgreSQL plugin
3. La URL se configura automáticamente
4. Deploy y ejecuta:
   ```bash
   railway run npm run db:setup
   railway run npm run db:migrate
   ```

---

## Mantenimiento

### Limpiar conversaciones antiguas

```sql
-- Ver conversaciones antiguas
SELECT COUNT(*) FROM conversations 
WHERE is_active = false 
  AND last_message_at < CURRENT_DATE - INTERVAL '90 days';

-- Eliminar conversaciones antiguas (>90 días inactivas)
DELETE FROM conversations 
WHERE is_active = false 
  AND last_message_at < CURRENT_DATE - INTERVAL '90 days';
```

### Ver estadísticas

```sql
-- Estadísticas generales
SELECT 
  COUNT(*) as total_users,
  SUM(total_messages) as total_messages,
  SUM(total_transactions) as total_transactions
FROM users
WHERE is_active = true;

-- Usuarios más activos
SELECT phone_number, name, total_messages, total_transactions
FROM users
WHERE is_active = true
ORDER BY total_messages DESC
LIMIT 10;
```

### Optimizar base de datos

```sql
-- Analizar y optimizar
VACUUM ANALYZE;

-- Ver tamaño de tablas
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Rollback (Volver a JSON)

Si necesitas volver al sistema JSON:

1. **Los archivos JSON originales NO fueron eliminados**
2. Simplemente detén el servidor y revierte los cambios en Git
3. O modifica los servicios para usar JSON nuevamente

---

## Próximos Pasos

Después de la migración exitosa:

1. ✅ Monitorea el rendimiento
2. ✅ Configura backups automáticos
3. ✅ Implementa analytics con las vistas creadas
4. ✅ Considera agregar un dashboard de administración

---

## Recursos Adicionales

- [Documentación de la BD](./DATABASE.md)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [Node-postgres Docs](https://node-postgres.com/)

---

**¡Felicidades! Tu chatbot Phill ahora usa PostgreSQL y está listo para escalar. 🚀**

¿Preguntas? Revisa la documentación o abre un issue en GitHub.

