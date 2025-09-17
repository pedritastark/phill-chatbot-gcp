# 🚀 Guía de Despliegue - Chatbot Financiero Phill

## 🌐 Opción 1: Streamlit (Recomendado para Compartir)

### Instalación y Ejecución Local
```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar la aplicación web
streamlit run streamlit_app.py
```

### Despliegue en Streamlit Cloud (Gratis)
1. **Subir a GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Chatbot financiero Phill"
   git remote add origin https://github.com/tu-usuario/phill-chatbot.git
   git push -u origin main
   ```

2. **Conectar con Streamlit Cloud**:
   - Ve a [share.streamlit.io](https://share.streamlit.io)
   - Conecta tu repositorio de GitHub
   - Selecciona `streamlit_app.py` como archivo principal
   - ¡Listo! Tu chatbot estará disponible en una URL pública

### Despliegue en Heroku
```bash
# Crear Procfile
echo "web: streamlit run streamlit_app.py --server.port=$PORT --server.address=0.0.0.0" > Procfile

# Crear runtime.txt
echo "python-3.11.0" > runtime.txt

# Desplegar
heroku create phill-chatbot
git push heroku main
```

## 🐳 Opción 2: Docker (Para Equipos Técnicos)

### Crear Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8501

CMD ["streamlit", "run", "streamlit_app.py", "--server.port=8501", "--server.address=0.0.0.0"]
```

### Construir y Ejecutar
```bash
# Construir imagen
docker build -t phill-chatbot .

# Ejecutar contenedor
docker run -p 8501:8501 phill-chatbot
```

## ☁️ Opción 3: Google Cloud Run

### Crear Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8080

CMD ["streamlit", "run", "streamlit_app.py", "--server.port=8080", "--server.address=0.0.0.0"]
```

### Desplegar
```bash
# Construir y subir
gcloud builds submit --tag gcr.io/tu-proyecto/phill-chatbot

# Desplegar
gcloud run deploy phill-chatbot --image gcr.io/tu-proyecto/phill-chatbot --platform managed --region us-central1 --allow-unauthenticated
```

## 📱 Opción 4: WhatsApp (Producción)

### Configurar Twilio
```bash
# Variables de entorno
export TWILIO_ACCOUNT_SID="tu_account_sid"
export TWILIO_AUTH_TOKEN="tu_auth_token"
export TWILIO_PHONE_NUMBER="tu_phone_number"
```

### Ejecutar Servidor
```bash
python main.py
```

### Configurar Webhook
- En Twilio Console, configura el webhook apuntando a tu servidor
- URL: `https://tu-servidor.com/webhook`

## 🔗 Opciones de Compartir

### 1. **Streamlit Cloud** (Más Fácil)
- ✅ Gratis
- ✅ Fácil de configurar
- ✅ URL pública automática
- ✅ Actualizaciones automáticas desde GitHub

### 2. **Heroku** (Popular)
- ✅ Fácil despliegue
- ✅ URL personalizable
- ✅ Plan gratuito disponible

### 3. **Google Cloud Run** (Escalable)
- ✅ Escalado automático
- ✅ Integración con Google Cloud
- ✅ Pay-per-use

### 4. **Docker** (Flexible)
- ✅ Funciona en cualquier lugar
- ✅ Fácil de compartir
- ✅ Consistente entre entornos

## 📋 Checklist de Despliegue

### Antes de Desplegar
- [ ] Probar localmente con `streamlit run streamlit_app.py`
- [ ] Verificar que todas las dependencias estén en `requirements.txt`
- [ ] Probar casos de uso principales
- [ ] Documentar funcionalidades

### Después de Desplegar
- [ ] Probar la URL pública
- [ ] Verificar que el chatbot responde correctamente
- [ ] Compartir la URL con tu equipo
- [ ] Recopilar feedback

## 🎯 Recomendación para tu Equipo

**Para compartir rápidamente con tu equipo:**

1. **Usa Streamlit Cloud** (más fácil)
2. **Sube el código a GitHub**
3. **Conecta con Streamlit Cloud**
4. **Comparte la URL** con tu equipo

**URL de ejemplo**: `https://phill-chatbot.streamlit.app`

## 📞 Soporte

Si tienes problemas con el despliegue:
1. Verifica que todas las dependencias estén instaladas
2. Revisa los logs de error
3. Prueba localmente primero
4. Consulta la documentación de la plataforma elegida

¡Tu chatbot estará disponible para todo tu equipo en minutos! 🚀
