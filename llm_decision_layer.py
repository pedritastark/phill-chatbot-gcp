#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capa de decisión LLM para Phill Chatbot.
Determina si usar procesos automatizados o conversación con asesor financiero.
"""

import os
import json
import google.generativeai as genai
from typing import Dict, Tuple, Optional
from datetime import datetime
from saludos_config import get_saludos_activos

class LLMDecisionLayer:
    """Capa de decisión que usa Google AI Studio (Gemini) para determinar el flujo del chatbot."""
    
    def __init__(self):
        # Configurar Google AI Studio
        api_key = os.environ.get('GOOGLE_AI_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY no está configurada en las variables de entorno")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        
        # Cargar frases de saludo desde configuración externa
        self.saludos = get_saludos_activos()
        
        # Configuración del sistema simplificada
        self.system_prompt = """
Eres Phill, un asesor financiero personal experto y amigable. Tu personalidad es:
- Cercano y colombiano (usa expresiones como "parcero", "¡Esoooo!", "¡Dale!")
- Conocedor de finanzas personales
- Práctico y directo en tus consejos
- Motivador y positivo
- Usas emojis apropiadamente

Tu tarea es analizar el mensaje del usuario y determinar si es una "tarea" o una "charla":

TAREAS (usa "tarea"):
- Registrar gastos específicos: "Gasté $50,000 en comida", "Compré sandalias por $80,000"
- Registrar ingresos: "Recibí $1,000,000 de salario"
- Consultar balance: "¿Cuánto tengo?"
- Ver resumen: "Muéstrame mis gastos del mes"
- Crear recordatorios: "Recuérdame pagar el 15"

CHARLAS (usa "charla"):
- Conversaciones generales: "Hola", "¿Cómo estás?", "Las finanzas no se me dan"
- Consultas complejas: "¿Cómo puedo mejorar mis finanzas?"
- Consejos personalizados: "¿Qué me recomiendas para ahorrar?"
- Planificación financiera: "¿Cómo hago un presupuesto?"

IMPORTANTE: Si es una charla, responde como Phill con consejos útiles y prácticos. No solo saludos.

Ejemplos de respuestas para charlas:
- "Hola" → "¡Hola parcero! Soy Phill, tu asesor financiero. ¿En qué te puedo ayudar hoy? ¿Quieres registrar gastos, ver tu balance o necesitas consejos? 💰"
- "vamos mal" → "¡Dale parcero! No te preocupes, todos pasamos por eso. Te voy a ayudar a organizar tus finanzas paso a paso. ¿Por dónde empezamos? ¿Quieres que veamos tus gastos o te doy algunos consejos? 🚀"
- "como esta?" → "¡Esoooo! Todo bien, aquí ayudándote con las finanzas. ¿Cómo van las cosas por tu lado? ¿Necesitas ayuda con algo específico? 💪"
- "quiero empezar un ahorro" → "¡Esoooo! Excelente decisión parcero. Para empezar a ahorrar, te recomiendo: 1) Define tu meta (¿cuánto quieres ahorrar y para qué?), 2) Calcula cuánto puedes ahorrar mensualmente, 3) Automatiza el ahorro. ¿Ya tienes una meta en mente o quieres que te ayude a calcular cuánto puedes ahorrar? 🎯"
- "quiero ahorrar" → "¡Dale! Ahorrar es la clave del éxito financiero. Te voy a ayudar a crear un plan. Primero, ¿cuál es tu objetivo? ¿Una emergencia, vacaciones, casa? Y segundo, ¿cuánto ganas mensualmente para calcular cuánto puedes ahorrar? 💰"
- "necesito consejos financieros" → "¡Perfecto! Te voy a dar consejos prácticos: 1) Gasta menos de lo que ganas, 2) Crea un fondo de emergencia (3-6 meses de gastos), 3) Invierte en tu futuro. ¿En qué área específica necesitas ayuda? ¿Presupuesto, ahorro o inversión? 🚀"

Responde SOLO con un JSON que contenga:
{
    "tipo": "tarea" o "charla",
    "respuesta": "Si es charla, escribe tu respuesta como Phill. Si es tarea, escribe null",
    "intent": "Si es tarea, escribe el intent (registrar_gasto, registrar_ingreso, etc.). Si es charla, escribe null"
}
"""

    def analyze_user_intent(self, message: str, user_context: Optional[Dict] = None) -> Dict:
        """
        Analiza la intención del usuario usando Gemini y devuelve la decisión.
        
        Args:
            message: Mensaje del usuario
            user_context: Contexto adicional del usuario (historial, preferencias, etc.)
            
        Returns:
            Diccionario con la decisión y respuesta
        """
        try:
            # Construir el prompt con contexto
            context_info = ""
            if user_context:
                context_info = f"\nContexto del usuario: {json.dumps(user_context, ensure_ascii=False)}"
            
            full_prompt = f"""
{self.system_prompt}

Mensaje del usuario: "{message}"
{context_info}

