# -*- coding: utf-8 -*-
import os
import random
from datetime import datetime
from flask import Request
from twilio.twiml.messaging_response import MessagingResponse
from google.cloud import firestore
from intent_processor import intent_processor
from llm_decision_layer import llm_decision_layer

# --- CONFIGURACIÓN INICIAL ---
PROJECT_ID = os.environ.get('PROJECT_ID')
DB = firestore.Client()

# --- MANEJADORES DE INTENCIONES ---

def handle_registrar_gasto(entities, from_number, original_message=""):
    """Maneja la lógica para registrar un gasto y calcular el total de la categoría."""
    # DEBUGGING: Imprimir parámetros recibidos
    print(f"=== DEBUG REGISTRAR GASTO ===")
    print(f"Entidades extraídas: {entities}")
    print(f"Mensaje original: {original_message}")
    print("=============================")
    
    # Obtener parámetros de las entidades extraídas
    monto = entities.get('monto', 0)
    categoria = entities.get('categoria', 'Otros Gastos')
    
    print(f"Monto procesado: {monto} (tipo: {type(monto)})")
    print(f"Categoría procesada: {categoria} (tipo: {type(categoria)})")

    if monto > 0:
        # Guardar el nuevo gasto en Firestore
        doc_ref = DB.collection('gastos').document()
        doc_ref.set({
            'usuario_whatsapp': from_number,
            'monto': monto,
            'categoria': categoria,
            'fecha_registro': firestore.SERVER_TIMESTAMP
        })
        
        # Consultar el total de la categoría para el mes actual
        # Filtrar por mes actual para mejor precisión
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1)
        
        gastos_ref = DB.collection('gastos')
        query = (gastos_ref
                .where('usuario_whatsapp', '==', from_number)
                .where('categoria', '==', categoria)
                .where('fecha_registro', '>=', start_of_month))
        
        total_categoria = 0
        for gasto in query.stream():
            total_categoria += gasto.to_dict().get('monto', 0)
            
        return f"Hecho. Tu gasto de ${monto:,} en {categoria} ha sido guardado. Con este, ya sumas ${total_categoria:,} en esta categoría durante el mes."
    else:
        return f"No pude entender el monto del gasto. Inténtalo de nuevo con un número válido, por ejemplo: 'Gasté $50,000 en comida'."


def handle_registrar_ingreso(entities, from_number, original_message=""):
    """Maneja la lógica para registrar un ingreso."""
    # DEBUGGING: Imprimir parámetros recibidos
    print(f"=== DEBUG REGISTRAR INGRESO ===")
    print(f"Entidades extraídas: {entities}")
    print(f"Mensaje original: {original_message}")
    print("===============================")
    
    # Obtener parámetros de las entidades extraídas
    monto = entities.get('monto', 0)
    tipo = entities.get('tipo', 'Otros Ingresos')
    
    print(f"Monto procesado: {monto} (tipo: {type(monto)})")
    print(f"Tipo procesado: {tipo} (tipo: {type(tipo)})")
    
    if monto > 0:
        # Guardar el nuevo ingreso en una colección 'ingresos'
        doc_ref = DB.collection('ingresos').document()
        doc_ref.set({
            'usuario_whatsapp': from_number,
            'monto': monto,
            'tipo': tipo,
            'fecha_registro': firestore.SERVER_TIMESTAMP
        })
        return f"¡Esoooo! Registré un ingreso de ${monto:,} como {tipo}. ¡Felicitaciones por esa entrada de plata!"
    else:
        return f"No pude entender el monto del ingreso. Inténtalo de nuevo con un número válido, por ejemplo: 'Recibí $500,000 de salario'."


