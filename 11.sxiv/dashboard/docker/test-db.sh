#!/bin/bash
# Test script to verify TimescaleDB setup

set -e

echo "=== Testing TimescaleDB Setup ==="
echo

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running"
    exit 1
fi
echo "✓ Docker is running"

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found, creating from .env.example"
    cp .env.example .env
    echo "⚠️  Please edit .env and set POSTGRES_PASSWORD, then run this script again"
    exit 1
fi
echo "✓ .env file exists"

# Start services
echo
echo "Starting TimescaleDB..."
docker compose up -d
echo

# Wait for database to be healthy
echo "Waiting for database to be ready..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker compose exec -T timescaledb pg_isready -U sxiva_user -d sxiva_stats > /dev/null 2>&1; then
        echo "✓ Database is ready"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo -n "."
done
echo

if [ $elapsed -ge $timeout ]; then
    echo "❌ Database failed to start within ${timeout}s"
    echo "Check logs with: docker compose logs timescaledb"
    exit 1
fi

# Run Liquibase migrations
echo
echo "Running Liquibase migrations..."
docker compose --profile migrate up liquibase
echo

# Test database queries
echo
echo "=== Testing Database ==="
echo

echo "1. Checking TimescaleDB extension..."
docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';"
echo

echo "2. Listing all tables..."
docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats -c "\dt"
echo

echo "3. Checking sync_metadata table..."
docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats -c "SELECT * FROM sync_metadata;"
echo

echo "4. Checking health_check table..."
docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats -c "SELECT * FROM health_check;"
echo

echo "5. Checking daily_stats table structure..."
docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats -c "\d daily_stats"
echo

echo "=== All Tests Passed! ==="
echo
echo "Database is running at: localhost:5432"
echo "Database name: sxiva_stats"
echo "Username: sxiva_user"
echo
echo "Connect with:"
echo "  docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats"
echo
echo "Stop with:"
echo "  docker compose down"
