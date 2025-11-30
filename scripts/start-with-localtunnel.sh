#!/bin/bash

echo "================================================"
echo "🚀 Iniciando Phill con LocalTunnel"
echo "================================================"
echo ""

# Verificar si localtunnel está instalado
if ! command -v lt &> /dev/null; then
    echo "📦 LocalTunnel no está instalado. Instalando..."
    npm install -g localtunnel
fi

echo "1️⃣  Iniciando servidor Phill en puerto 3001..."
npm start &
SERVER_PID=$!

echo "   Esperando a que el servidor inicie..."
sleep 3

echo ""
echo "2️⃣  Iniciando LocalTunnel..."
echo ""
echo "📝 IMPORTANTE: Copia la URL que aparezca abajo"
echo "    Ejemplo: https://random-name.loca.lt"
echo ""
echo "🔧 Configúrala en Twilio como:"
echo "    https://tu-url.loca.lt/webhook"
echo ""
echo "================================================"
echo ""

# Iniciar localtunnel
lt --port 3001

# Limpiar al salir
kill $SERVER_PID 2>/dev/null

