# Stage 1: Build React application
FROM node:18-alpine as builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the React source code
COPY . .

# Build the application
RUN npm run build

# Debugging step: List the contents of the /app directory
RUN ls -l /app   # Check to ensure the build folder exists

# Stage 2: Serve the React app using Nginx
FROM nginx:alpine

# Copy the build files to Nginx's public folder
COPY --from=builder /app/build /usr/share/nginx/html

# Expose port 80 to access the app
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
