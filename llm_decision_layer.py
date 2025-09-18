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

class LLMDecisionLayer:
    """Capa de decisión que usa Google AI Studio (Gemini) para determinar el flujo del chatbot."""
    
    def __init__(self):
        # Configurar Google AI Studio
        api_key = os.environ.get('GOOGLE_AI_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY no está configurada en las variables de entorno")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-pro')
        
        # Configuración del sistema
        self.system_prompt = """
Eres un asistente financiero inteligente que decide cómo responder a los usuarios.

Tu tarea es analizar el mensaje del usuario y determinar si debe ser procesado por:
1. PROCESO_AUTOMATIZADO: Para tareas específicas como registrar gastos, ingresos, consultar balance, etc.
2. CONVERSACION_ASESOR: Para consultas complejas, consejos personalizados, o conversaciones generales

PROCESOS AUTOMATIZADOS (usa PROCESO_AUTOMATIZADO):
- Registrar gastos específicos: "Gasté $50,000 en comida"
- Registrar ingresos: "Recibí $1,000,000 de salario"
- Consultar balance: "¿Cuánto tengo?"
- Ver resumen: "Muéstrame mis gastos del mes"
- Crear recordatorios: "Recuérdame pagar el 15"
- Solicitar tips básicos: "Dame un consejo financiero"

CONVERSACIÓN CON ASESOR (usa CONVERSACION_ASESOR):
- Consultas complejas: "¿Cómo puedo mejorar mis finanzas?"
- Análisis personalizado: "¿Qué me recomiendas para ahorrar?"
- Conversaciones generales: "Hola, ¿cómo estás?"
- Preguntas sobre inversiones: "¿Dónde debería invertir mi dinero?"
- Planificación financiera: "¿Cómo hago un presupuesto?"
- Dudas conceptuales: "¿Qué es el interés compuesto?"

Responde SOLO con un JSON que contenga:
{
    "decision": "PROCESO_AUTOMATIZADO" o "CONVERSACION_ASESOR",
    "confidence": 0.0-1.0,
    "reasoning": "explicación breve de por qué tomaste esta decisión",
    "intent_suggestion": "intent específico si es PROCESO_AUTOMATIZADO, null si es CONVERSACION_ASESOR"
}
"""

    def analyze_user_intent(self, message: str, user_context: Optional[Dict] = None) -> Dict:
        """
        Analiza la intención del usuario y decide el flujo apropiado.
        
        Args:
            message: Mensaje del usuario
            user_context: Contexto adicional del usuario (historial, preferencias, etc.)
            
        Returns:
            Diccionario con la decisión y metadatos
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

Analiza este mensaje y decide el flujo apropiado.
"""
            
            # Generar respuesta con Gemini
            response = self.model.generate_content(full_prompt)
            
            # Parsear la respuesta JSON
            try:
                decision_data = json.loads(response.text.strip())
                
                # Validar estructura
                required_fields = ['decision', 'confidence', 'reasoning']
                if not all(field in decision_data for field in required_fields):
                    raise ValueError("Respuesta JSON incompleta")
                
                # Validar valores
                if decision_data['decision'] not in ['PROCESO_AUTOMATIZADO', 'CONVERSACION_ASESOR']:
                    raise ValueError("Decisión inválida")
                
                if not 0.0 <= decision_data['confidence'] <= 1.0:
                    raise ValueError("Confianza fuera de rango")
                
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
            'gasté', 'gastar', 'compré', 'pagué', 'registrar', 'anotar',
            'recibí', 'ingresó', 'salario', 'balance', 'resumen', 'cuánto',
            'recordar', 'recordatorio', 'avisar', 'tip', 'consejo'
        ]
        
        # Palabras clave para conversación con asesor
        advisor_keywords = [
            'cómo', 'qué', 'por qué', 'ayuda', 'recomienda', 'mejorar',
            'invertir', 'ahorrar', 'presupuesto', 'planificar', 'finanzas'
        ]
        
        automated_score = sum(1 for keyword in automated_keywords if keyword in message_lower)
        advisor_score = sum(1 for keyword in advisor_keywords if keyword in message_lower)
        
        if automated_score > advisor_score:
            return {
                "decision": "PROCESO_AUTOMATIZADO",
                "confidence": 0.7,
                "reasoning": "Análisis de fallback: detectadas palabras clave de proceso automatizado",
                "intent_suggestion": None
            }
        else:
            return {
                "decision": "CONVERSACION_ASESOR",
                "confidence": 0.6,
                "reasoning": "Análisis de fallback: detectadas palabras clave de conversación",
                "intent_suggestion": None
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

Responde como Phill, el asesor financiero. Sé útil, práctico y mantén el tono amigable colombiano.
Si el usuario pregunta algo muy específico sobre sus datos, puedes sugerirle usar los comandos automatizados.
"""
            
            response = self.model.generate_content(advisor_prompt)
            return response.text.strip()
            
        except Exception as e:
            print(f"Error generando respuesta de asesor: {e}")
            return "¡Hola parcero! Soy Phill, tu asesor financiero. ¿En qué te puedo ayudar hoy? 💰"

# Instancia global
llm_decision_layer = LLMDecisionLayer()
