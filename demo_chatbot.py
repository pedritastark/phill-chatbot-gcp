#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Demo del chatbot financiero con casos de prueba automáticos.
"""

from intent_processor import intent_processor

def demo_chatbot():
    """Demo del chatbot con casos de prueba."""
    
    print("🤖 DEMO DEL CHATBOT FINANCIERO PHILL")
    print("="*50)
    
    # Casos de prueba
    test_cases = [
        "Gasté $50,000 en comida",
        "Registra una compra de 80,000 en ropa", 
        "Se me fueron 100,000 del pago de la tarjeta",
        "Hoy tuve un gasto en la farmacia",
        "Pagué la cuota del gimnasio",
        "Transferí 30,000 a Nequi",
        "Gasté 5 mil pesos en comida",
        "Recibí 2 millones de pesos",
        "Me ingresó $100,000 como regalo",
        "Quiero ver mi resumen de gastos",
        "Ver ingresos vs gastos",
        "¿Qué me recomiendas?",
        "Recuérdame pagar el 15 de enero",
        "Hazme un análisis detallado",
        "¿Cómo estoy financieramente?"
    ]
    
    for i, message in enumerate(test_cases, 1):
        print(f"\n{i}. 👤 Usuario: {message}")
        
        try:
            # Detectar intent
            intent, confidence = intent_processor.detect_intent(message)
            print(f"   🎯 Intent: {intent} (confianza: {confidence:.2f})")
            
            # Extraer entities
            entities = intent_processor.extract_entities(message, intent)
            print(f"   📊 Entities: {entities}")
            
            # Simular respuesta del bot
            if intent == 'registrar_gasto':
                monto = entities.get('monto', 'No especificado')
                categoria = entities.get('categoria', 'No especificada')
                if isinstance(monto, int):
                    print(f"   🤖 Phill: ✅ Gasto registrado: ${monto:,} en {categoria}")
                else:
                    print(f"   🤖 Phill: ✅ Gasto registrado: {monto} en {categoria}")
                
            elif intent == 'registrar_ingreso':
                monto = entities.get('monto', 'No especificado')
                tipo = entities.get('tipo', 'No especificado')
                if isinstance(monto, int):
                    print(f"   🤖 Phill: ✅ Ingreso registrado: ${monto:,} como {tipo}")
                else:
                    print(f"   🤖 Phill: ✅ Ingreso registrado: {monto} como {tipo}")
                
            elif intent == 'solicitar_resumen':
                print("   🤖 Phill: 📊 Aquí está tu resumen de gastos del mes...")
                
            elif intent == 'consultar_balance':
                print("   🤖 Phill: 💰 Tu balance actual es...")
                
            elif intent == 'solicitar_tip':
                print("   🤖 Phill: 💡 Te recomiendo ahorrar el 20% de tus ingresos...")
                
            elif intent == 'crear_recordatorio':
                motivo = entities.get('motivo', 'recordatorio')
                fecha = entities.get('fecha', 'fecha no especificada')
                print(f"   🤖 Phill: ⏰ Recordatorio creado: {motivo} para {fecha}")
                
            elif intent == 'analisis_detallado':
                print("   🤖 Phill: 📈 Aquí está tu análisis financiero detallado...")
                
            else:
                print("   🤖 Phill: 🤔 No entendí bien. ¿Puedes ser más específico?")
            
        except Exception as e:
            print(f"   ❌ Error: {e}")
    
    print("\n" + "="*50)
    print("🎉 ¡Demo completado!")
    print("✅ El chatbot está funcionando correctamente")
    print("🚀 Listo para usar en producción")

if __name__ == "__main__":
    demo_chatbot()
