#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script de inicio para el chatbot financiero Phill.
Permite elegir entre diferentes modos de prueba.
"""

import os
import sys

def mostrar_menu():
    """Muestra el menú de opciones."""
    print("🤖" + "="*50 + "🤖")
    print("💰        CHATBOT FINANCIERO PHILL        💰")
    print("🤖" + "="*50 + "🤖")
    print("\n📋 OPCIONES DE PRUEBA:")
    print("1. 🎯 Chat Interactivo Completo")
    print("   - Interfaz completa con comandos especiales")
    print("   - Modo debug disponible")
    print("   - Ayuda integrada")
    print()
    print("2. ⚡ Chat Simple")
    print("   - Interfaz minimalista")
    print("   - Ideal para pruebas rápidas")
    print("   - Muestra intents y entities")
    print()
    print("3. 🧪 Demo Automático")
    print("   - Prueba automática con casos predefinidos")
    print("   - No requiere interacción")
    print("   - Ideal para verificar funcionamiento")
    print()
    print("4. 🚀 Sistema Completo (Flask)")
    print("   - Inicia el servidor Flask completo")
    print("   - Listo para WhatsApp")
    print("   - Requiere configuración de Twilio")
    print()
    print("0. ❌ Salir")
    print("🤖" + "="*50 + "🤖")

def ejecutar_opcion(opcion):
    """Ejecuta la opción seleccionada."""
    if opcion == "1":
        print("\n🚀 Iniciando Chat Interactivo Completo...")
        os.system("python chat_interactivo.py")
    elif opcion == "2":
        print("\n⚡ Iniciando Chat Simple...")
        os.system("python chat_simple.py")
    elif opcion == "3":
        print("\n🧪 Ejecutando Demo Automático...")
        os.system("python demo_chatbot.py")
    elif opcion == "4":
        print("\n🚀 Iniciando Sistema Completo...")
        print("⚠️  Asegúrate de tener configurado Twilio y las variables de entorno")
        os.system("python main.py")
    elif opcion == "0":
        print("\n👋 ¡Hasta luego!")
        sys.exit(0)
    else:
        print("\n❌ Opción no válida. Intenta de nuevo.")

def main():
    """Función principal."""
    while True:
        try:
            limpiar_pantalla()
            mostrar_menu()
            
            opcion = input("\n🎯 Selecciona una opción (0-4): ").strip()
            
            if opcion in ["0", "1", "2", "3", "4"]:
                ejecutar_opcion(opcion)
                
                # Pausa antes de volver al menú
                if opcion != "0":
                    input("\n⏸️  Presiona Enter para volver al menú...")
            else:
                print("\n❌ Opción no válida. Por favor selecciona 0-4.")
                input("⏸️  Presiona Enter para continuar...")
                
        except KeyboardInterrupt:
            print("\n\n👋 ¡Hasta luego!")
            sys.exit(0)
        except Exception as e:
            print(f"\n❌ Error: {e}")
            input("⏸️  Presiona Enter para continuar...")

def limpiar_pantalla():
    """Limpia la pantalla."""
    os.system('clear' if os.name == 'posix' else 'cls')

if __name__ == "__main__":
    main()
