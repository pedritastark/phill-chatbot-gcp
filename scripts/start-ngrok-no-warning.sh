#!/bin/bash

echo "🚀 Iniciando ngrok sin página de advertencia..."
echo ""
echo "⚠️  NOTA: Si esto no funciona, necesitarás:"
echo "   1. Verificar tu cuenta de ngrok"
echo "   2. O agregar '--verify-webhook-provider twilio' al comando"
echo ""

ngrok http 3001 --log=stdout 2>&1 | tee logs/ngrok.log