def handle_crear_recordatorio(entities, from_number, original_message=""):
    """Maneja la lógica para guardar un recordatorio de una sola vez."""
    # DEBUGGING: Imprimir parámetros recibidos
    print(f"=== DEBUG CREAR RECORDATORIO ===")
    print(f"Entidades extraídas: {entities}")
    print(f"Mensaje original: {original_message}")
    print("=================================")
    
    motivo = entities.get('motivo', 'pago pendiente')
    fecha_str = entities.get('fecha', '')

    if not fecha_str:
        return "No pude entender la fecha para el recordatorio. Por favor, inténtalo de nuevo con una fecha específica."

    # Guardar el recordatorio en una colección 'recordatorios'
    doc_ref = DB.collection('recordatorios').document()
    doc_ref.set({
        'usuario_whatsapp': from_number,
        'motivo': motivo,
        'fecha_recordatorio': fecha_str,
        'fecha_creacion': firestore.SERVER_TIMESTAMP,
        'recordatorio_enviado': False # Añadimos un campo para saber si ya se envió
    })
    
    # Construir la respuesta final
    try:
        # Intentamos convertir la fecha a un formato más amigable
        fecha_obj = datetime.fromisoformat(fecha_str)
        fecha_legible = fecha_obj.strftime("%d de %B a las %I:%M %p")
    except ValueError:
        # Si hay un error, usamos la fecha tal como viene
        fecha_legible = fecha_str

    return f"¡Hecho! Te recordaré sobre '{motivo}' el {fecha_legible}."


def handle_solicitar_resumen(entities, from_number, original_message=""):
    """Maneja la lógica para crear y mostrar un resumen de gastos."""
    # Filtrar por mes actual para mejor precisión
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    
    gastos_ref = DB.collection('gastos')
    query = (gastos_ref
            .where('usuario_whatsapp', '==', from_number)
            .where('fecha_registro', '>=', start_of_month))
    
    resumen = {}
    total_general = 0
    
    for gasto in query.stream():
        gasto_data = gasto.to_dict()
        categoria = gasto_data.get('categoria', 'Otros Gastos')
        monto = gasto_data.get('monto', 0)
        
        resumen[categoria] = resumen.get(categoria, 0) + monto
        total_general += monto
    
    if not resumen:
        return "Aún no tienes gastos registrados este mes para mostrarte un resumen."
    
    # Ordenar categorías por monto (de mayor a menor)
    resumen_ordenado = sorted(resumen.items(), key=lambda x: x[1], reverse=True)
    
    respuesta = f"📊 *Resumen de gastos - {now.strftime('%B %Y')}*\n\n"
    for categoria, total in resumen_ordenado:
        porcentaje = (total / total_general * 100) if total_general > 0 else 0
        respuesta += f"• {categoria}: ${total:,} ({porcentaje:.1f}%)\n"
    respuesta += f"\n💰 *Total Gastado:* ${total_general:,}"
    
    return respuesta


def analyze_user_financial_patterns(from_number):
    """Analiza los patrones financieros del usuario para generar insights personalizados."""
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    
    # Obtener datos del mes actual
    gastos_ref = DB.collection('gastos')
    gastos_query = (gastos_ref
                   .where('usuario_whatsapp', '==', from_number)
                   .where('fecha_registro', '>=', start_of_month))
    
    ingresos_ref = DB.collection('ingresos')
    ingresos_query = (ingresos_ref
                     .where('usuario_whatsapp', '==', from_number)
                     .where('fecha_registro', '>=', start_of_month))
    
    # Analizar gastos
    gastos_por_categoria = {}
    total_gastos = 0
    for gasto in gastos_query.stream():
        data = gasto.to_dict()
        categoria = data.get('categoria', 'Otros')
        monto = data.get('monto', 0)
        gastos_por_categoria[categoria] = gastos_por_categoria.get(categoria, 0) + monto
        total_gastos += monto
    
    # Analizar ingresos
    total_ingresos = 0
    for ingreso in ingresos_query.stream():
        total_ingresos += ingreso.to_dict().get('monto', 0)
    
    # Calcular balance
    balance = total_ingresos - total_gastos
    
    return {
        'total_gastos': total_gastos,
        'total_ingresos': total_ingresos,
        'balance': balance,
        'gastos_por_categoria': gastos_por_categoria,
        'categoria_mayor_gasto': max(gastos_por_categoria.items(), key=lambda x: x[1])[0] if gastos_por_categoria else None,
        'num_categorias': len(gastos_por_categoria)
    }


