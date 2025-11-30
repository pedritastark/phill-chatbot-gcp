#!/bin/bash

# Script para actualizar la API key de Gemini en el .env

GEMINI_KEY="$1"

if [ -z "$GEMINI_KEY" ]; then
    echo "❌ Error: Proporciona la API key como argumento"
    echo "Uso: $0 <GEMINI_API_KEY>"
    exit 1
fi

# Verificar que el archivo .env existe
if [ ! -f .env ]; then
    echo "📝 Creando archivo .env desde .env.example..."
    cp .env.example .env
fi

# Actualizar o agregar la GEMINI_API_KEY
if grep -q "^GEMINI_API_KEY=" .env; then
    # Reemplazar la key existente (para macOS)
    sed -i '' "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$GEMINI_KEY|" .env
    echo "✅ GEMINI_API_KEY actualizada en .env"
else
    # Agregar la key si no existe
    echo "GEMINI_API_KEY=$GEMINI_KEY" >> .env
    echo "✅ GEMINI_API_KEY agregada a .env"
fi

# Mostrar key enmascarada
MASKED_KEY="${GEMINI_KEY:0:10}...${GEMINI_KEY: -4}"
echo "🔑 Key configurada: $MASKED_KEY"
echo ""
echo "🎯 Ahora configura tus credenciales de Twilio:"
echo "   - TWILIO_ACCOUNT_SID"
echo "   - TWILIO_AUTH_TOKEN"
echo ""
echo "📝 Edita el archivo .env manualmente o usa:"
echo "   nano .env"

