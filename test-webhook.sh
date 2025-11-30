#!/bin/bash
echo "🧪 Probando webhook directamente..."
echo ""
curl -X POST http://localhost:3001/webhook \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "Body=Hola&From=whatsapp:+5215512345678&To=whatsapp:+14155238886" \
  -v
