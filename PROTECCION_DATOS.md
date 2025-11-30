# 🔒 Protección de Datos - Phill Chatbot Financiero

Guía completa sobre protección de datos personales y cumplimiento regulatorio para el lanzamiento de Phill al mercado.

---

## 📋 Índice

1. [Datos que Maneja Phill](#datos-que-maneja-phill)
2. [Regulaciones Aplicables](#regulaciones-aplicables)
3. [Medidas de Seguridad Técnicas](#medidas-de-seguridad-técnicas)
4. [Política de Privacidad](#política-de-privacidad)
5. [Consentimiento del Usuario](#consentimiento-del-usuario)
6. [Derechos de los Usuarios](#derechos-de-los-usuarios)
7. [Compartir Datos con Terceros](#compartir-datos-con-terceros)
8. [Retención y Eliminación de Datos](#retención-y-eliminación-de-datos)
9. [Breaches y Notificaciones](#breaches-y-notificaciones)
10. [Checklist de Cumplimiento](#checklist-de-cumplimiento)

---

## 📊 Datos que Maneja Phill

### Datos Personales Identificables (PII)

| Tipo de Dato | Ejemplo | Sensibilidad | Almacenamiento |
|--------------|---------|--------------|-----------------|
| **Número de teléfono** | `whatsapp:+573218372110` | 🔴 Alta | PostgreSQL |
| **Nombre** | "Juan Pérez" | 🟡 Media | PostgreSQL |
| **Email** | `usuario@email.com` | 🟡 Media | PostgreSQL (opcional) |

### Datos Financieros Sensibles

| Tipo de Dato | Ejemplo | Sensibilidad | Almacenamiento |
|--------------|---------|--------------|-----------------|
| **Transacciones** | Gastos/Ingresos con montos | 🔴 **MUY ALTA** | PostgreSQL |
| **Ingresos mensuales** | `$5000` | 🔴 **MUY ALTA** | PostgreSQL |
| **Balance de cuentas** | `$10,000` | 🔴 **MUY ALTA** | PostgreSQL |
| **Metas financieras** | "Ahorrar $5000" | 🟡 Media | PostgreSQL |
| **Historial de conversaciones** | Mensajes con contexto financiero | 🔴 Alta | PostgreSQL |

### Datos de Uso y Metadata

- Timestamps de interacciones
- Número de mensajes
- Preferencias de usuario (idioma, moneda, timezone)
- Estadísticas de uso

---

## ⚖️ Regulaciones Aplicables

### 1. **GDPR (General Data Protection Regulation)** - Europa

**Aplicable si:** Tienes usuarios en la UE/EEE

**Requisitos clave:**
- ✅ **Consentimiento explícito** antes de procesar datos
- ✅ **Derecho al olvido** (eliminación de datos)
- ✅ **Portabilidad de datos** (exportar en formato estándar)
- ✅ **Notificación de breaches** en 72 horas
- ✅ **Privacy by Design** (protección desde el diseño)
- ✅ **Data Protection Officer (DPO)** si procesas datos a gran escala

**Sanciones:** Hasta 4% de ingresos anuales o €20M (el mayor)

### 2. **CCPA (California Consumer Privacy Act)** - California, USA

**Aplicable si:** Tienes usuarios en California

**Requisitos clave:**
- ✅ **Derecho a saber** qué datos se recopilan
- ✅ **Derecho a eliminar** datos personales
- ✅ **Derecho a opt-out** de venta de datos
- ✅ **No discriminación** por ejercer derechos

**Sanciones:** $2,500-$7,500 por violación

### 3. **LGPD (Lei Geral de Proteção de Dados)** - Brasil

**Aplicable si:** Tienes usuarios en Brasil

**Requisitos similares a GDPR:**
- ✅ Consentimiento explícito
- ✅ Derecho al olvido
- ✅ Notificación de breaches

### 4. **Regulaciones Financieras**

#### **PCI DSS** (si procesas pagos)
- No aplica directamente a Phill (no procesa pagos)
- Pero: Los datos financieros son igualmente sensibles

#### **Regulaciones de Servicios Financieros**
- **Colombia:** Superintendencia Financiera
- **México:** CNBV (Comisión Nacional Bancaria y de Valores)
- **España:** CNMV (Comisión Nacional del Mercado de Valores)

**⚠️ IMPORTANTE:** Phill es un **educador financiero**, NO un asesor de inversiones registrado. Esto es crítico para cumplimiento.

---

## 🛡️ Medidas de Seguridad Técnicas

### 1. **Encriptación de Datos**

#### ✅ **En Tránsito (HTTPS/TLS)**
```javascript
// Ya implementado: Twilio usa HTTPS
// Asegúrate de que tu servidor también use HTTPS en producción
```

**Recomendaciones:**
- ✅ Usar HTTPS obligatorio (certificado SSL/TLS)
- ✅ TLS 1.2 o superior
- ✅ Validar certificados en webhooks

#### ⚠️ **En Reposo (Base de Datos)**
**CRÍTICO - NO IMPLEMENTADO ACTUALMENTE**

```sql
-- PostgreSQL: Usar columnas encriptadas
-- Opción 1: pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Encriptar datos sensibles antes de insertar
INSERT INTO users (phone_number, encrypted_income)
VALUES ($1, pgp_sym_encrypt($2::text, 'encryption_key'));

-- Opción 2: Encriptación a nivel de aplicación
// Usar crypto de Node.js
const crypto = require('crypto');
const algorithm = 'aes-256-gcm';
```

**Implementar:**
- [ ] Encriptar números de teléfono (o usar hashing)
- [ ] Encriptar montos de transacciones
- [ ] Encriptar balances de cuentas
- [ ] Encriptar historial de conversaciones

### 2. **Autenticación y Autorización**

#### ✅ **Validación de Webhooks de Twilio**
```javascript
// Implementar en producción (ya está documentado en README)
const twilio = require('twilio');

app.use('/webhook', (req, res, next) => {
  const signature = req.headers['x-twilio-signature'];
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    `${req.protocol}://${req.get('host')}${req.originalUrl}`,
    req.body
  );
  
  if (!valid) {
    return res.status(403).send('Forbidden');
  }
  next();
});
```

#### ⚠️ **Autenticación de Usuarios**
**NO IMPLEMENTADO - Considerar para futuras versiones:**
- Verificación de número de teléfono (OTP)
- Autenticación de dos factores (2FA)
- Rate limiting por usuario

### 3. **Seguridad de la Base de Datos**

#### ✅ **PostgreSQL - Buenas Prácticas**
```sql
-- 1. Usar conexiones SSL
-- En DATABASE_URL: ?sslmode=require

-- 2. Usar roles con permisos mínimos
CREATE ROLE phill_app WITH LOGIN PASSWORD 'strong_password';
GRANT SELECT, INSERT, UPDATE ON users TO phill_app;
-- NO dar DELETE a menos que sea necesario

-- 3. Usar prepared statements (ya implementado con pg)
-- Previene SQL injection
```

#### ⚠️ **Backups Encriptados**
```bash
# Backup diario encriptado
pg_dump phill_db | gzip | openssl enc -aes-256-cbc -salt -out backup_$(date +%Y%m%d).sql.gz.enc
```

### 4. **Logging y Auditoría**

#### ⚠️ **NO Registrar Datos Sensibles**
```javascript
// ❌ MALO
Logger.info(`Usuario ${phoneNumber} tiene balance $${balance}`);

// ✅ BUENO
Logger.info(`Usuario ${hashPhone(phoneNumber)} consultó balance`);
// O usar IDs en lugar de números de teléfono
```

**Implementar:**
- [ ] Hash de números de teléfono en logs
- [ ] No registrar montos completos en logs
- [ ] Rotación de logs (eliminar después de X días)
- [ ] Logs de auditoría (quién accedió a qué datos)

### 5. **Variables de Entorno y Secretos**

#### ✅ **Ya Implementado**
- Variables de entorno en `.env`
- `.env` en `.gitignore`
- No hardcodear credenciales

#### ⚠️ **Mejoras Recomendadas**
- [ ] Usar un gestor de secretos (AWS Secrets Manager, HashiCorp Vault)
- [ ] Rotar API keys periódicamente
- [ ] Usar diferentes credenciales por entorno (dev/staging/prod)

### 6. **Rate Limiting**

#### ⚠️ **NO IMPLEMENTADO - CRÍTICO**
```javascript
// Prevenir abuso y ataques
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: 'Demasiadas peticiones, intenta más tarde'
});

app.use('/webhook', limiter);
```

---

## 📄 Política de Privacidad

### **Elementos Obligatorios**

1. **Qué datos recopilas**
   - Número de teléfono
   - Nombre (opcional)
   - Email (opcional)
   - Transacciones financieras
   - Historial de conversaciones

2. **Por qué los recopilas**
   - Proporcionar el servicio de asesoría financiera
   - Registrar gastos e ingresos
   - Personalizar respuestas
   - Mejorar el servicio

3. **Cómo los usas**
   - Procesamiento con IA (Google Gemini)
   - Almacenamiento en base de datos
   - Generación de insights financieros

4. **Con quién los compartes**
   - **Twilio:** Números de teléfono (necesario para WhatsApp)
   - **Google Gemini:** Mensajes y contexto (procesamiento de IA)
   - **NO vendemos datos a terceros**

5. **Derechos del usuario**
   - Acceso a sus datos
   - Corrección de datos
   - Eliminación de datos
   - Portabilidad de datos
   - Oposición al procesamiento

6. **Retención de datos**
   - Período de retención (ej: 2 años después de última interacción)
   - Criterios de eliminación

7. **Contacto**
   - Email: `privacy@phill.com`
   - Dirección física (si aplica)

### **Plantilla de Política de Privacidad**

Crear archivo: `POLITICA_PRIVACIDAD.md` o página web.

---

## ✅ Consentimiento del Usuario

### **Implementación en Phill**

#### **Opción 1: Consentimiento Implícito (Actual)**
El usuario envía un mensaje → Se asume consentimiento.

**⚠️ PROBLEMA:** No cumple con GDPR/CCPA que requieren consentimiento explícito.

#### **Opción 2: Consentimiento Explícito (Recomendado)**

```javascript
// Al primer mensaje, enviar:
const welcomeMessage = `¡Hola! Soy Phill, tu asesor financiero personal 💜

Para usar este servicio, necesito tu consentimiento para:
• Procesar tus datos personales (teléfono, nombre)
• Almacenar tus transacciones financieras
• Usar IA para generar respuestas personalizadas

¿Aceptas nuestra Política de Privacidad?
Responde: SI / NO

Lee más: https://phill.com/privacy`;

// Guardar consentimiento en base de datos
await UserDBService.updateConsent(phoneNumber, {
  accepted: true,
  acceptedAt: new Date(),
  version: '1.0' // Versión de la política
});
```

**Tabla en PostgreSQL:**
```sql
ALTER TABLE users ADD COLUMN privacy_consent BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN consent_accepted_at TIMESTAMP;
ALTER TABLE users ADD COLUMN consent_version VARCHAR(10);
```

---

## 👤 Derechos de los Usuarios

### **1. Derecho de Acceso**

```javascript
// Endpoint: GET /api/user/data
// Usuario solicita sus datos
async function getUserData(phoneNumber) {
  const user = await UserDBService.findByPhoneNumber(phoneNumber);
  const transactions = await TransactionDBService.getByUser(user.user_id);
  const conversations = await ConversationDBService.getByUser(user.user_id);
  
  return {
    user: {
      phone_number: user.phone_number,
      name: user.name,
      email: user.email,
      created_at: user.created_at
    },
    transactions: transactions,
    conversations: conversations,
    export_date: new Date().toISOString()
  };
}
```

### **2. Derecho de Eliminación (Derecho al Olvido)**

```javascript
// Endpoint: DELETE /api/user/data
async function deleteUserData(phoneNumber) {
  const user = await UserDBService.findByPhoneNumber(phoneNumber);
  
  // Soft delete (recomendado) o hard delete
  await UserDBService.delete(user.user_id);
  await TransactionDBService.deleteByUser(user.user_id);
  await ConversationDBService.deleteByUser(user.user_id);
  
  Logger.info(`Datos eliminados para ${phoneNumber}`);
}
```

### **3. Derecho de Portabilidad**

```javascript
// Exportar datos en formato JSON estándar
async function exportUserData(phoneNumber) {
  const data = await getUserData(phoneNumber);
  
  // Formato GDPR-compliant
  return JSON.stringify(data, null, 2);
}
```

### **4. Derecho de Rectificación**

```javascript
// Permitir al usuario corregir sus datos
async function updateUserData(phoneNumber, updates) {
  const user = await UserDBService.findByPhoneNumber(phoneNumber);
  await UserDBService.updateProfile(user.user_id, updates);
}
```

### **Implementación en WhatsApp**

```
Usuario: "Quiero ver mis datos"
Phill: "Te enviaré un resumen de tus datos. ¿A qué email? 💜"

Usuario: "Elimina mis datos"
Phill: "⚠️ Esto eliminará TODOS tus datos permanentemente. ¿Estás seguro? Responde: CONFIRMAR 💜"
```

---

## 🤝 Compartir Datos con Terceros

### **1. Twilio**

**Datos compartidos:**
- Número de teléfono (obligatorio para WhatsApp)
- Mensajes (contenido de conversaciones)

**Protecciones:**
- ✅ Twilio tiene su propia política de privacidad
- ✅ Twilio es GDPR-compliant
- ✅ Revisar: https://www.twilio.com/legal/privacy

**En Política de Privacidad:**
> "Compartimos tu número de teléfono con Twilio, nuestro proveedor de servicios de mensajería, para poder enviarte mensajes a través de WhatsApp. Twilio está sujeto a su propia política de privacidad."

### **2. Google Gemini (IA)**

**Datos compartidos:**
- Mensajes del usuario
- Contexto de conversación
- Datos financieros (resúmenes, transacciones)

**⚠️ CRÍTICO:**
- Google puede usar estos datos para entrenar modelos
- Revisar términos de servicio de Google Gemini
- Considerar usar modo "no-logging" si está disponible

**En Política de Privacidad:**
> "Utilizamos Google Gemini para procesar tus mensajes y generar respuestas. Google puede procesar estos datos según sus términos de servicio. No compartimos datos identificables con fines publicitarios."

### **3. Proveedor de Base de Datos (PostgreSQL)**

**Si usas servicios cloud (AWS RDS, Google Cloud SQL, etc.):**
- Revisar términos de servicio
- Asegurar que el proveedor sea GDPR-compliant
- Usar encriptación en reposo

---

## 🗑️ Retención y Eliminación de Datos

### **Política de Retención Recomendada**

| Tipo de Dato | Período de Retención | Justificación |
|--------------|---------------------|---------------|
| **Transacciones activas** | Mientras el usuario esté activo | Necesario para el servicio |
| **Transacciones inactivas** | 2 años después de última interacción | Cumplimiento legal + recuperación |
| **Conversaciones** | 1 año después de última interacción | Contexto para mejor servicio |
| **Datos de usuario** | 2 años después de última interacción | Cumplimiento legal |
| **Logs de auditoría** | 90 días | Seguridad y debugging |

### **Implementación**

```javascript
// Script de limpieza automática (ejecutar diariamente)
async function cleanupOldData() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  
  // Encontrar usuarios inactivos
  const inactiveUsers = await UserDBService.findInactive(twoYearsAgo);
  
  for (const user of inactiveUsers) {
    // Soft delete o anonimización
    await UserDBService.anonymize(user.user_id);
    Logger.info(`Usuario ${user.phone_number} anonimizado`);
  }
}
```

### **Anonimización vs Eliminación**

**Anonimización (Recomendado):**
- Mantiene datos agregados para analytics
- Elimina identificación personal
- Cumple con GDPR

```sql
-- Anonimizar usuario
UPDATE users 
SET 
  phone_number = 'ANON_' || md5(phone_number),
  name = NULL,
  email = NULL
WHERE user_id = $1;
```

---

## 🚨 Breaches y Notificaciones

### **Plan de Respuesta a Breaches**

1. **Detección**
   - Monitoreo de accesos no autorizados
   - Alertas automáticas
   - Logs de seguridad

2. **Contención**
   - Bloquear accesos comprometidos
   - Cambiar credenciales
   - Aislar sistemas afectados

3. **Evaluación**
   - Determinar alcance del breach
   - Identificar datos afectados
   - Evaluar riesgo para usuarios

4. **Notificación**
   - **GDPR:** 72 horas a autoridad supervisora
   - **Usuarios afectados:** Sin demora indebida
   - **CCPA:** Notificar usuarios de California

### **Template de Notificación**

```
Asunto: Notificación de Breach de Seguridad - Phill

Estimado usuario,

Hemos detectado un incidente de seguridad que pudo haber afectado tus datos.

¿Qué pasó?
[Descripción del incidente]

¿Qué datos se vieron afectados?
- Números de teléfono
- [Otros datos]

¿Qué estamos haciendo?
- [Acciones tomadas]

¿Qué debes hacer?
- [Recomendaciones]

Para más información: privacy@phill.com

Equipo Phill
```

---

## ✅ Checklist de Cumplimiento

### **Antes del Lanzamiento**

#### **Legal**
- [ ] Redactar Política de Privacidad completa
- [ ] Redactar Términos de Servicio
- [ ] Implementar consentimiento explícito
- [ ] Registrar base legal para procesamiento (GDPR Art. 6)
- [ ] Designar Data Protection Officer (si aplica)

#### **Técnico**
- [ ] Implementar validación de webhooks de Twilio
- [ ] Encriptar datos sensibles en base de datos
- [ ] Implementar rate limiting
- [ ] Configurar HTTPS obligatorio
- [ ] Implementar logging seguro (sin datos sensibles)
- [ ] Configurar backups encriptados
- [ ] Implementar autenticación fuerte para administradores

#### **Funcionalidades de Usuario**
- [ ] Endpoint para exportar datos del usuario
- [ ] Endpoint para eliminar datos del usuario
- [ ] Endpoint para corregir datos del usuario
- [ ] Proceso para solicitar datos vía WhatsApp

#### **Documentación**
- [ ] Política de Privacidad publicada
- [ ] Términos de Servicio publicados
- [ ] Documentación de seguridad interna
- [ ] Plan de respuesta a breaches

#### **Proveedores**
- [ ] Revisar términos de Twilio
- [ ] Revisar términos de Google Gemini
- [ ] Revisar términos de proveedor de base de datos
- [ ] Firmar acuerdos de procesamiento de datos (DPA) si aplica

### **Post-Lanzamiento**

- [ ] Auditoría de seguridad anual
- [ ] Revisión de políticas cada 6 meses
- [ ] Monitoreo continuo de accesos
- [ ] Actualización de dependencias de seguridad
- [ ] Entrenamiento del equipo en protección de datos

---

## 📚 Recursos Adicionales

### **Regulaciones**
- [GDPR Texto Completo](https://gdpr-info.eu/)
- [CCPA Texto Completo](https://oag.ca.gov/privacy/ccpa)
- [LGPD Texto Completo](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)

### **Guías de Implementación**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP API Security](https://owasp.org/www-project-api-security/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)

### **Herramientas**
- [GDPR Checklist](https://gdpr.eu/checklist/)
- [Privacy Policy Generators](https://www.privacypolicygenerator.info/)

---

## ⚠️ Advertencias Importantes

1. **Este documento es una guía general.** Consulta con un abogado especializado en protección de datos para tu jurisdicción específica.

2. **Las regulaciones cambian.** Mantén este documento actualizado.

3. **Cumplimiento es un proceso continuo**, no un evento único.

4. **La seguridad técnica es solo una parte.** También necesitas procesos, documentación y cultura organizacional.

---

**Última actualización:** 2024
**Versión:** 1.0

---

💜 **Phill - Protegiendo tus datos, educando tus finanzas**

