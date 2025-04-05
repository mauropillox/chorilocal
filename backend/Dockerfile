# Usa una imagen ligera de Python 3.11
FROM python:3.11-slim

# Establece el directorio de trabajo
WORKDIR /app

# Copia e instala dependencias
COPY requirements.txt .

# Instala dependencias necesarias del sistema y Python
RUN apt-get update && apt-get install -y gcc libffi-dev libsqlite3-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get remove -y gcc && apt-get autoremove -y && apt-get clean

# Copia el resto del backend
COPY . .

# Exponer puerto para Uvicorn (Render lo detecta)
EXPOSE 8000

# CMD final confiable
CMD sh -c "uvicorn main:app --host 0.0.0.0 --port 8000"
