#!/bin/sh

# Wait for database to be ready
echo "Waiting for database to be ready..."
until npx prisma db push --accept-data-loss; do
  echo "Prisma db push failed, retrying in 5 seconds..."
  sleep 5
done

echo "Database is ready. Starting application..."
# Start the application
npm start
