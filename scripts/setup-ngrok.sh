#!/bin/bash

echo "================================================"
echo "🔧 Configuración de ngrok para Phill"
echo "================================================"
echo ""
echo "Pasos para configurar ngrok:"
echo ""
echo "1️⃣  Crear cuenta (GRATIS):"
echo "    https://dashboard.ngrok.com/signup"
echo ""
echo "2️⃣  Obtener authtoken:"
echo "    https://dashboard.ngrok.com/get-started/your-authtoken"
echo ""
echo "3️⃣  Configurar authtoken:"
echo "    ngrok config add-authtoken TU_AUTHTOKEN"
echo ""
echo "4️⃣  Iniciar tunnel:"
echo "    ngrok http 3001"
echo ""
echo "================================================"
echo ""
read -p "¿Ya tienes tu authtoken de ngrok? (s/n): " respuesta

if [ "$respuesta" = "s" ] || [ "$respuesta" = "S" ]; then
    read -p "Pega tu authtoken aquí: " authtoken
    
    if [ ! -z "$authtoken" ]; then
        ngrok config add-authtoken "$authtoken"
        echo ""
        echo "✅ Authtoken configurado!"
        echo ""
        echo "🚀 Ahora puedes ejecutar:"
        echo "   ngrok http 3001"
    else
        echo "❌ No proporcionaste un authtoken válido"
    fi
else
    echo ""
    echo "📝 Sigue los pasos arriba para obtener tu authtoken"
fi

