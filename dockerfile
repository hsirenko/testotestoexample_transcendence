# frontend/Dockerfile

# ─── Build Stage ───────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app

# install all deps (incl. TypeScript compiler)
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

# copy source & build
COPY . .
RUN npm run build

# ─── Runtime Stage ─────────────────────────────────────────────────────────────
FROM node:18-alpine AS runner
WORKDIR /app

# install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# bring in compiled output and your HTML
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.html ./

EXPOSE 5500

# start the static server
CMD ["npm", "run", "serve"]