def generate_personalized_tips(analysis, from_number):
    """Genera tips personalizados basados en el análisis de los datos del usuario."""
    tips_personalizados = []
    
    # Tip basado en balance
    if analysis['balance'] < 0:
        deficit = abs(analysis['balance'])
        tips_personalizados.append(
            f"⚠️ *Atención:* Estás gastando ${deficit:,} más de lo que ingresas este mes. "
            f"Considera revisar tus gastos en {analysis['categoria_mayor_gasto']} que es tu categoría más alta."
        )
    elif analysis['balance'] > 0:
        tips_personalizados.append(
            f"🎉 *¡Excelente!* Tienes ${analysis['balance']:,} de superávit este mes. "
            f"Considera invertir o ahorrar una parte de este dinero."
        )
    
    # Tip basado en categoría de mayor gasto
    if analysis['categoria_mayor_gasto']:
        mayor_gasto = analysis['gastos_por_categoria'][analysis['categoria_mayor_gasto']]
        porcentaje = (mayor_gasto / analysis['total_gastos'] * 100) if analysis['total_gastos'] > 0 else 0
        
        if porcentaje > 40:
            tips_personalizados.append(
                f"🎯 *Enfoque:* {analysis['categoria_mayor_gasto']} representa el {porcentaje:.1f}% de tus gastos. "
                f"¿Hay formas de optimizar esta categoría?"
            )
        
        # Tips específicos por categoría
        categoria = analysis['categoria_mayor_gasto'].lower()
        if 'comida' in categoria or 'aliment' in categoria:
            tips_personalizados.append(
                "🍽️ *Comida:* Cocina más en casa, planifica tus comidas y haz lista de compras. "
                "¡Puedes ahorrar hasta 30% en alimentación!"
            )
        elif 'transporte' in categoria or 'gasolina' in categoria:
            tips_personalizados.append(
                "🚗 *Transporte:* Considera transporte público, carpooling o bicicleta. "
                "¡Cada viaje en carro cuesta más de lo que piensas!"
            )
        elif 'entretenimiento' in categoria or 'diversión' in categoria:
            tips_personalizados.append(
                "🎪 *Entretenimiento:* Busca actividades gratuitas en tu ciudad. "
                "¡Hay muchos eventos y lugares que no cuestan nada!"
            )
        elif 'ropa' in categoria or 'vestimenta' in categoria:
            tips_personalizados.append(
                "👕 *Ropa:* Compra en temporada de rebajas, considera tiendas de segunda mano "
                "o intercambia ropa con amigos."
            )
    
    # Tip basado en diversificación de gastos
    if analysis['num_categorias'] < 3:
        tips_personalizados.append(
            "📊 *Organización:* Tienes pocas categorías de gastos. Considera categorizar mejor tus gastos "
            "para tener un control más detallado de tu dinero."
        )
    elif analysis['num_categorias'] > 8:
        tips_personalizados.append(
            "🔍 *Simplificación:* Tienes muchas categorías. Considera agrupar algunas similares "
            "para tener una vista más clara de tus gastos."
        )
    
    # Tip basado en frecuencia de uso
    if analysis['total_gastos'] == 0:
        tips_personalizados.append(
            "📝 *Empezar:* ¡Genial que estés aquí! Comienza registrando tus gastos diarios "
            "para tener un mejor control de tu dinero."
        )
    
    # Tip basado en el día del mes (para recordatorios)
    now = datetime.now()
    if now.day > 25:
        tips_personalizados.append(
            "📅 *Fin de mes:* Estamos cerca del final del mes. Revisa tu presupuesto "
            "y ajusta tus gastos si es necesario."
        )
    elif now.day < 5:
        tips_personalizados.append(
            "🎯 *Inicio de mes:* ¡Perfecto momento para planificar! Define tus metas financieras "
            "y presupuesto para este mes."
        )
    
    # Tip basado en el monto total de gastos
    if analysis['total_gastos'] > 0:
        if analysis['total_gastos'] > 2000000:  # Más de 2 millones
            tips_personalizados.append(
                "💰 *Gastos altos:* Tienes gastos considerables este mes. Considera revisar "
                "cada compra y preguntarte si realmente la necesitas."
            )
        elif analysis['total_gastos'] < 500000:  # Menos de 500 mil
            tips_personalizados.append(
                "👍 *Gastos controlados:* ¡Excelente control de gastos! Mantén este hábito "
                "y considera ahorrar la diferencia."
            )
    
    return tips_personalizados


