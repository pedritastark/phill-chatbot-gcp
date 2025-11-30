#!/bin/bash

# Script para iniciar Phill WhatsApp Bot

echo "🚀 Iniciando Phill WhatsApp Bot..."
echo ""

# Verificar que existe el archivo .env
if [ ! -f .env ]; then
    echo "❌ Error: No se encontró el archivo .env"
    echo "📝 Copia el archivo .env.example a .env y configura tus credenciales"
    echo ""
    echo "   cp .env.example .env"
    echo ""
    exit 1
fi

# Verificar que node_modules existe
if [ ! -d node_modules ]; then
    echo "📦 Instalando dependencias..."
    npm install
    echo ""
fi

# Iniciar el servidor
echo "🎯 Iniciando servidor..."
npm start

