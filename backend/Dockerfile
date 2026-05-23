FROM node:20-alpine AS builder

WORKDIR /app

COPY workflow-engine/package*.json ./
RUN npm ci

COPY workflow-engine/ ./
RUN npx prisma generate
RUN npm run build 2>/dev/null || true

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma

USER appuser

EXPOSE 3001

ENV NODE_ENV=production

CMD ["npx", "tsx", "src/server.ts"]