def handle_solicitar_tip(entities, from_number, original_message=""):
    """Selecciona y devuelve un tip financiero personalizado o general."""
    # Tips generales
    tips_generales = [
        "💡 *Regla 50-30-20:* 50% necesidades, 30% gustos, 20% ahorro. ¡Es la base de las finanzas personales!",
        "🤖 *Automatización:* Pon tus ahorros en piloto automático. Transfiere una parte apenas recibas tu salario.",
        "⏰ *Regla 24h:* Antes de comprar algo por impulso, espera un día. Si al día siguiente lo sigues queriendo, hágale.",
        "🐜 *Gastos hormiga:* Esos pequeños gastos como el tinto diario suman mucho. ¡Trackéalos!",
        "📱 *Apps de presupuesto:* Usa la tecnología a tu favor para trackear gastos automáticamente.",
        "🎯 *Metas específicas:* 'Ahorrar para viajar a Europa' es mejor que 'ahorrar plata'.",
        "💳 *Tarjetas de crédito:* Úsalas como débito. Si no tienes la plata en efectivo, no la compres.",
        "🏠 *Fondo de emergencia:* Ten 3-6 meses de gastos guardados para imprevistos.",
        "📈 *Inversión temprana:* El interés compuesto es tu mejor amigo. ¡Empieza a invertir joven!",
        "🛒 *Lista de compras:* Nunca vayas al supermercado sin lista. Te ahorrarás compras innecesarias.",
        "🍽️ *Cocina en casa:* Comer fuera es caro. Cocinar en casa es más barato y saludable.",
        "🚗 *Transporte inteligente:* Compara costos entre carro propio, Uber, transporte público y bicicleta.",
        "📚 *Educación financiera:* Lee libros, escucha podcasts, toma cursos. La educación financiera es inversión.",
        "🎪 *Entretenimiento gratuito:* Hay muchas actividades divertidas que no cuestan dinero.",
        "💪 *Habilidades:* Invierte en aprender habilidades que te generen ingresos adicionales."
    ]
    
    # Analizar datos del usuario
    try:
        analysis = analyze_user_financial_patterns(from_number)
        tips_personalizados = generate_personalized_tips(analysis, from_number)
        
        # Combinar tips personalizados con generales
        todos_los_tips = tips_personalizados + tips_generales
        
        # Seleccionar un tip al azar
        tip_seleccionado = random.choice(todos_los_tips)
        
        # Si hay tips personalizados, darle prioridad
        if tips_personalizados and random.random() < 0.6:  # 60% de probabilidad de tip personalizado
            tip_seleccionado = random.choice(tips_personalizados)
        
        return tip_seleccionado
        
    except Exception as e:
        print(f"Error generando tips personalizados: {e}")
        # Fallback a tips generales si hay error
        return random.choice(tips_generales)


