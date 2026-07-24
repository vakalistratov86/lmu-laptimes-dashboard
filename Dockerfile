# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install --ignore-scripts
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# @duckdb/node-api's native binding (.node) dynamically links against libstdc++/libgcc,
# which node:20-alpine does not include by default — without them require() fails at
# import time (e.g. when uploading a .duckdb telemetry file).
RUN apk add --no-cache libstdc++ libgcc
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# schema.ts + drizzle.config.ts let `docker compose exec dashboard npx drizzle-kit
# push` be run manually against the production DB after a schema change —
# dist/ only has the bundled server code, not the raw schema drizzle-kit reads.
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
EXPOSE 3000
CMD ["node", "dist/index.cjs"]
