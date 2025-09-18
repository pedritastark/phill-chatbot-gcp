"""
Motor de conversación LLM para Phill
Usa un solo prompt bien diseñado para mantener conversaciones fluidas
"""

import os
import json
import google.generativeai as genai
from typing import Dict, Optional, List
from datetime import datetime

class LLMConversationEngine:
    def __init__(self):
        # Configurar Google AI Studio
        api_key = os.environ.get('GOOGLE_AI_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY no está configurada en las variables de entorno")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        
        # Prompt maestro que maneja todo el contexto
        self.master_prompt = """
Eres Phill, un asesor financiero personal colombiano experto y amigable. Tu personalidad es:
- Cercano y colombiano (usa expresiones como "parcero", "¡Esoooo!", "¡Dale!", "¡Qué más!")
- Conocedor de finanzas personales
- Práctico y directo en tus consejos
- Motivador y positivo
- Usas emojis apropiadamente (💰, 🚀, 💪, 🎯, 📊, 💸, 🏆, 🛡️, 💎, ⚖️, 📈, 🏠, 💕, 💒, 🎉)

CONTEXTO DE LA CONVERSACIÓN:
- Mantén el hilo de la conversación
- Recuerda lo que el usuario ha dicho anteriormente
- Haz preguntas de seguimiento relevantes
- Proporciona consejos específicos y prácticos

CAPACIDADES:
1. TAREAS AUTOMATIZADAS (responde con JSON):
   - Registrar gastos: "Gasté $50,000 en comida", "Compré sandalias por $80,000"
   - Registrar ingresos: "Recibí $1,000,000 de salario"
   - Consultar balance: "¿Cuánto tengo?", "cual es mi balance"
   - Ver resumen: "Muéstrame mis gastos del mes"
   - Crear recordatorios: "Recuérdame pagar el 15"
   - Solicitar tips: "Dame un consejo del día"

2. CONVERSACIONES DE ASESORÍA (responde como Phill):
   - Consejos financieros generales
   - Planificación de ahorro
   - Estrategias de inversión
   - Presupuestos y control de gastos
   - Metas financieras (casa, boda, viajes, etc.)
   - Finanzas en pareja
   - Manejo de deudas

INSTRUCCIONES:
- Si es una TAREA, responde SOLO con JSON: {"tipo": "tarea", "intent": "nombre_del_intent", "respuesta": null}
- Si es una CHARLA/CONVERSACIÓN, responde como Phill con consejos útiles y preguntas relevantes
- Mantén el contexto de la conversación
- Haz preguntas específicas para ayudar mejor
- Da consejos prácticos y accionables
- Usa tu personalidad colombiana y amigable

EJEMPLOS DE RESPUESTAS:

TAREA:
Usuario: "cual es mi balance?"
Respuesta: {"tipo": "tarea", "intent": "consultar_balance", "respuesta": null}

CHARLA:
Usuario: "siento que podría reducir mis gastos"
Respuesta: ¡Esoooo! Me encanta que quieras optimizar tus gastos, parcero. Es una excelente decisión financiera. 💪 

Para ayudarte mejor, necesito entender tu situación: ¿en qué categorías sientes que gastas más? ¿Alimentación, transporte, entretenimiento, o algo específico? También, ¿tienes un presupuesto mensual definido o quieres que te ayude a crear uno? 📊

CHARLA:
Usuario: "quiero empezar a invertir"
Respuesta: ¡Dale! Invertir es el siguiente nivel después del ahorro. Te ayudo a empezar de manera inteligente. 📈

Primero necesito saber: ¿ya tienes un fondo de emergencia (3-6 meses de gastos)? Y segundo, ¿cuál es tu perfil de riesgo: conservador (seguridad), moderado (equilibrio), o agresivo (máximo rendimiento)? 🎯

CHARLA:
Usuario: "soy conservador"
Respuesta: ¡Perfecto! Ser conservador es muy inteligente, parcero. Te voy a recomendar opciones seguras y estables. 🛡️

Para un perfil conservador te recomiendo: 1) CDTs o depósitos a término, 2) Fondos de inversión de renta fija, 3) Bonos del gobierno. ¿Cuál te interesa más o tienes alguna pregunta específica sobre estas opciones? 💎

CHARLA:
Usuario: "quiero irme a vivir con mi esposa"
Respuesta: ¡Esoooo! Me encanta que tengas metas claras. Vivir con tu esposa es un objetivo hermoso y requiere planificación financiera. 🏠

Para ayudarte mejor, necesito saber: ¿cuándo quieren hacerlo? ¿Tienen ahorros actuales? ¿Ya saben cuánto necesitarían mensualmente para vivir juntos? También, ¿han hablado sobre cómo van a manejar las finanzas (cuentas separadas o juntas)? 💕

IMPORTANTE: 
- Mantén siempre el contexto de la conversación
- Haz preguntas específicas y útiles
- Da consejos prácticos y accionables
- Usa tu personalidad colombiana y amigable
- Responde de manera natural y conversacional
"""

    def analyze_and_respond(self, message: str, conversation_history: List[Dict] = None, user_context: Optional[Dict] = None) -> Dict:
        """
        Analiza el mensaje y genera una respuesta apropiada.
        
        Args:
            message: Mensaje del usuario
            conversation_history: Historial de la conversación
            user_context: Contexto del usuario (gastos, ingresos, etc.)
            
        Returns:
            Dict con la respuesta del LLM
        """
        try:
            # Construir contexto de la conversación
            context_info = ""
            if user_context:
                context_info = f"""
CONTEXTO DEL USUARIO:
- Balance actual: ${user_context.get('balance', 0):,.0f}
- Gastos del mes: ${user_context.get('gastos_mes', 0):,.0f}
- Ingresos del mes: ${user_context.get('ingresos_mes', 0):,.0f}
- Últimos gastos: {user_context.get('ultimos_gastos', [])}
"""
            
            # Construir historial de conversación
            history_context = ""
            if conversation_history:
                history_context = "\nHISTORIAL DE CONVERSACIÓN:\n"
                for msg in conversation_history[-5:]:  # Últimos 5 mensajes
                    history_context += f"Usuario: {msg.get('user', '')}\n"
                    history_context += f"Phill: {msg.get('bot', '')}\n"
            
            # Crear el prompt completo
            full_prompt = f"""
{self.master_prompt}

{context_info}
{history_context}

MENSAJE ACTUAL DEL USUARIO: "{message}"

Analiza este mensaje y responde apropiadamente. Si es una tarea, responde con JSON. Si es una charla, responde como Phill.
"""
            
            # Generar respuesta con Gemini
            response = self.model.generate_content(full_prompt)
            
            if response.text:
                # Intentar parsear como JSON primero
                try:
                    decision = json.loads(response.text.strip())
                    if "tipo" in decision and decision["tipo"] == "tarea":
                        return {
                            "tipo": "tarea",
                            "intent": decision.get("intent"),
                            "respuesta": None,
                            "confianza": 0.95,
                            "razonamiento": "LLM detectó tarea automatizada"
                        }
                except json.JSONDecodeError:
                    pass
                
                # Si no es JSON, es una respuesta conversacional
                return {
                    "tipo": "charla",
                    "respuesta": response.text.strip(),
                    "intent": None,
                    "confianza": 0.95,
                    "razonamiento": "LLM generó respuesta conversacional"
                }
            else:
                return self._fallback_response(message)
                
        except Exception as e:
            print(f"Error en LLM: {e}")
            return self._fallback_response(message)

    def _fallback_response(self, message: str) -> Dict:
        """Respuesta de fallback si el LLM falla"""
        message_lower = message.lower()
        
        # Detectar tareas simples
        if any(word in message_lower for word in ["balance", "cuánto tengo", "cual es mi balance"]):
            return {
                "tipo": "tarea",
                "intent": "consultar_balance",
                "respuesta": None,
                "confianza": 0.70,
                "razonamiento": "Fallback: detectada consulta de balance"
            }
        elif any(word in message_lower for word in ["gasto", "gasté", "compré"]):
            return {
                "tipo": "tarea",
                "intent": "registrar_gasto",
                "respuesta": None,
                "confianza": 0.70,
                "razonamiento": "Fallback: detectado registro de gasto"
            }
        else:
            return {
                "tipo": "charla",
                "respuesta": "¡Hola parcero! Soy Phill, tu asesor financiero. ¿En qué te puedo ayudar hoy? 💰",
                "intent": None,
                "confianza": 0.60,
                "razonamiento": "Fallback: respuesta genérica"
            }

# Instancia global
llm_conversation_engine = LLMConversationEngine()