def handle_consultar_balance(entities, from_number, original_message=""):
    """Calcula y muestra el balance entre ingresos y gastos del mes actual."""
    now = datetime.now()
    start_of_month = datetime(now.year, now.month, 1)
    
    # Calcular total de ingresos del mes
    ingresos_ref = DB.collection('ingresos')
    ingresos_query = (ingresos_ref
                     .where('usuario_whatsapp', '==', from_number)
                     .where('fecha_registro', '>=', start_of_month))
    
    total_ingresos = 0
    for ingreso in ingresos_query.stream():
        total_ingresos += ingreso.to_dict().get('monto', 0)
    
    # Calcular total de gastos del mes
    gastos_ref = DB.collection('gastos')
    gastos_query = (gastos_ref
                   .where('usuario_whatsapp', '==', from_number)
                   .where('fecha_registro', '>=', start_of_month))
    
    total_gastos = 0
    for gasto in gastos_query.stream():
        total_gastos += gasto.to_dict().get('monto', 0)
    
    balance = total_ingresos - total_gastos
    
    respuesta = f"💰 *Balance del mes - {now.strftime('%B %Y')}*\n\n"
    respuesta += f"📈 Ingresos: ${total_ingresos:,}\n"
    respuesta += f"📉 Gastos: ${total_gastos:,}\n"
    respuesta += f"⚖️ Balance: ${balance:,}"
    
    if balance > 0:
        respuesta += "\n\n🎉 ¡Excelente! Estás en números verdes este mes."
    elif balance < 0:
        respuesta += "\n\n⚠️ Cuidado, estás gastando más de lo que ingresas."
    else:
        respuesta += "\n\n⚖️ Estás en equilibrio perfecto."
    
    return respuesta


def handle_analisis_detallado(entities, from_number, original_message=""):
    """Proporciona un análisis detallado de las finanzas del usuario con insights personalizados."""
    try:
        analysis = analyze_user_financial_patterns(from_number)
        
        if analysis['total_gastos'] == 0 and analysis['total_ingresos'] == 0:
            return "📊 *Análisis Financiero*\n\nAún no tienes datos registrados para hacer un análisis. ¡Comienza registrando tus gastos e ingresos!"
        
        respuesta = "📊 *Análisis Financiero Detallado*\n\n"
        
        # Resumen básico
        respuesta += f"💰 *Balance del mes:* ${analysis['balance']:,}\n"
        respuesta += f"📈 *Total ingresos:* ${analysis['total_ingresos']:,}\n"
        respuesta += f"📉 *Total gastos:* ${analysis['total_gastos']:,}\n\n"
        
        # Análisis de categorías
        if analysis['gastos_por_categoria']:
            respuesta += "🏷️ *Gastos por categoría:*\n"
            gastos_ordenados = sorted(analysis['gastos_por_categoria'].items(), key=lambda x: x[1], reverse=True)
            
            for categoria, monto in gastos_ordenados[:5]:  # Top 5 categorías
                porcentaje = (monto / analysis['total_gastos'] * 100) if analysis['total_gastos'] > 0 else 0
                respuesta += f"• {categoria}: ${monto:,} ({porcentaje:.1f}%)\n"
        
        # Insights personalizados
        respuesta += "\n💡 *Insights personalizados:*\n"
        
        # Insight sobre balance
        if analysis['balance'] < 0:
            deficit = abs(analysis['balance'])
            respuesta += f"⚠️ Estás gastando ${deficit:,} más de lo que ingresas. Considera ajustar tu presupuesto.\n"
        elif analysis['balance'] > 0:
            respuesta += f"🎉 ¡Excelente! Tienes ${analysis['balance']:,} de superávit. ¡Sigue así!\n"
        else:
            respuesta += "⚖️ Estás en equilibrio perfecto entre ingresos y gastos.\n"
        
        # Insight sobre categoría principal
        if analysis['categoria_mayor_gasto']:
            mayor_gasto = analysis['gastos_por_categoria'][analysis['categoria_mayor_gasto']]
            porcentaje = (mayor_gasto / analysis['total_gastos'] * 100) if analysis['total_gastos'] > 0 else 0
            respuesta += f"🎯 Tu mayor gasto es en {analysis['categoria_mayor_gasto']} ({porcentaje:.1f}% del total).\n"
        
        # Insight sobre diversificación
        if analysis['num_categorias'] < 3:
            respuesta += "📊 Considera categorizar mejor tus gastos para un control más detallado.\n"
        elif analysis['num_categorias'] > 8:
            respuesta += "🔍 Tienes muchas categorías. Considera agrupar algunas similares.\n"
        
        # Recomendaciones
        respuesta += "\n🎯 *Recomendaciones:*\n"
        if analysis['balance'] < 0:
            respuesta += "• Revisa tus gastos en la categoría más alta\n"
            respuesta += "• Considera reducir gastos no esenciales\n"
            respuesta += "• Busca formas de aumentar tus ingresos\n"
        else:
            respuesta += "• ¡Excelente manejo financiero!\n"
            respuesta += "• Considera invertir parte de tu superávit\n"
            respuesta += "• Mantén un fondo de emergencia\n"
        
        return respuesta
        
    except Exception as e:
        print(f"Error en análisis detallado: {e}")
        return "Lo siento, hubo un problema generando tu análisis. Intenta de nuevo."


