# ───── Stage 1: build ───────────────────────────────────────────
FROM node:22.16.0-alpine3.22 AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY backend .
RUN npm run build

# ───── Stage 2: runtime ─────────────────────────────────────────
FROM node:22.16.0-alpine3.22
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY backend/package*.json ./
RUN npm ci --omit=dev
EXPOSE 3000
CMD ["node", "dist/server.js"]
