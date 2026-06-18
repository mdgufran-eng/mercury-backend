FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci
COPY packages/core ./packages/core
COPY apps/worker ./apps/worker
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/worker

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/worker/package.json ./apps/worker/
RUN npm ci --omit=dev
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
CMD ["node", "apps/worker/dist/index.js"]
