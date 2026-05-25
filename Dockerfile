FROM node:20-alpine AS builder

WORKDIR /app

COPY backend/workflow-engine/package*.json ./
RUN npm ci

COPY backend/workflow-engine/ .
RUN npx prisma generate

FROM node:20-alpine AS runner

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src

USER appuser

EXPOSE 3000

ENV NODE_ENV=production

CMD ["sh", "-c", "npx prisma db push --accept-data-loss && npx tsx src/server.ts"]
