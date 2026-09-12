# Multi-stage build: compile TypeScript + generate the Prisma client in a
# full node_modules (including dev deps, so `prisma generate`'s CLI is
# available), then copy the whole thing into a slim runtime image. Simpler
# and more reliable than trying to prune to production-only deps, at the
# cost of a somewhat larger image — worth revisiting once this is a
# bottleneck, not before.
FROM node:22-slim AS build
WORKDIR /app
# node:*-slim doesn't include OpenSSL, which Prisma's engine needs to
# detect the right binary target for — without it, it silently falls back
# to a guessed version and warns on every startup.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

FROM node:22-slim AS runtime
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

# Mount a real volume here in production — this is the whole point of the
# split (persistent storage a serverless deploy of web/ can't offer).
VOLUME ["/data"]
ENV STORAGE_ROOT=/data

EXPOSE 4100
CMD ["node", "dist/server.js"]
