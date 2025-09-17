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

# Configuración de la página
st.set_page_config(
    page_title="🤖 Phill - Chatbot Financiero",
    page_icon="💰",
    layout="wide",
    initial_sidebar_state="expanded"
)

# CSS personalizado
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 2rem;
    }
    .chat-message {
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
        border-left: 4px solid #1f77b4;
    }
    .user-message {
        background-color: #e3f2fd;
        border-left-color: #2196f3;
    }
    .bot-message {
        background-color: #f3e5f5;
        border-left-color: #9c27b0;
    }
    .stButton > button {
        width: 100%;
        background-color: #1f77b4;
        color: white;
        border: none;
        border-radius: 5px;
        padding: 0.5rem 1rem;
    }
    .stButton > button:hover {
        background-color: #1565c0;
    }
</style>
""", unsafe_allow_html=True)

def main():
    """Función principal de la aplicación Streamlit."""
    
    # Header principal
    st.markdown('<h1 class="main-header">🤖 Phill - Chatbot Financiero</h1>', unsafe_allow_html=True)
    
    # Sidebar con información
    with st.sidebar:
        st.header("📊 Información del Bot")
        st.info("""
        **Phill** es tu asistente financiero personal que puede:
        
        💰 Registrar gastos e ingresos
        📊 Mostrar resúmenes financieros
        💡 Dar consejos financieros
        ⏰ Crear recordatorios
        📈 Hacer análisis detallados
        """)
        
        st.header("🎯 Intents Soportados")
        intents = [
            "registrar_gasto",
            "registrar_ingreso", 
            "solicitar_resumen",
            "consultar_balance",
            "solicitar_tip",
            "crear_recordatorio",
            "analisis_detallado"
        ]
        for intent in intents:
            st.write(f"• {intent}")
        
        st.header("📊 Estadísticas")
        if 'message_count' in st.session_state:
            st.metric("Mensajes procesados", st.session_state.message_count)
        if 'intents_detected' in st.session_state:
            st.metric("Intents detectados", len(st.session_state.intents_detected))
    
    # Inicializar session state
    if 'messages' not in st.session_state:
        st.session_state.messages = []
        st.session_state.message_count = 0
        st.session_state.intents_detected = set()
        st.session_state.debug_mode = False
    
    # Mostrar mensajes anteriores
    for message in st.session_state.messages:
        with st.container():
            if message['type'] == 'user':
                st.markdown(f"""
                <div class="chat-message user-message">
                    <strong>👤 Tú:</strong> {message['content']}
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div class="chat-message bot-message">
                    <strong>🤖 Phill:</strong> {message['content']}
                </div>
                """, unsafe_allow_html=True)
    
    # Input del usuario
    col1, col2 = st.columns([4, 1])
    
    with col1:
        # Inicializar user_input en session_state si no existe
        if 'user_input' not in st.session_state:
            st.session_state.user_input = ""
        
        user_input = st.text_input(
            "Escribe tu mensaje aquí:",
            placeholder="Ej: Gasté $50,000 en comida",
            value=st.session_state.user_input,
            key="user_input_widget"
        )
    
    with col2:
        debug_toggle = st.checkbox("Debug", value=st.session_state.debug_mode)
        st.session_state.debug_mode = debug_toggle
    
    # Botón para enviar
    if st.button("Enviar", type="primary"):
        if user_input and user_input.strip():
            # Procesar mensaje
            process_message(user_input.strip(), st.session_state.debug_mode)
            # Limpiar el input después de procesar
            st.session_state.user_input = ""
            st.rerun()

def process_message(message, debug_mode=False):
    """Procesa el mensaje del usuario."""
    try:
        # Agregar mensaje del usuario
        st.session_state.messages.append({
            'type': 'user',
            'content': message,
            'timestamp': datetime.now()
        })
        
        # Detectar intent
        intent, confidence = intent_processor.detect_intent(message)
        entities = intent_processor.extract_entities(message, intent)
        
        # Actualizar estadísticas
        st.session_state.message_count += 1
        st.session_state.intents_detected.add(intent)
        
        # Generar respuesta
        response = generate_response(intent, entities, message, debug_mode)
        
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

def generate_response(intent, entities, message, debug_mode=False):
    """Genera la respuesta del bot."""
    response = ""
    
    if debug_mode:
        response += f"🔍 **DEBUG**\n"
        response += f"Intent: {intent} (confianza: {confidence:.2f})\n"
        response += f"Entities: {entities}\n\n"
    
    if intent == 'registrar_gasto':
        monto = entities.get('monto', 'No especificado')
        categoria = entities.get('categoria', 'No especificada')
        
        if isinstance(monto, int):
            response += f"✅ **Gasto registrado**: ${monto:,} en {categoria}\n\n"
        else:
            response += f"✅ **Gasto registrado**: {monto} en {categoria}\n\n"
        
        # Consejo si es gasto alto
        if isinstance(monto, int) and monto > 100000:
            response += "💡 **Consejo**: Ese es un gasto considerable. ¿Has considerado alternativas más económicas?"
            
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
