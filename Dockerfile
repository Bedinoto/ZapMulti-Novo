# Stage 1: Build
FROM node:20 AS builder

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# Generate Prisma Client
RUN DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy" npx prisma generate

# Build Next.js
RUN npm run build

# Stage 2: Run
FROM node:20-slim

RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/server.ts ./server.ts

# Create folders for persistent data
RUN mkdir -p sessions public/media

EXPOSE 3000

# Script to run migrations and start the app
COPY <<EOF /app/start.sh
#!/bin/sh
npx prisma migrate deploy
npm run prisma:seed
npx tsx server.ts
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
