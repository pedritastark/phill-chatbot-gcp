#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aplicación Streamlit para el chatbot financiero Phill.
Permite compartir el chatbot con tu equipo a través de una interfaz web.
"""

import streamlit as st
import pandas as pd
from datetime import datetime
from intent_processor import intent_processor
from llm_decision_layer_v2 import llm_decision_layer

# Configuración de la página
st.set_page_config(
    page_title="🤖 Phill - Chatbot Financiero",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS personalizado estilo Facebook
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        color: #1877f2;
        text-align: center;
        margin-bottom: 1.5rem;
        font-weight: bold;
    }
    
    /* Contenedor principal del chat */
    .chat-container {
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        background-color: #f0f2f5;
        border-radius: 10px;
        min-height: 500px;
    }
    
    /* Mensajes del usuario (azules, lado derecho) */
    .user-message {
        background-color: #1877f2;
        color: white;
        padding: 12px 16px;
        border-radius: 18px 18px 4px 18px;
        margin: 8px 0 8px auto;
        max-width: 70%;
        word-wrap: break-word;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
    }
    
    /* Mensajes del bot (blancos, lado izquierdo) */
    .bot-message {
        background-color: white;
        color: #1c1e21;
        padding: 12px 16px;
        border-radius: 18px 18px 18px 4px;
        margin: 8px auto 8px 0;
        max-width: 70%;
        word-wrap: break-word;
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
        border: 1px solid #e4e6ea;
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: flex-start;
    }
    
    /* Timestamp */
    .message-time {
        font-size: 0.75rem;
        opacity: 0.7;
        margin-top: 4px;
    }
    
    .user-message .message-time {
        color: rgba(255,255,255,0.8);
    }
    
    .bot-message .message-time {
        color: #65676b;
    }
    
    /* Debug info */
    .debug-info {
        background-color: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 8px;
        padding: 10px;
        margin-top: 8px;
        font-size: 0.8rem;
        color: #6c757d;
    }
    
    /* Input area */
    .stTextInput > div > div > input {
        border-radius: 20px;
        border: 1px solid #e4e6ea;
        padding: 12px 16px;
        font-size: 16px;
    }
    
    .stTextInput > div > div > input:focus {
        border-color: #1877f2;
        box-shadow: 0 0 0 2px rgba(24, 119, 242, 0.2);
    }
    
    /* Botón de envío */
    .stButton > button {
        background-color: #1877f2;
        color: white;
        border: none;
        border-radius: 20px;
        padding: 12px 24px;
        font-weight: 600;
        transition: background-color 0.2s;
    }
    
    .stButton > button:hover {
        background-color: #166fe5;
    }
    
    /* Sidebar */
    .css-1d391kg {
        background-color: #f0f2f5;
    }
    
    /* Checkbox debug */
    .stCheckbox > label > div {
        background-color: #1877f2;
    }
    
    /* Scrollbar personalizada */
    .chat-container::-webkit-scrollbar {
        width: 6px;
    }
    
    .chat-container::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
    }
    
    .chat-container::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 3px;
    }
    
    .chat-container::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }
    
    /* Animación de mensajes */
    .user-message, .bot-message {
        animation: slideIn 0.3s ease-out;
    }
    
    @keyframes slideIn {
        from {
            opacity: 0;
            transform: translateY(10px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Responsive */
    @media (max-width: 768px) {
        .user-message, .bot-message {
            max-width: 85%;
        }
    }
</style>
""", unsafe_allow_html=True)

