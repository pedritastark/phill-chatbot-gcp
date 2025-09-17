#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para iniciar la aplicación web del chatbot financiero Phill.
"""

import subprocess
import sys
import os

def main():
    """Inicia la aplicación web de Streamlit."""
    
    print("🤖" + "="*50 + "🤖")
    print("💰        CHATBOT FINANCIERO PHILL        💰")
    print("🤖" + "="*50 + "🤖")
    print()
    print("🌐 Iniciando aplicación web...")
    print("📱 La aplicación estará disponible en:")
    print("   http://localhost:8501")
    print()
    print("💡 Para compartir con tu equipo:")
    print("   1. Sube el código a GitHub")
    print("   2. Conecta con Streamlit Cloud")
    print("   3. ¡Comparte la URL!")
    print()
    print("📚 Lee deploy_guide.md para más opciones")
    print("🤖" + "="*50 + "🤖")
    print()
    
    try:
        # Verificar que Streamlit esté instalado
        subprocess.run([sys.executable, "-c", "import streamlit"], check=True)
        
        # Iniciar Streamlit
        subprocess.run([
            sys.executable, "-m", "streamlit", "run", "streamlit_app.py",
            "--server.port", "8501",
            "--server.address", "0.0.0.0"
        ])
        
    except subprocess.CalledProcessError:
        print("❌ Error: Streamlit no está instalado.")
        print("💡 Instala con: pip install streamlit")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n👋 ¡Aplicación detenida!")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
