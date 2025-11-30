#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Configuración de saludos personalizados para Phill Chatbot.
Aquí puedes agregar, modificar o quitar frases de saludo.
"""

# Lista de frases de saludo personalizadas
SALUDOS_PERSONALIZADOS = [
    # Saludos casuales y colombianos
    "¡Hola parcero! Soy Phill, tu asesor financiero personal. ¿En qué te puedo ayudar hoy? 💰",
    "¡Esoooo! ¿Qué tal? Soy Phill, tu asistente financiero. ¿Cómo van las finanzas? 🚀",
    "¡Dale! Phill aquí, tu asesor financiero de confianza. ¿Qué necesitas hoy? 💪",
    "¡Qué más! Phill al habla, tu asesor financiero personal. ¿En qué te ayudo? 🎯",
    "¡Hey! Phill al servicio, tu asesor financiero. ¿Qué necesitas para tus finanzas? 🔥",
    
    # Saludos profesionales pero amigables
    "¡Hola! Soy Phill, tu compañero financiero. ¿Listo para organizar tu plata? 💎",
    "¡Saludos! Soy Phill, tu guía financiero. ¿Cómo podemos mejorar tus finanzas hoy? 📈",
    "¡Hola amigo! Phill aquí, tu asesor financiero. ¿Qué tal si hablamos de tu dinero? 💰",
    "¡Buenas! Soy Phill, tu asistente financiero personal. ¿Listo para tomar control? 🎮",
    "¡Hola! Soy Phill, tu compañero de finanzas. ¿Cómo vamos con el dinero? 💸",
    
    # Saludos motivacionales
    "¡Hola! Soy Phill, tu coach financiero. ¿Listo para alcanzar tus metas? 🎯",
    "¡Qué tal! Phill aquí, tu mentor financiero. ¿Cómo vamos con los objetivos? 🏆",
    "¡Saludos! Soy Phill, tu aliado financiero. ¿Empezamos a hacer crecer tu plata? 📈",
    "¡Hola! Phill al habla, tu asesor financiero. ¿Listo para dominar tus finanzas? 👑",
    "¡Hey! Soy Phill, tu guía financiero. ¿Cómo vamos con el plan de ahorro? 💎",
    
    # Saludos según el momento del día
    "¡Buenos días! Soy Phill, tu asesor financiero. ¿Cómo empezamos el día financiero? ☀️",
    "¡Buenas tardes! Phill aquí, tu asistente financiero. ¿Cómo van las finanzas? 🌤️",
    "¡Buenas noches! Soy Phill, tu asesor financiero. ¿Cómo cerramos el día financiero? 🌙",
    
    # Saludos con personalidad
    "¡Hola! Soy Phill, el bot que te ayuda con la plata. ¿Qué tal si organizamos tus finanzas? 🤖",
    "¡Qué más! Phill aquí, tu asesor financiero digital. ¿Listo para la revolución financiera? 🚀",
    "¡Dale! Soy Phill, tu asistente financiero 24/7. ¿En qué te ayudo hoy? ⚡",
    "¡Hola! Phill al habla, tu asesor financiero personal. ¿Cómo vamos con el presupuesto? 📊",
    "¡Hey! Soy Phill, tu compañero de finanzas. ¿Listo para hacer crecer tu dinero? 💰"
]

# Configuración adicional
CONFIGURACION_SALUDOS = {
    "rotar_saludos": True,  # Si True, rota entre todos los saludos
    "saludo_fijo": None,    # Si quieres un saludo fijo, ponlo aquí
    "incluir_emojis": True, # Si True, incluye emojis en los saludos
    "tono": "colombiano"    # Opciones: "colombiano", "profesional", "casual", "motivacional"
}

# Función para obtener saludos según configuración
def get_saludos_activos():
    """Retorna la lista de saludos activos según la configuración."""
    if CONFIGURACION_SALUDOS["saludo_fijo"]:
        return [CONFIGURACION_SALUDOS["saludo_fijo"]]
    
    return SALUDOS_PERSONALIZADOS

# Función para agregar nuevos saludos
def agregar_saludo(nuevo_saludo):
    """Agrega un nuevo saludo a la lista."""
    SALUDOS_PERSONALIZADOS.append(nuevo_saludo)

# Función para quitar un saludo
def quitar_saludo(saludo_a_quitar):
    """Quita un saludo de la lista."""
    if saludo_a_quitar in SALUDOS_PERSONALIZADOS:
        SALUDOS_PERSONALIZADOS.remove(saludo_a_quitar)

# Función para personalizar el tono
def cambiar_tono(nuevo_tono):
    """Cambia el tono de los saludos."""
    CONFIGURACION_SALUDOS["tono"] = nuevo_tono

# Ejemplos de uso:
if __name__ == "__main__":
    print("=== SALUDOS PERSONALIZADOS DE PHILL ===")
    print(f"Total de saludos: {len(SALUDOS_PERSONALIZADOS)}")
    print(f"Tono actual: {CONFIGURACION_SALUDOS['tono']}")
    print("\nEjemplos de saludos:")
    for i, saludo in enumerate(SALUDOS_PERSONALIZADOS[:5], 1):
        print(f"{i}. {saludo}")
    
    print("\n=== CONFIGURACIÓN ===")
    for key, value in CONFIGURACION_SALUDOS.items():
        print(f"{key}: {value}")
