#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Capa de decisión LLM simplificada para Phill Chatbot.
Usa el motor de conversación inteligente para generar respuestas fluidas.
"""

import os
import json
import random
from typing import Dict, Optional
from conversation_engine import conversation_engine
from saludos_config import get_saludos_activos

class LLMDecisionLayer:
    """Capa de decisión que usa el motor de conversación inteligente."""
    
    def __init__(self):
        # Verificar API key (aunque no la usemos directamente)
        api_key = os.environ.get('GOOGLE_AI_API_KEY')
        if not api_key:
            raise ValueError("GOOGLE_AI_API_KEY no está configurada en las variables de entorno")
        
        # Cargar saludos
        self.saludos = get_saludos_activos()

    def analyze_user_intent(self, message: str, user_context: Optional[Dict] = None) -> Dict:
        """
        Analiza la intención del usuario usando el motor de conversación inteligente.
        
        Args:
            message: Mensaje del usuario
            user_context: Contexto adicional del usuario (historial, preferencias, etc.)
            
        Returns:
            Diccionario con la decisión y respuesta
        """
        try:
            # Usar el motor de conversación inteligente
            decision = conversation_engine.get_conversation_flow(message, user_context)
            
            # Agregar metadatos
            decision.update({
                "confianza": 0.95,
                "razonamiento": "Motor de conversación inteligente",
                "contexto": conversation_engine.detect_conversation_context(message)
            })
            
            return decision
            
        except Exception as e:
            print(f"Error en motor de conversación: {e}")
            return self._fallback_analysis(message)

    def _fallback_analysis(self, message: str) -> Dict:
        """
        Análisis de fallback basado en palabras clave.
        """
        message_lower = message.lower()
        
        # Detectar tareas automatizadas
        task_keywords = [
            "registrar", "gasto", "ingreso", "gasté", "recibí", "compré",
            "balance", "cuánto tengo", "resumen", "gastos del mes",
            "recordatorio", "recuérdame", "tip", "consejo del día"
        ]
        
        if any(keyword in message_lower for keyword in task_keywords):
            return {
                "tipo": "tarea",
                "respuesta": None,
                "intent": "registrar_gasto",  # Intent por defecto
                "confianza": 0.70,
                "razonamiento": "Análisis de fallback: detectadas palabras clave de proceso automatizado"
            }
        else:
            # Generar respuesta contextual usando el motor
            try:
                response = conversation_engine.generate_contextual_response(message)
                return {
                    "tipo": "charla",
                    "respuesta": response,
                    "intent": None,
                    "confianza": 0.80,
                    "razonamiento": "Análisis de fallback: respuesta contextual generada"
                }
            except:
                return {
                    "tipo": "charla",
                    "respuesta": self.get_random_saludo(),
                    "intent": None,
                    "confianza": 0.60,
                    "razonamiento": "Análisis de fallback: saludo genérico"
                }

    def get_random_saludo(self) -> str:
        """Obtiene un saludo aleatorio de la lista de saludos activos."""
        return random.choice(self.saludos) if self.saludos else "¡Hola! Soy Phill, tu asesor financiero. ¿En qué te puedo ayudar?"

    def get_advisor_response(self, message: str, user_context: Optional[Dict] = None) -> str:
        """
        Genera una respuesta como asesor financiero usando el motor de conversación.
        """
        try:
            return conversation_engine.generate_contextual_response(message, user_context)
        except Exception as e:
            print(f"Error generando respuesta de asesor: {e}")
            return self.get_random_saludo()

# Instancia global
llm_decision_layer = LLMDecisionLayer()