def handle_default(entities, from_number, original_message=""):
    """Maneja las respuestas por defecto cuando no se detecta una intención específica."""
    return ("¡Hola! Soy tu asistente financiero personal. Puedo ayudarte con:\n\n"
            "💰 Registrar gastos\n"
            "📈 Registrar ingresos\n"
            "📊 Ver resumen de gastos\n"
            "⚖️ Consultar balance\n"
            "💡 Consejos financieros\n"
            "📅 Crear recordatorios\n\n"
            "¿En qué te puedo ayudar hoy?")


def get_user_context(from_number):
    """Obtiene el contexto financiero del usuario para el LLM."""
    try:
        now = datetime.now()
        start_of_month = datetime(now.year, now.month, 1)
        
        # Obtener gastos del mes
        gastos_ref = DB.collection('gastos')
        gastos_query = (gastos_ref
                       .where('usuario_whatsapp', '==', from_number)
                       .where('fecha_registro', '>=', start_of_month))
        
        gastos_data = []
        total_gastos = 0
        for gasto in gastos_query.stream():
            data = gasto.to_dict()
            gastos_data.append(data)
            total_gastos += data.get('monto', 0)
        
        # Obtener ingresos del mes
        ingresos_ref = DB.collection('ingresos')
        ingresos_query = (ingresos_ref
                         .where('usuario_whatsapp', '==', from_number)
                         .where('fecha_registro', '>=', start_of_month))
        
        ingresos_data = []
        total_ingresos = 0
        for ingreso in ingresos_query.stream():
            data = ingreso.to_dict()
            ingresos_data.append(data)
            total_ingresos += data.get('monto', 0)
        
        # Calcular balance
        balance = total_ingresos - total_gastos
        
        # Categorías más usadas
        categorias = {}
        for gasto in gastos_data:
            cat = gasto.get('categoria', 'Otros')
            categorias[cat] = categorias.get(cat, 0) + gasto.get('monto', 0)
        
        return {
            'total_gastos_mes': total_gastos,
            'total_ingresos_mes': total_ingresos,
            'balance_mes': balance,
            'categorias_gastos': categorias,
            'num_transacciones': len(gastos_data) + len(ingresos_data),
            'mes_actual': now.strftime('%B %Y')
        }
        
    except Exception as e:
        print(f"Error obteniendo contexto del usuario: {e}")
        return {
            'total_gastos_mes': 0,
            'total_ingresos_mes': 0,
            'balance_mes': 0,
            'categorias_gastos': {},
            'num_transacciones': 0,
            'mes_actual': datetime.now().strftime('%B %Y')
        }


# --- FUNCIÓN PRINCIPAL Y ENRUTADOR ---

# Diccionario que mapea nombres de intenciones a funciones manejadoras
INTENT_HANDLERS = {
    'registrar_gasto': handle_registrar_gasto,
    'registrar_ingreso': handle_registrar_ingreso,
    'crear_recordatorio': handle_crear_recordatorio,
    'solicitar_resumen': handle_solicitar_resumen,
    'solicitar_tip': handle_solicitar_tip,
    'consultar_balance': handle_consultar_balance,
    'analisis_detallado': handle_analisis_detallado,
    'default': handle_default,
}