def main():
    """Función principal de la aplicación Streamlit."""
    
    # Header principal
    st.markdown('<h1 class="main-header">🤖 Phill - Chatbot Financiero</h1>', unsafe_allow_html=True)
    
    # Sidebar con información
    with st.sidebar:
        st.markdown("### 🤖 Phill - Chatbot Financiero")
        st.markdown("---")
        
        st.markdown("**🧠 Con IA Avanzada**")
        st.info("""
        **Phill** ahora usa Google AI Studio (Gemini) para:
        
        🤖 **Procesos Automatizados:**
        • Registrar gastos e ingresos
        • Mostrar resúmenes financieros
        • Crear recordatorios
        • Hacer análisis detallados
        
        🧠 **Conversación Inteligente:**
        • Consejos personalizados
        • Planificación financiera
        • Educación financiera
        • Consultas complejas
        """)
        
        st.markdown("---")
        st.markdown("**🎯 Funcionalidades**")
        
        with st.expander("📋 Comandos Automatizados"):
            intents = [
                "💰 registrar_gasto",
                "📈 registrar_ingreso", 
                "📊 solicitar_resumen",
                "⚖️ consultar_balance",
                "💡 solicitar_tip",
                "⏰ crear_recordatorio",
                "📈 analisis_detallado"
            ]
            for intent in intents:
                st.write(f"• {intent}")
        
        with st.expander("💬 Conversación Natural"):
            st.write("• Preguntas abiertas")
            st.write("• Consejos personalizados")
            st.write("• Planificación financiera")
            st.write("• Educación financiera")
        
        st.markdown("---")
        st.markdown("**📊 Estadísticas de Sesión**")
        if 'message_count' in st.session_state:
            st.metric("💬 Mensajes", st.session_state.message_count)
        if 'intents_detected' in st.session_state:
            st.metric("🎯 Decisiones LLM", len(st.session_state.intents_detected))
        
        st.markdown("---")
        st.markdown("**⚙️ Configuración**")
        st.markdown("• **Debug**: Ver decisiones del LLM")
        st.markdown("• **IA**: Google AI Studio (Gemini)")
        st.markdown("• **Costo**: ~$0.001-0.006 por mensaje")
    
    # Inicializar session state
    if 'messages' not in st.session_state:
        st.session_state.messages = []
        st.session_state.message_count = 0
        st.session_state.intents_detected = set()
        st.session_state.debug_mode = False
    
    # Contenedor del chat estilo Facebook
    st.markdown('<div class="chat-container">', unsafe_allow_html=True)
    
    # Mostrar mensajes anteriores
    for message in st.session_state.messages:
        timestamp = message['timestamp'].strftime("%H:%M")
        
        if message['type'] == 'user':
            st.markdown(f"""
            <div class="user-message">
                <div>{message['content']}</div>
                <div class="message-time">{timestamp}</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            st.markdown(f"""
            <div class="bot-message">
                <div>{message['content']}</div>
                <div class="message-time">{timestamp}</div>
            </div>
            """, unsafe_allow_html=True)
    
    st.markdown('</div>', unsafe_allow_html=True)
    
    # Área de input estilo Facebook
    st.markdown("---")
    
    col1, col2, col3 = st.columns([1, 4, 1])
    
    with col2:
        # Inicializar user_input en session_state si no existe
        if 'user_input' not in st.session_state:
            st.session_state.user_input = ""
        
        user_input = st.text_input(
            "",
            placeholder="Escribe un mensaje...",
            value=st.session_state.user_input,
            key="user_input_widget",
            label_visibility="collapsed"
        )
    
    # Botón de envío y debug
    col1, col2, col3 = st.columns([1, 1, 1])
    
    with col1:
        debug_toggle = st.checkbox("🔍 Debug", value=st.session_state.debug_mode)
        st.session_state.debug_mode = debug_toggle
    
    with col2:
        if st.button("📤 Enviar", type="primary"):
            if user_input and user_input.strip():
                # Procesar mensaje
                process_message(user_input.strip(), st.session_state.debug_mode)
                # Limpiar el input después de procesar
                st.session_state.user_input = ""
                st.rerun()
    
    with col3:
        if st.button("🗑️ Limpiar"):
            st.session_state.messages = []
            st.session_state.message_count = 0
            st.session_state.intents_detected = set()
            st.rerun()

def process_message(message, debug_mode=False):
    """Procesa el mensaje del usuario usando la nueva arquitectura LLM."""
    try:
        # Agregar mensaje del usuario
        st.session_state.messages.append({
            'type': 'user',
            'content': message,
            'timestamp': datetime.now()
        })
        
        # Simular contexto del usuario (en la app real vendría de Firestore)
        user_context = {
            'total_gastos_mes': 0,
            'total_ingresos_mes': 0,
            'balance_mes': 0,
            'categorias_gastos': {},
            'num_transacciones': 0,
            'mes_actual': datetime.now().strftime('%B %Y')
        }
        
        # Preparar historial de conversación
        conversation_history = []
        for msg in st.session_state.messages[-10:]:  # Últimos 10 mensajes
            if msg['type'] == 'user':
                conversation_history.append({'user': msg['content'], 'bot': ''})
            elif msg['type'] == 'bot':
                if conversation_history:
                    conversation_history[-1]['bot'] = msg['content']
        
        # Usar LLM para decidir el flujo con historial
        decision = llm_decision_layer.analyze_user_intent(message, user_context, conversation_history)
        
        # Actualizar estadísticas
        st.session_state.message_count += 1
        st.session_state.intents_detected.add(decision['tipo'])
        
        # Generar respuesta según la decisión del LLM
        if decision['tipo'] == 'tarea':
            # Usar el sistema de intents local
            intent = decision.get('intent')
            if not intent:
                intent, confidence = intent_processor.detect_intent(message)
            else:
                confidence = 0.9  # Alta confianza si viene del LLM
            
            entities = intent_processor.extract_entities(message, intent)
            response = generate_response(intent, entities, message, debug_mode, confidence)
        else:
            # Usar la respuesta generada por el LLM
            response = decision.get('respuesta', llm_decision_layer.get_random_saludo())
        
        # Agregar información de debug si está habilitado
        if debug_mode:
            debug_info = f"""
            <div class="debug-info">
                <strong>🔍 DEBUG LLM</strong><br>
                <strong>Tipo:</strong> {decision['tipo']}<br>
                <strong>Intent:</strong> {decision.get('intent', 'N/A')}<br>
                <strong>Respuesta LLM:</strong> {decision.get('respuesta', 'N/A')[:100]}...
            </div>
            """
            response += debug_info
        
        # Agregar respuesta del bot
        st.session_state.messages.append({
            'type': 'bot',
            'content': response,
            'timestamp': datetime.now()
        })
        
    except Exception as e:
        error_response = f"❌ Lo siento, tuve un problema: {e}"
        st.session_state.messages.append({
            'type': 'bot',
            'content': error_response,
            'timestamp': datetime.now()
        })

def generate_response(intent, entities, message, debug_mode=False, confidence=0.0):
    """Genera la respuesta del bot."""
    response = ""
    
    if debug_mode:
        response += f"🔍 **DEBUG**\n"
        response += f"Intent: {intent} (confianza: {confidence:.2f})\n"
        response += f"Entities: {entities}\n\n"
    
    if intent == 'registrar_gasto':
        monto = entities.get('monto', None)
        categoria = entities.get('categoria', 'No especificada')
        
        if monto and isinstance(monto, int) and monto > 0:
            response += f"✅ **Gasto registrado**: ${monto:,} en {categoria}\n\n"
            
            # Consejo si es gasto alto
            if monto > 100000:
                response += "💡 **Consejo**: Ese es un gasto considerable. ¿Has considerado alternativas más económicas?"
        else:
            # Si no hay monto, usar el LLM para generar una respuesta más inteligente
            response = llm_decision_layer.get_advisor_response(
                f"El usuario quiere registrar un gasto en {categoria} pero no especificó el monto. Ayúdale a completar el registro.",
                {'categoria': categoria, 'tipo_consulta': 'gasto_sin_monto'}
            )
            
    elif intent == 'registrar_ingreso':
        monto = entities.get('monto', 'No especificado')
        tipo = entities.get('tipo', 'No especificado')
        
        if isinstance(monto, int):
            response += f"✅ **Ingreso registrado**: ${monto:,} como {tipo}\n\n"
        else:
            response += f"✅ **Ingreso registrado**: {monto} como {tipo}\n\n"
        
        # Consejo de ahorro
        if isinstance(monto, int) and monto > 500000:
            response += "💡 **Consejo**: ¡Excelente ingreso! Te recomiendo ahorrar al menos el 20%."
            
    elif intent == 'solicitar_resumen':
        response += "📊 **Resumen de gastos del mes**:\n\n"
        response += "• Total gastos: $XXX,XXX\n"
        response += "• Total ingresos: $XXX,XXX\n"
        response += "• Balance: $XXX,XXX\n"
        response += "• Categoría con más gastos: [Categoría]\n\n"
        response += "💡 ¿Te gustaría ver más detalles de alguna categoría?"
        
    elif intent == 'consultar_balance':
        response += "💰 **Tu balance actual**:\n\n"
        response += "• Ingresos del mes: $XXX,XXX\n"
        response += "• Gastos del mes: $XXX,XXX\n"
        response += "• Balance: $XXX,XXX\n"
        response += "• Porcentaje ahorrado: XX%\n\n"
        response += "💡 ¿Necesitas ayuda para mejorar tu balance?"
        
    elif intent == 'solicitar_tip':
        response += "💡 **Consejos financieros para ti**:\n\n"
        response += "• Ahorra al menos el 20% de tus ingresos\n"
        response += "• Revisa tus gastos mensuales\n"
        response += "• Evita gastos innecesarios\n"
        response += "• Invierte en tu futuro\n"
        response += "• Mantén un fondo de emergencia\n\n"
        response += "🤔 ¿Te gustaría consejos específicos sobre algún tema?"
        
    elif intent == 'crear_recordatorio':
        motivo = entities.get('motivo', 'recordatorio')
        fecha = entities.get('fecha', 'fecha no especificada')
        response += f"⏰ **Recordatorio creado**: {motivo} para {fecha}\n\n"
        response += "📱 Te notificaré cuando sea el momento.\n\n"
        response += "💡 ¿Necesitas crear más recordatorios?"
        
    elif intent == 'analisis_detallado':
        response += "📈 **Análisis financiero detallado**:\n\n"
        response += "• Tendencias de gastos: [Análisis]\n"
        response += "• Categorías problemáticas: [Categorías]\n"
        response += "• Oportunidades de ahorro: [Oportunidades]\n"
        response += "• Recomendaciones: [Recomendaciones]\n"
        response += "• Proyección mensual: [Proyección]\n\n"
        response += "💡 ¿Te gustaría profundizar en algún aspecto?"
        
    else:
        response += "🤔 No entendí bien tu mensaje. ¿Puedes ser más específico?\n\n"
        response += "💡 **Ejemplos de lo que puedo hacer**:\n"
        response += "• 'Gasté $50,000 en comida'\n"
        response += "• 'Quiero ver mi resumen de gastos'\n"
        response += "• '¿Qué me recomiendas?'\n"
        response += "• 'Recuérdame pagar el 15 de enero'"
    
    return response

if __name__ == "__main__":
    main()
