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

# Copy built app and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/app ./app
COPY --from=builder /app/components ./components
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/server.ts ./server.ts

# Create folders for persistent data
RUN mkdir -p sessions public/media

EXPOSE 3000

# Script to run migrations and start the app
COPY <<EOF /app/start.sh
#!/bin/sh
echo "Waiting for database..."
until npx prisma db push --accept-data-loss; do
  echo "Prisma db push failed, retrying in 5 seconds..."
  sleep 5
done
echo "Database ready. Starting app..."
npx tsx server.ts
EOF

RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]
