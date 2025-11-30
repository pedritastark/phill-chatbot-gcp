#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Chat interactivo para probar el chatbot financiero Phill.
Mantiene la conversación activa desde la terminal.
"""

import sys
import os
from intent_processor import intent_processor

def limpiar_pantalla():
    """Limpia la pantalla de la terminal."""
    os.system('clear' if os.name == 'posix' else 'cls')

def mostrar_banner():
    """Muestra el banner del chatbot."""
    print("🤖" + "="*60 + "🤖")
    print("💰           CHATBOT FINANCIERO PHILL           💰")
    print("🤖" + "="*60 + "🤖")
    print("💡 Comandos especiales:")
    print("   • 'salir' o 'exit' - Terminar conversación")
    print("   • 'limpiar' o 'clear' - Limpiar pantalla")
    print("   • 'ayuda' - Mostrar ejemplos de uso")
    print("   • 'debug' - Activar/desactivar modo debug")
    print("🤖" + "="*60 + "🤖\n")

def mostrar_ayuda():
    """Muestra ejemplos de uso del chatbot."""
    print("\n📚 EJEMPLOS DE USO:")
    print("-" * 40)
    print("💰 REGISTRAR GASTOS:")
    print("   • 'Gasté $50,000 en comida'")
    print("   • 'Registra una compra de 80,000 en ropa'")
    print("   • 'Se me fueron 100,000 del pago de la tarjeta'")
    print("   • 'Hoy tuve un gasto en la farmacia'")
    print("   • 'Pagué la cuota del gimnasio'")
    print("   • 'Transferí 30,000 a Nequi'")
    print("   • 'Gasté 5 mil pesos en comida'")
    
    print("\n💵 REGISTRAR INGRESOS:")
    print("   • 'Recibí 2 millones de pesos'")
    print("   • 'Me ingresó $100,000 como regalo'")
    print("   • 'Gané 500,000 en el trabajo'")
    
    print("\n📊 CONSULTAS:")
    print("   • 'Quiero ver mi resumen de gastos'")
    print("   • 'Ver ingresos vs gastos'")
    print("   • '¿Qué me recomiendas?'")
    print("   • 'Hazme un análisis detallado'")
    print("   • '¿Cómo estoy financieramente?'")
    
    print("\n⏰ RECORDATORIOS:")
    print("   • 'Recuérdame pagar el 15 de enero'")
    print("   • 'Avisame mañana sobre la factura'")
    print("-" * 40)

def procesar_mensaje(message, debug=False):
    """Procesa el mensaje del usuario y retorna la respuesta del bot."""
    try:
        # Detectar intent
        intent, confidence = intent_processor.detect_intent(message)
        
        # Extraer entities
        entities = intent_processor.extract_entities(message, intent)
        
        if debug:
            print(f"🔍 DEBUG - Intent: {intent} (confianza: {confidence:.2f})")
            print(f"🔍 DEBUG - Entities: {entities}")
        
        # Generar respuesta basada en el intent
        if intent == 'registrar_gasto':
            monto = entities.get('monto', 'No especificado')
            categoria = entities.get('categoria', 'No especificada')
            
            if isinstance(monto, int):
                respuesta = f"✅ Gasto registrado: ${monto:,} en {categoria}"
            else:
                respuesta = f"✅ Gasto registrado: {monto} en {categoria}"
            
            # Agregar consejo si es un gasto alto
            if isinstance(monto, int) and monto > 100000:
                respuesta += "\n💡 Consejo: Ese es un gasto considerable. ¿Has considerado alternativas más económicas?"
                
        elif intent == 'registrar_ingreso':
            monto = entities.get('monto', 'No especificado')
            tipo = entities.get('tipo', 'No especificado')
            
            if isinstance(monto, int):
                respuesta = f"✅ Ingreso registrado: ${monto:,} como {tipo}"
            else:
                respuesta = f"✅ Ingreso registrado: {monto} como {tipo}"
            
            # Agregar consejo de ahorro
            if isinstance(monto, int) and monto > 500000:
                respuesta += "\n💡 Consejo: ¡Excelente ingreso! Te recomiendo ahorrar al menos el 20%."
                
        elif intent == 'solicitar_resumen':
            respuesta = "📊 Aquí está tu resumen de gastos del mes:\n"
            respuesta += "• Total gastos: $XXX,XXX\n"
            respuesta += "• Total ingresos: $XXX,XXX\n"
            respuesta += "• Balance: $XXX,XXX\n"
            respuesta += "• Categoría con más gastos: [Categoría]\n"
            respuesta += "💡 ¿Te gustaría ver más detalles de alguna categoría?"
            
        elif intent == 'consultar_balance':
            respuesta = "💰 Tu balance actual:\n"
            respuesta += "• Ingresos del mes: $XXX,XXX\n"
            respuesta += "• Gastos del mes: $XXX,XXX\n"
            respuesta += "• Balance: $XXX,XXX\n"
            respuesta += "• Porcentaje ahorrado: XX%\n"
            respuesta += "💡 ¿Necesitas ayuda para mejorar tu balance?"
            
        elif intent == 'solicitar_tip':
            respuesta = "💡 Consejos financieros para ti:\n"
            respuesta += "• Ahorra al menos el 20% de tus ingresos\n"
            respuesta += "• Revisa tus gastos mensuales\n"
            respuesta += "• Evita gastos innecesarios\n"
            respuesta += "• Invierte en tu futuro\n"
            respuesta += "• Mantén un fondo de emergencia\n"
            respuesta += "🤔 ¿Te gustaría consejos específicos sobre algún tema?"
            
        elif intent == 'crear_recordatorio':
            motivo = entities.get('motivo', 'recordatorio')
            fecha = entities.get('fecha', 'fecha no especificada')
            respuesta = f"⏰ Recordatorio creado: {motivo} para {fecha}\n"
            respuesta += "📱 Te notificaré cuando sea el momento.\n"
            respuesta += "💡 ¿Necesitas crear más recordatorios?"
            
        elif intent == 'analisis_detallado':
            respuesta = "📈 Análisis financiero detallado:\n"
            respuesta += "• Tendencias de gastos: [Análisis]\n"
            respuesta += "• Categorías problemáticas: [Categorías]\n"
            respuesta += "• Oportunidades de ahorro: [Oportunidades]\n"
            respuesta += "• Recomendaciones: [Recomendaciones]\n"
            respuesta += "• Proyección mensual: [Proyección]\n"
            respuesta += "💡 ¿Te gustaría profundizar en algún aspecto?"
            
        else:
            respuesta = "🤔 No entendí bien tu mensaje. ¿Puedes ser más específico?\n"
            respuesta += "💡 Escribe 'ayuda' para ver ejemplos de lo que puedo hacer."
        
        return respuesta
        
    except Exception as e:
        return f"❌ Lo siento, tuve un problema procesando tu mensaje: {e}\n💡 Intenta de nuevo o escribe 'ayuda' para ver ejemplos."

def chat_interactivo():
    """Función principal del chat interactivo."""
    limpiar_pantalla()
    mostrar_banner()
    
    debug_mode = False
    contador_mensajes = 0
    
    print("👋 ¡Hola! Soy Phill, tu asistente financiero personal.")
    print("💬 ¿En qué puedo ayudarte hoy?\n")
    
    while True:
        try:
            # Obtener mensaje del usuario
            mensaje = input("👤 Tú: ").strip()
            
            if not mensaje:
                continue
            
            contador_mensajes += 1
            
            # Comandos especiales
            if mensaje.lower() in ['salir', 'exit', 'quit', 'bye']:
                print("\n🤖 Phill: ¡Hasta luego! Fue un placer ayudarte con tus finanzas.")
                print(f"📊 Total de mensajes procesados: {contador_mensajes}")
                print("💰 ¡Que tengas un excelente día financiero!")
                break
                
            elif mensaje.lower() in ['limpiar', 'clear']:
                limpiar_pantalla()
                mostrar_banner()
                continue
                
            elif mensaje.lower() in ['ayuda', 'help']:
                mostrar_ayuda()
                continue
                
            elif mensaje.lower() in ['debug']:
                debug_mode = not debug_mode
                estado = "activado" if debug_mode else "desactivado"
                print(f"🔍 Modo debug {estado}")
                continue
            
            # Procesar mensaje normal
            print("🤖 Phill: ", end="")
            respuesta = procesar_mensaje(mensaje, debug_mode)
            print(respuesta)
            print()  # Línea en blanco
            
        except KeyboardInterrupt:
            print("\n\n🤖 Phill: ¡Hasta luego! Fue un placer ayudarte.")
            print("💰 ¡Que tengas un excelente día financiero!")
            break
        except EOFError:
            print("\n\n🤖 Phill: ¡Hasta luego! Fue un placer ayudarte.")
            print("💰 ¡Que tengas un excelente día financiero!")
            break
        except Exception as e:
            print(f"\n❌ Error inesperado: {e}")
            print("💡 Intenta de nuevo o escribe 'salir' para terminar.")

if __name__ == "__main__":
    try:
        chat_interactivo()
    except Exception as e:
        print(f"❌ Error al iniciar el chat: {e}")
        sys.exit(1)
