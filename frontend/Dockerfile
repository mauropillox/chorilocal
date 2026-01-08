# Stage 1: Build React application
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --include=dev
COPY . .
ENV NODE_ENV=production

# Build-time argument for API URL - pass during build with:
# docker build --build-arg VITE_API_URL=https://your-backend.onrender.com .
ARG VITE_API_URL=https://chorilocal-backend.onrender.com
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -- --mode production

# Stage 2: Serve React app with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configs to temp location first
COPY nginx.local.conf /tmp/nginx.local.conf
COPY nginx.conf /tmp/nginx.conf

# Use appropriate config based on build arg - only copy the one we need
ARG VITE_API_URL=https://chorilocal-backend.onrender.com
RUN if echo "$VITE_API_URL" | grep -q "localhost"; then \
    cp /tmp/nginx.local.conf /etc/nginx/conf.d/default.conf; \
    else \
    cp /tmp/nginx.conf /etc/nginx/conf.d/default.conf; \
    fi && rm -f /tmp/nginx*.conf

EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
