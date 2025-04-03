# Usa una imagen base de Python
FROM python:3.9

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar el archivo requirements.txt y instalar las dependencias
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copiar el resto de los archivos de la aplicación
COPY . /app

# Instalar dependencias adicionales si es necesario
RUN pip install python-dotenv

# Exponer el puerto que usará la aplicación (8000 en este caso)
EXPOSE 8000

# Ejecutar el servidor con uvicorn en lugar de python main.py
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
