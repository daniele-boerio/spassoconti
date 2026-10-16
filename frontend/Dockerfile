# Stage 1: Build
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
# `npm ci` invece di `npm install`: installazione deterministica dal
# package-lock.json committato (più veloce, riproducibile, niente
# ri-risoluzione dei peer in fase di build).
RUN npm ci
COPY . .
# Vite genera la cartella /dist
RUN npm run build

# Stage 2: Serve con Nginx
FROM nginx:alpine

# Config nginx con cache corretta (index.html no-cache, asset immutabili):
# evita la schermata bianca dopo i deploy (cache PWA iOS).
COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]