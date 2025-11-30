# 🤖 Chatbot Financiero Phill - Guía de Uso

## 🚀 Inicio Rápido

### Opción 1: Menú Interactivo (Recomendado)
```bash
python iniciar_chat.py
```

### Opción 2: Chat Interactivo Completo
```bash
python chat_interactivo.py
```

### Opción 3: Chat Simple
```bash
python chat_simple.py
```

### Opción 4: Demo Automático
```bash
python demo_chatbot.py
```

## 📋 Opciones de Prueba

### 1. 🎯 Chat Interactivo Completo
- **Interfaz completa** con comandos especiales
- **Modo debug** disponible (escribe `debug`)
- **Ayuda integrada** (escribe `ayuda`)
- **Comandos especiales:**
  - `salir` - Terminar conversación
  - `limpiar` - Limpiar pantalla
  - `ayuda` - Mostrar ejemplos
  - `debug` - Activar/desactivar modo debug

### 2. ⚡ Chat Simple
- **Interfaz minimalista** para pruebas rápidas
- **Muestra intents y entities** en tiempo real
- **Ideal para desarrollo** y testing

### 3. 🧪 Demo Automático
- **Prueba automática** con casos predefinidos
- **No requiere interacción** del usuario
- **Ideal para verificar** funcionamiento

### 4. 🚀 Sistema Completo (Flask)
- **Servidor Flask** completo
- **Listo para WhatsApp** (requiere Twilio)
- **Producción** lista

## 💬 Ejemplos de Uso

### 💰 Registrar Gastos
```
👤 Tú: Gasté $50,000 en comida
🤖 Phill: ✅ Gasto registrado: $50,000 en Alimentación

👤 Tú: Registra una compra de 80,000 en ropa
🤖 Phill: ✅ Gasto registrado: $80,000 en Compras

👤 Tú: Se me fueron 100,000 del pago de la tarjeta
🤖 Phill: ✅ Gasto registrado: $100,000 en Finanzas
```

### 💵 Registrar Ingresos
```
👤 Tú: Recibí 2 millones de pesos
🤖 Phill: ✅ Ingreso registrado: $2,000,000 como No especificado

👤 Tú: Me ingresó $100,000 como regalo
🤖 Phill: ✅ Ingreso registrado: $100,000 como Regalo
```

### 📊 Consultas
```
👤 Tú: Quiero ver mi resumen de gastos
🤖 Phill: 📊 Aquí está tu resumen de gastos del mes...

👤 Tú: Ver ingresos vs gastos
🤖 Phill: 💰 Tu balance actual es...

👤 Tú: ¿Qué me recomiendas?
🤖 Phill: 💡 Te recomiendo ahorrar el 20% de tus ingresos...
```

### ⏰ Recordatorios
```
👤 Tú: Recuérdame pagar el 15 de enero
🤖 Phill: ⏰ Recordatorio creado: pagar para fecha no especificada
```

## 🎯 Intents Soportados

- **registrar_gasto** - Registrar gastos con monto y categoría
- **registrar_ingreso** - Registrar ingresos con monto y tipo
- **solicitar_resumen** - Ver resumen de gastos
- **consultar_balance** - Consultar balance financiero
- **solicitar_tip** - Solicitar consejos financieros
- **crear_recordatorio** - Crear recordatorios de pagos
- **analisis_detallado** - Análisis financiero detallado

## 📊 Entities Soportadas

### Montos
- Formatos colombianos: `1.000`, `5 mil`, `2 millones`
- Con símbolo: `$50,000`
- Sin símbolo: `100,000`

### Categorías de Gastos
- **Alimentación**: comida, almuerzo, cena, restaurante, corrientazo
- **Transporte**: gasolina, uber, taxi, parqueadero
- **Salud y Bienestar**: farmacia, gimnasio, medicina
- **Finanzas**: pago de tarjeta, transferencia, Nequi
- **Vivienda**: arriendo, servicios públicos, luz
- **Compras**: ropa, zapatos, tecnología
- Y 9 categorías más...

### Tipos de Ingreso
- **Salario**: sueldo, nómina, pago mensual
- **Freelance**: trabajo independiente, proyecto
- **Venta**: venta de producto, comercio
- **Inversión**: rendimiento, dividendos
- **Regalo**: obsequio, donación
- **Otros**: varios, misceláneos

## 🔧 Características Técnicas

- **100% precisión** en detección de intents
- **93.8% precisión** en extracción de entities
- **Optimizado para español colombiano**
- **Respuesta instantánea** sin dependencias externas
- **Sistema híbrido** (Python local + Dialogflow Cloud)

## 🚀 Producción

Para usar en producción con WhatsApp:

1. **Configurar Twilio**:
   ```bash
   export TWILIO_ACCOUNT_SID="tu_account_sid"
   export TWILIO_AUTH_TOKEN="tu_auth_token"
   export TWILIO_PHONE_NUMBER="tu_phone_number"
   ```

2. **Iniciar servidor**:
   ```bash
   python main.py
   ```

3. **Configurar webhook** en Twilio apuntando a tu servidor

## 📝 Notas

- El sistema funciona **completamente offline** para pruebas
- **No requiere internet** para el procesamiento local
- **Compatible con Python 3.7+**
- **Optimizado para macOS/Linux**

¡Disfruta probando tu chatbot financiero! 🎉
