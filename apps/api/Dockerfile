FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
RUN npm ci
COPY packages/core ./packages/core
COPY apps/api ./apps/api
COPY tsconfig.base.json ./
RUN npm run build --workspace=packages/core
RUN npm run build --workspace=apps/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY apps/api/package.json ./apps/api/
RUN npm ci --omit=dev
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
