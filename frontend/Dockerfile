# Etapa de build con Node.js
FROM node:18 AS build

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Etapa de producción con Nginx
FROM nginx:alpine

# Copia archivos de build a Nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Configuración custom de Nginx (ver abajo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
