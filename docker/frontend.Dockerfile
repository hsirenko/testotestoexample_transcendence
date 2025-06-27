# ── Stage 1: build the static bundle ─────────────────────────────
FROM node:22.16.0-alpine3.22 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

COPY index.html dist/

# ── Stage 2: serve over plain nginx ─────────────────────────────
FROM nginx:1.29.0-alpine
COPY --from=build /app/dist/index.html /usr/share/nginx/html/
COPY --from=build /app/dist/  /usr/share/nginx/html/dist/
# nginx.conf added later will forward everything else ( /api , websockets… )
