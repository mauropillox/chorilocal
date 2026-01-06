# Stage 1: Build React application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV NODE_ENV=production
# Use backend URL directly (Render services are separate)
ENV VITE_API_URL=https://chorilocal-backend.onrender.com
RUN npm run build -- --mode production

# Stage 2: Serve React app with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
