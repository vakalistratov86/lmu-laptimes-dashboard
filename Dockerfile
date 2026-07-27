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
# schema.ts + drizzle.config.ts let `npx drizzle-kit push` run against the
# production DB after a schema change — dist/ only has the bundled server
# code, not the raw schema drizzle-kit reads. CI runs this automatically on
# every deploy (see .github/workflows/deploy.yml), before the new image
# replaces the running container; kept in the image too so it can still be
# run manually (`docker compose exec dashboard npx drizzle-kit push`) if a
# schema drift ever needs a one-off fix outside the normal deploy.
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
EXPOSE 3000
CMD ["node", "dist/index.cjs"]
