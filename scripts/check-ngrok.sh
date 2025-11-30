#!/bin/bash

echo "🔍 Verificando configuración de ngrok..."
echo ""

# Verificar si ngrok está corriendo
if ! curl -s http://localhost:4040/api/tunnels > /dev/null 2>&1; then
    echo "❌ ngrok NO está corriendo"
    echo ""
    echo "Solución: En otra terminal ejecuta:"
    echo "  ngrok http 3001"
    exit 1
fi

echo "✅ ngrok está corriendo"
echo ""

# Obtener la URL pública
PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep -o 'https://[^"]*' | head -1)

if [ -z "$PUBLIC_URL" ]; then
    echo "❌ No se pudo obtener la URL pública de ngrok"
    exit 1
fi

echo "📡 URL pública de ngrok:"
echo "   $PUBLIC_URL"
echo ""
echo "🔧 URL para Twilio (copia esta):"
echo "   ${PUBLIC_URL}/webhook"
echo ""
echo "🧪 Probando el endpoint..."
echo ""

# Probar el health endpoint
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "${PUBLIC_URL}/health")

if [ "$RESPONSE" = "200" ]; then
    echo "✅ El endpoint /health responde correctamente (200 OK)"
else
    echo "⚠️  El endpoint /health respondió con código: $RESPONSE"
fi

echo ""
echo "📋 Pasos siguientes:"
echo "1. Copia la URL para Twilio (arriba)"
echo "2. Ve a Twilio Console"
echo "3. Pégala en 'When a message comes in'"
echo "4. Asegúrate de seleccionar método POST"
echo "5. Guarda los cambios"
echo ""

