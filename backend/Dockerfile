# Usa Python 3.11 slim
FROM python:3.11-slim

# Establece el directorio de trabajo
WORKDIR /app

# Copia requirements y los instala
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copia el resto de los archivos del backend
COPY . .

# Expone el puerto 8000
EXPOSE 8000

# Ejecuta el script para crear el admin y luego lanza FastAPI
CMD ["sh", "-c", "python create_admin.py && uvicorn main:app --host 0.0.0.0 --port 8000"]
