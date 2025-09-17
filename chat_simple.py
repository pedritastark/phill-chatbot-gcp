#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat simple para pruebas rápidas del chatbot financiero.
"""

from intent_processor import intent_processor

def chat_simple():
    """Chat simple sin interfaz compleja."""
    
    print("🤖 Chatbot Financiero Phill - Modo Simple")
    print("💡 Escribe 'salir' para terminar\n")
    
    while True:
        try:
            mensaje = input("👤 Tú: ").strip()
            
            if mensaje.lower() in ['salir', 'exit']:
                print("👋 ¡Hasta luego!")
                break
            
            if not mensaje:
                continue
            
            # Procesar mensaje
            intent, confidence = intent_processor.detect_intent(mensaje)
            entities = intent_processor.extract_entities(mensaje, intent)
            
            print(f"🎯 Intent: {intent} ({confidence:.2f})")
            print(f"📊 Entities: {entities}")
            
            # Respuesta simple
            if intent == 'registrar_gasto':
                monto = entities.get('monto', 'No especificado')
                categoria = entities.get('categoria', 'No especificada')
                print(f"🤖 Phill: ✅ Gasto registrado: {monto} en {categoria}")
            elif intent == 'registrar_ingreso':
                monto = entities.get('monto', 'No especificado')
                tipo = entities.get('tipo', 'No especificado')
                print(f"🤖 Phill: ✅ Ingreso registrado: {monto} como {tipo}")
            elif intent == 'solicitar_resumen':
                print("🤖 Phill: 📊 Aquí está tu resumen de gastos...")
            elif intent == 'consultar_balance':
                print("🤖 Phill: 💰 Tu balance actual es...")
            elif intent == 'solicitar_tip':
                print("🤖 Phill: 💡 Te recomiendo ahorrar el 20%...")
            elif intent == 'crear_recordatorio':
                motivo = entities.get('motivo', 'recordatorio')
                print(f"🤖 Phill: ⏰ Recordatorio creado: {motivo}")
            elif intent == 'analisis_detallado':
                print("🤖 Phill: 📈 Aquí está tu análisis detallado...")
            else:
                print("🤖 Phill: 🤔 No entendí. ¿Puedes ser más específico?")
            
            print()
            
        except KeyboardInterrupt:
            print("\n👋 ¡Hasta luego!")
            break
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    chat_simple()
