# Etapa 1: build de React/Vite
FROM node:18-alpine AS builder
WORKDIR /app

# Copia archivos y dependencias
COPY package*.json ./
RUN npm install

# Copia todo el proyecto y setea env
COPY . .
COPY .env.docker .env

# Compila el proyecto con Vite
RUN npm run build

# Etapa 2: nginx para servir lo generado
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
