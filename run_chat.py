#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script principal para ejecutar el chatbot financiero Phill.
"""

import sys
import os

def main():
    """Función principal."""
    
    print("🤖" + "="*50 + "🤖")
    print("💰        CHATBOT FINANCIERO PHILL        💰")
    print("🤖" + "="*50 + "🤖")
    print()
    print("🚀 OPCIONES DISPONIBLES:")
    print()
    print("1. 🌐 Aplicación Web (Streamlit) - RECOMENDADO")
    print("   streamlit run streamlit_app.py")
    print("   ¡Perfecto para compartir con tu equipo!")
    print()
    print("2. Chat Interactivo Completo")
    print("   python chat_interactivo.py")
    print()
    print("3. Chat Simple")
    print("   python chat_simple.py")
    print()
    print("4. Demo Automático")
    print("   python demo_chatbot.py")
    print()
    print("5. Sistema Completo (Flask)")
    print("   python main.py")
    print()
    print("🤖" + "="*50 + "🤖")
    print()
    print("💡 RECOMENDACIÓN:")
    print("   Para compartir con tu equipo:")
    print("   streamlit run streamlit_app.py")
    print()
    print("📚 Para más información, lee README_CHAT.md")
    print("🚀 Para desplegar, lee deploy_guide.md")
    print("🤖" + "="*50 + "🤖")

if __name__ == "__main__":
    main()
