#!/bin/sh
set -e

# Wait for PostgreSQL to accept TCP connections (retries every 2s, no limit).
echo "Waiting for database at $DB_HOST:$DB_PORT..."
while ! nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 2
done
echo "Database is ready!"

echo "Running database migrations..."
npm run migration:run

# Runs every seeder on every start (no tracking), so seeders must be idempotent.
echo "Seeding database..."
npm run seed:run

# Watch mode: restarts on src/ changes synced by `docker compose up --watch`.
echo "Starting application (watch mode)..."
exec npm run start:dev
