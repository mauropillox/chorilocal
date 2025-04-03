# Usa una imagen base con Python y Node
FROM python:3.10-slim

# Variables de entorno necesarias
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y build-essential curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g npm && \
    apt-get clean

# Crear carpetas y copiar archivos
WORKDIR /app
COPY backend backend
COPY frontend frontend
COPY requirements.txt .

# Crear venv e instalar Python deps
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --upgrade pip && pip install -r requirements.txt

# Instalar dependencias de Node y construir el frontend
WORKDIR /app/frontend
RUN npm install && npm run build

# Volver al backend y exponer el puerto
WORKDIR /app/backend
EXPOSE 8000

# Comando para iniciar FastAPI con Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
