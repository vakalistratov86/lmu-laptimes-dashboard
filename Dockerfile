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
# server/migrate.ts reads migrations/*.sql + migrations/meta/_journal.json at
# startup (drizzle-orm migrator) — dist/ only has the bundled server code, not
# these raw files, so they must be copied separately into the image.
COPY --from=builder /app/migrations ./migrations
# shared/ + drizzle.config.ts are kept only so `docker compose exec dashboard
# npx drizzle-kit ...` can be run manually inside the container for ad-hoc
# introspection/diagnostics — normal schema changes go through `npm run
# db:generate` in dev (commits a new migrations/*.sql) and apply themselves
# automatically on the next deploy via server/migrate.ts, no manual step needed.
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
EXPOSE 3000
CMD ["node", "dist/index.cjs"]
