# Usa una imagen ligera de Python 3.11
FROM python:3.11-slim

# Establece el directorio de trabajo
WORKDIR /app

# Copia e instala dependencias
COPY requirements.txt .

# Instala dependencias necesarias del sistema
RUN apt-get update && apt-get install -y gcc libffi-dev libsqlite3-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get remove -y gcc && apt-get autoremove -y && apt-get clean

# Copia todo el backend
COPY . .

# Expone el puerto para Uvicorn
EXPOSE 8000

# Comando para iniciar la app
CMD exec python create_admin.py && exec uvicorn main:app --host 0.0.0.0 --port 8000