def phill_chatbot(request: Request):
    """Función principal que se activa con cada mensaje de WhatsApp."""
    response = MessagingResponse()
    
    # Validar que tenemos los datos necesarios
    incoming_msg = request.values.get('Body', '').strip()
    from_number = request.values.get('From', '')

    # DEBUGGING: Imprimir toda la información de la request
    print("=== DEBUG TWILIO REQUEST ===")
    print(f"Request method: {request.method}")
    print(f"Request values: {dict(request.values)}")
    print(f"Request headers: {dict(request.headers)}")
    print(f"Body: '{incoming_msg}'")
    print(f"From: '{from_number}'")
    print("=============================")

    # Validaciones básicas
    if not incoming_msg:
        response.message("Hola! Envíame un mensaje para poder ayudarte con tus finanzas.")
        return response.to_xml()
    
    if not from_number:
        print("Error: No se pudo obtener el número de teléfono del usuario")
        response.message("Lo siento, hubo un problema con tu número de teléfono. Intenta de nuevo.")
        return response.to_xml()

    print(f"Mensaje recibido de {from_number}: '{incoming_msg}'")

    try:
        # NUEVA ARQUITECTURA CON LLM DECISION LAYER
        print("=== PROCESAMIENTO CON LLM DECISION LAYER ===")
        
        # Obtener contexto del usuario
        user_context = get_user_context(from_number)
        print(f"Contexto del usuario: {user_context}")
        
        # Usar LLM para decidir el flujo
        decision = llm_decision_layer.analyze_user_intent(incoming_msg, user_context)
        print(f"Decisión LLM: {decision}")
        
        if decision['decision'] == 'PROCESO_AUTOMATIZADO':
            print("=== FLUJO: PROCESO AUTOMATIZADO ===")
            
            # Si el LLM sugiere un intent específico, usarlo
            if decision.get('intent_suggestion'):
                intent_name = decision['intent_suggestion']
                print(f"Intent sugerido por LLM: {intent_name}")
            else:
                # Fallback al procesador local
                intent_name, confidence = intent_processor.detect_intent(incoming_msg)
                print(f"Intent detectado localmente: {intent_name} (confianza: {confidence:.2f})")
                
                # Si la confianza es muy baja, usar respuesta por defecto
                if confidence < 0.3:
                    print(f"Confianza baja ({confidence:.2f}), usando respuesta por defecto")
                    intent_name = 'default'
            
            # Extraer entidades
            entities = intent_processor.extract_entities(incoming_msg, intent_name)
            print(f"Entidades extraídas: {entities}")
            
            # Usar el diccionario para encontrar la función correcta a ejecutar
            handler = INTENT_HANDLERS.get(intent_name, handle_default)
            respuesta_bot = handler(entities, from_number, incoming_msg)
            
        else:  # CONVERSACION_ASESOR
            print("=== FLUJO: CONVERSACIÓN CON ASESOR ===")
            
            # Generar respuesta usando el LLM como asesor financiero
            respuesta_bot = llm_decision_layer.get_advisor_response(incoming_msg, user_context)
            print(f"Respuesta del asesor LLM: {respuesta_bot}")
        
        # Validar que tenemos una respuesta válida
        if not respuesta_bot or not respuesta_bot.strip():
            respuesta_bot = "Lo siento, no pude procesar tu solicitud. Intenta de nuevo."
        
        print(f"Respuesta final: {respuesta_bot}")
        response.message(respuesta_bot)

    except Exception as e:
        print(f"Error procesando mensaje: {e}")
        import traceback
        print(f"Traceback completo: {traceback.format_exc()}")
        # Mensaje de error más amigable
        response.message("Lo siento, parcero. Tuve un problema procesando eso. Intenta de nuevo o contacta al soporte si el problema persiste.")

    return response.to_xml()
