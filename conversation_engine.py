"""
Motor de conversación inteligente para Phill
Genera respuestas fluidas y contextuales sin necesidad de iteración constante
"""

import json
import random
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class ConversationEngine:
    def __init__(self):
        self.conversation_context = {}
        self.user_profile = {}
        self.conversation_history = []
        
        # Plantillas de conversación por contexto
        self.conversation_templates = {
            "greeting": {
                "responses": [
                    "¡Hola parcero! Soy Phill, tu asesor financiero personal. ¿Cómo vamos con el dinero hoy? 💰",
                    "¡Esoooo! ¿Qué tal? Phill aquí, listo para ayudarte con tus finanzas. ¿En qué te puedo colaborar? 🚀",
                    "¡Dale! Soy Phill, tu coach financiero. ¿Listo para hacer que el dinero trabaje para ti? 💪"
                ],
                "follow_up": "¿Quieres que empecemos registrando tus gastos, viendo tu balance o necesitas consejos específicos?"
            },
            "financial_struggle": {
                "responses": [
                    "¡Dale parcero! No te preocupes, todos pasamos por eso. Las finanzas se pueden mejorar paso a paso. 🚀",
                    "¡Esoooo! Entiendo perfectamente. Te voy a ayudar a organizar todo de manera sencilla. 💪",
                    "¡Tranquilo! Phill está aquí para ayudarte. Vamos a hacer un plan que funcione para ti. 🎯"
                ],
                "follow_up": "¿Por dónde empezamos? ¿Quieres que veamos tus gastos actuales o prefieres que te dé algunos consejos básicos?"
            },
            "savings_goal": {
                "responses": [
                    "¡Esoooo! Excelente decisión parcero. Ahorrar es la base de la libertad financiera. 🎯",
                    "¡Dale! Me encanta que quieras empezar a ahorrar. Te voy a ayudar a crear un plan sólido. 💰",
                    "¡Perfecto! Ahorrar es el primer paso hacia tus metas financieras. Vamos a hacerlo bien. 🚀"
                ],
                "follow_up": "Para crear tu plan de ahorro necesito saber: ¿cuál es tu objetivo? ¿Emergencia, vacaciones, casa, o algo específico?"
            },
            "budget_help": {
                "responses": [
                    "¡Dale! Un presupuesto es tu mapa financiero. Te voy a enseñar a hacerlo fácil. 📊",
                    "¡Esoooo! Presupuestar no es complicado, solo necesita método. Te ayudo paso a paso. 💪",
                    "¡Perfecto! Un buen presupuesto te da control total sobre tu dinero. Vamos a crearlo. 🎯"
                ],
                "follow_up": "Primero necesito saber: ¿cuánto ganas mensualmente y cuáles son tus gastos fijos?"
            },
            "debt_concern": {
                "responses": [
                    "¡Dale parcero! Las deudas se pueden manejar con un plan claro. Te ayudo a organizarlo. 🎯",
                    "¡Esoooo! No te estreses, las deudas tienen solución. Vamos a crear una estrategia. 💪",
                    "¡Tranquilo! Phill está aquí para ayudarte a salir de las deudas de manera inteligente. 🚀"
                ],
                "follow_up": "¿Me puedes contar qué tipo de deudas tienes y aproximadamente cuánto debes?"
            },
            "investment_interest": {
                "responses": [
                    "¡Esoooo! Invertir es el siguiente nivel después del ahorro. Te explico las opciones. 📈",
                    "¡Dale! Me encanta que quieras hacer crecer tu dinero. Te ayudo a empezar seguro. 💰",
                    "¡Perfecto! Invertir es clave para la libertad financiera. Vamos a hacerlo con cabeza. 🚀"
                ],
                "follow_up": "¿Ya tienes un fondo de emergencia? ¿Y cuál es tu perfil de riesgo: conservador, moderado o agresivo?"
            }
        }
        
        # Palabras clave para detectar contexto
        self.context_keywords = {
            "greeting": ["hola", "buenos", "buenas", "como", "estas", "que tal"],
            "financial_struggle": ["mal", "difícil", "problema", "no puedo", "estoy mal", "vamos mal", "no se me da"],
            "savings_goal": ["ahorro", "ahorrar", "guardar", "meta", "objetivo", "futuro"],
            "budget_help": ["presupuesto", "presupuestar", "organizar", "gastos", "dinero"],
            "debt_concern": ["deuda", "debo", "préstamo", "tarjeta", "deber"],
            "investment_interest": ["invertir", "inversión", "crecer", "rendimiento", "ganar más"]
        }
        
        # Personalidad de Phill
        self.phill_personality = {
            "tone": "amigable y colombiano",
            "expressions": ["parcero", "¡Esoooo!", "¡Dale!", "¡Qué más!", "¡Dale parcero!"],
            "emojis": ["💰", "🚀", "💪", "🎯", "📊", "💸", "🏆"],
            "advice_style": "práctico, directo y motivador"
        }

    def detect_conversation_context(self, message: str) -> str:
        """Detecta el contexto de la conversación basado en el mensaje"""
        message_lower = message.lower()
        
        # Buscar palabras clave en orden de prioridad
        for context, keywords in self.context_keywords.items():
            if any(keyword in message_lower for keyword in keywords):
                return context
        
        # Si no encuentra contexto específico, usar greeting
        return "greeting"

    def generate_contextual_response(self, message: str, user_context: Optional[Dict] = None) -> str:
        """Genera una respuesta contextual y fluida"""
        context = self.detect_conversation_context(message)
        
        # Obtener plantilla del contexto
        template = self.conversation_templates.get(context, self.conversation_templates["greeting"])
        
        # Seleccionar respuesta base
        base_response = random.choice(template["responses"])
        
        # Agregar seguimiento contextual
        follow_up = template["follow_up"]
        
        # Personalizar con información del usuario si está disponible
        if user_context:
            personalized_response = self._personalize_response(base_response, follow_up, user_context)
        else:
            personalized_response = f"{base_response} {follow_up}"
        
        # Agregar emoji aleatorio de Phill
        emoji = random.choice(self.phill_personality["emojis"])
        
        return f"{personalized_response} {emoji}"

    def _personalize_response(self, base_response: str, follow_up: str, user_context: Dict) -> str:
        """Personaliza la respuesta basada en el contexto del usuario"""
        # Si tiene gastos recientes, mencionarlos
        if user_context.get("gastos_recientes"):
            gastos = user_context["gastos_recientes"]
            if gastos > 0:
                follow_up = f"Veo que has tenido gastos recientes de ${gastos:,.0f}. {follow_up}"
        
        # Si tiene balance negativo, ofrecer ayuda específica
        if user_context.get("balance") and user_context["balance"] < 0:
            follow_up = f"Noto que tu balance está en negativo. {follow_up}"
        
        return f"{base_response} {follow_up}"

    def generate_task_response(self, intent: str, entities: Dict) -> str:
        """Genera respuestas para tareas automatizadas"""
        task_responses = {
            "registrar_gasto": "✅ **Gasto registrado**",
            "registrar_ingreso": "✅ **Ingreso registrado**",
            "consultar_balance": "💰 **Tu balance actual**",
            "solicitar_resumen": "📊 **Resumen de tus finanzas**",
            "solicitar_tip": "💡 **Tip financiero del día**",
            "crear_recordatorio": "⏰ **Recordatorio creado**"
        }
        
        base_response = task_responses.get(intent, "✅ **Procesado**")
        
        # Agregar detalles específicos
        if intent == "registrar_gasto" and entities.get("categoria"):
            categoria = entities["categoria"]
            monto = entities.get("monto", "No especificado")
            return f"{base_response}: {monto} en {categoria}"
        
        return base_response

    def get_conversation_flow(self, message: str, user_context: Optional[Dict] = None) -> Dict:
        """Determina el flujo de la conversación"""
        # Detectar si es tarea o charla
        is_task = self._is_task_message(message)
        
        if is_task:
            return {
                "tipo": "tarea",
                "respuesta": None,
                "intent": self._detect_task_intent(message)
            }
        else:
            return {
                "tipo": "charla",
                "respuesta": self.generate_contextual_response(message, user_context),
                "intent": None
            }

    def _is_task_message(self, message: str) -> bool:
        """Detecta si el mensaje es una tarea automatizada"""
        task_keywords = [
            "registrar", "gasto", "ingreso", "gasté", "recibí", "compré",
            "balance", "cuánto tengo", "resumen", "gastos del mes",
            "recordatorio", "recuérdame", "tip", "consejo del día"
        ]
        
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in task_keywords)

    def _detect_task_intent(self, message: str) -> str:
        """Detecta el intent específico de la tarea"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ["gasto", "gasté", "compré"]):
            return "registrar_gasto"
        elif any(word in message_lower for word in ["ingreso", "recibí", "salario"]):
            return "registrar_ingreso"
        elif any(word in message_lower for word in ["balance", "cuánto tengo"]):
            return "consultar_balance"
        elif any(word in message_lower for word in ["resumen", "gastos del mes"]):
            return "solicitar_resumen"
        elif any(word in message_lower for word in ["tip", "consejo del día"]):
            return "solicitar_tip"
        elif any(word in message_lower for word in ["recordatorio", "recuérdame"]):
            return "crear_recordatorio"
        else:
            return "registrar_gasto"  # Default

    def update_conversation_history(self, user_message: str, bot_response: str):
        """Actualiza el historial de conversación"""
        self.conversation_history.append({
            "timestamp": datetime.now().isoformat(),
            "user": user_message,
            "bot": bot_response
        })
        
        # Mantener solo los últimos 10 mensajes
        if len(self.conversation_history) > 10:
            self.conversation_history = self.conversation_history[-10:]

    def get_conversation_summary(self) -> str:
        """Genera un resumen de la conversación actual"""
        if not self.conversation_history:
            return "Conversación nueva"
        
        topics = []
        for msg in self.conversation_history:
            context = self.detect_conversation_context(msg["user"])
            if context not in topics:
                topics.append(context)
        
        return f"Conversación sobre: {', '.join(topics)}"

# Instancia global del motor de conversación
conversation_engine = ConversationEngine()