Analiza este mensaje y responde con el JSON.
"""
            
            # Generar respuesta con Gemini
            response = self.model.generate_content(full_prompt)
            
            # Parsear la respuesta JSON
            try:
                decision_data = json.loads(response.text.strip())
                
                # Validar estructura
                required_fields = ['tipo', 'respuesta', 'intent']
                if not all(field in decision_data for field in required_fields):
                    raise ValueError("Respuesta JSON incompleta")
                
                # Validar valores
                if decision_data['tipo'] not in ['tarea', 'charla']:
                    raise ValueError("Tipo inválido")
                
                return decision_data
                
            except (json.JSONDecodeError, ValueError) as e:
                print(f"Error parseando respuesta LLM: {e}")
                print(f"Respuesta cruda: {response.text}")
                
                # Fallback: análisis simple basado en palabras clave
                return self._fallback_analysis(message)
                
        except Exception as e:
            print(f"Error en análisis LLM: {e}")
            return self._fallback_analysis(message)
    
    def _fallback_analysis(self, message: str) -> Dict:
        """Análisis de fallback cuando el LLM falla."""
        message_lower = message.lower()
        
        # Palabras clave para procesos automatizados
        automated_keywords = [
            'gasté', 'gastar', 'compré', 'comprar', 'pagué', 'pagar', 'registrar', 'anotar',
            'recibí', 'ingresó', 'salario', 'balance', 'resumen', 'cuánto',
            'recordar', 'recordatorio', 'avisar', 'tip', 'consejo',
            'sandalias', 'ropa', 'comida', 'transporte', 'gasto', 'compra'
        ]
        
        # Palabras clave para conversación con asesor
        advisor_keywords = [
            'cómo', 'qué', 'por qué', 'ayuda', 'recomienda', 'mejorar',
            'invertir', 'ahorrar', 'presupuesto', 'planificar', 'finanzas',
            'como vas', 'como estás', 'que tal', 'hola', 'saludos',
            'no se me dan', 'difícil', 'ayúdame', 'consejo', 'tips'
        ]
        
        automated_score = sum(1 for keyword in automated_keywords if keyword in message_lower)
        advisor_score = sum(1 for keyword in advisor_keywords if keyword in message_lower)
        
        if automated_score > advisor_score:
            return {
                "tipo": "tarea",
                "respuesta": None,
                "intent": "registrar_gasto"  # Intent por defecto
            }
        else:
            # Generar respuesta más útil basada en el mensaje
            if "ahorro" in message_lower or "ahorrar" in message_lower:
                respuesta = "¡Esoooo! Excelente decisión parcero. Para empezar a ahorrar, te recomiendo: 1) Define tu meta (¿cuánto quieres ahorrar y para qué?), 2) Calcula cuánto puedes ahorrar mensualmente, 3) Automatiza el ahorro. ¿Ya tienes una meta en mente o quieres que te ayude a calcular cuánto puedes ahorrar? 🎯"
            elif "mal" in message_lower or "difícil" in message_lower:
                respuesta = "¡Dale parcero! No te preocupes, todos pasamos por eso. Te voy a ayudar a organizar tus finanzas paso a paso. ¿Por dónde empezamos? ¿Quieres que veamos tus gastos o te doy algunos consejos? 🚀"
            elif "hola" in message_lower or "como" in message_lower:
                respuesta = "¡Hola parcero! Soy Phill, tu asesor financiero. ¿En qué te puedo ayudar hoy? ¿Quieres registrar gastos, ver tu balance o necesitas consejos? 💰"
            elif "consejo" in message_lower or "ayuda" in message_lower:
                respuesta = "¡Perfecto! Te voy a dar consejos prácticos: 1) Gasta menos de lo que ganas, 2) Crea un fondo de emergencia (3-6 meses de gastos), 3) Invierte en tu futuro. ¿En qué área específica necesitas ayuda? ¿Presupuesto, ahorro o inversión? 🚀"
            else:
                respuesta = self.get_random_saludo()
            
            return {
                "tipo": "charla",
                "respuesta": respuesta,
                "intent": None
            }
    
    def get_advisor_response(self, message: str, user_context: Optional[Dict] = None) -> str:
        """
        Genera una respuesta como asesor financiero usando el LLM.
        
        Args:
            message: Mensaje del usuario
            user_context: Contexto del usuario (historial financiero, etc.)
            
        Returns:
            Respuesta del asesor financiero
        """
        try:
            # Construir contexto del asesor
            advisor_prompt = f"""
Eres Phill, un asesor financiero personal experto y amigable. Tu personalidad es:
- Cercano y colombiano (usa expresiones como "parcero", "¡Esoooo!", "¡Dale!")
- Conocedor de finanzas personales
- Práctico y directo en tus consejos
- Motivador y positivo
- Usas emojis apropiadamente

Contexto del usuario: {json.dumps(user_context, ensure_ascii=False) if user_context else "Sin contexto previo"}

Mensaje del usuario: "{message}"

IMPORTANTE: Responde como Phill, el asesor financiero. Sé útil, práctico y mantén el tono amigable colombiano.

Ejemplos de respuestas útiles:
- Si dice "Las finanzas no se me dan": "¡Dale parcero! No te preocupes, todos empezamos así. Te voy a ayudar paso a paso. ¿Qué te parece si empezamos registrando tus gastos diarios? Así vemos por dónde se va la plata 💰"
- Si dice "Como vas": "¡Esoooo! Todo bien, aquí ayudándote con las finanzas. ¿En qué te puedo ayudar hoy? ¿Quieres registrar algún gasto o necesitas consejos? 🚀"
- Si dice "claro que si": "¡Perfecto! Me encanta esa actitud. ¿Por dónde empezamos? ¿Quieres que te ayude a registrar gastos, crear un presupuesto o necesitas consejos financieros? 💪"

SIEMPRE da una respuesta útil y relevante, nunca solo un saludo. Responde ahora:
"""
            
            response = self.model.generate_content(advisor_prompt)
            respuesta = response.text.strip()
            print(f"=== RESPUESTA LLM ASESOR ===")
            print(f"Prompt enviado: {advisor_prompt[:200]}...")
            print(f"Respuesta recibida: {respuesta}")
            print("=============================")
            return respuesta
            
        except Exception as e:
            print(f"Error generando respuesta de asesor: {e}")
            return self.get_random_saludo()
    
    def get_random_saludo(self):
        """Retorna un saludo aleatorio de la lista de saludos personalizados."""
        import random
        return random.choice(self.saludos)

# Instancia global
llm_decision_layer = LLMDecisionLayer()
