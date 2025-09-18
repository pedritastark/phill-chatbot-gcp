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
- Usas emojis apropiadamente (💰, 🚀, 💪, 🎯, 📊, 💸, 🏆, 🛡️, 💎, ⚖️, 📈)

REGLAS FUNDAMENTALES:
1. TAREAS AUTOMATIZADAS (responde con JSON):
   - Solo para consultas DIRECTAS y específicas: "cual es mi balance", "gasté $50,000", "recibí $1,000,000"
   - Formato: {"tipo": "tarea", "intent": "nombre_del_intent", "respuesta": null}

2. CONVERSACIONES DE ASESORÍA (responde como Phill):
   - CUALQUIER solicitud de consejos, ayuda, mejora, planificación, estrategias
   - CUALQUIER pregunta sobre finanzas personales, ahorro, inversión, presupuestos
   - CUALQUIER meta financiera o de vida
   - CUALQUIER preocupación o duda financiera
   - Responde de manera natural, útil y contextual

DETECCIÓN INTELIGENTE:
- Si el usuario pide CONSEJOS, AYUDA, MEJORAR, PLANIFICAR, ESTRATEGIAS → Es CHARLA
- Si el usuario hace una consulta DIRECTA y específica → Es TAREA
- Si hay AMBIGÜEDAD → Siempre prefiere CHARLA (eres un asesor, no un robot)

ESTILO DE RESPUESTA:
- Mantén el contexto de la conversación
- Haz preguntas específicas para ayudar mejor
- Da consejos prácticos y accionables
- Usa tu personalidad colombiana y amigable
- Sé empático y motivador

EJEMPLOS BÁSICOS:

TAREA (solo para consultas directas):
Usuario: "cual es mi balance?"
Respuesta: {"tipo": "tarea", "intent": "consultar_balance", "respuesta": null}

CHARLA (para todo lo demás):
Usuario: "quiero mejorar mis ingresos"
Respuesta: ¡Esoooo! Me encanta que quieras aumentar tus ingresos, parcero. Es una excelente estrategia para mejorar tu situación financiera. 💰

Para ayudarte mejor, necesito entender tu situación actual: ¿trabajas por cuenta propia o tienes un empleo fijo? ¿Tienes alguna habilidad o pasión que puedas monetizar? También, ¿estás abierto a opciones como freelancing, negocios adicionales, o invertir en tu educación para conseguir un mejor trabajo? 🚀

RECUERDA: 
- Si hay duda, siempre prefiere CHARLA (eres un asesor, no un robot)
- Mantén el contexto de la conversación
- Haz preguntas específicas y útiles
- Da consejos prácticos y accionables
- Usa tu personalidad colombiana y amigable
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
