#!/bin/bash
# Database setup verification script

set -e

echo "=== WriteSys Database Setup Verification ==="
echo

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "Error: .env file not found. Copy .env.example to .env first."
    exit 1
fi

# Check if postgres container is running
echo "1. Checking if postgres container is running..."
if docker ps | grep -q writesys-postgres; then
    echo "   ✓ Postgres container is running"
else
    echo "   ✗ Postgres container is not running"
    echo "   Run: docker compose up -d"
    exit 1
fi

# Check database connectivity
echo
echo "2. Testing database connectivity..."
if docker exec writesys-postgres pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" > /dev/null 2>&1; then
    echo "   ✓ Database is ready"
else
    echo "   ✗ Database is not ready"
    exit 1
fi

# Check if health_check table exists
echo
echo "3. Checking initialization script..."
HEALTH_CHECK=$(docker exec writesys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM health_check;" 2>/dev/null || echo "0")
if [ "$HEALTH_CHECK" -gt 0 ]; then
    echo "   ✓ Initialization script executed successfully"
else
    echo "   ✗ Initialization script not executed"
fi

# List all tables
echo
echo "4. Listing all tables in database..."
docker exec writesys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\dt"

# Check for Liquibase tables
echo
echo "5. Checking Liquibase migration status..."
LIQUIBASE_TABLES=$(docker exec writesys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('databasechangelog', 'databasechangeloglock');" 2>/dev/null || echo "0")
if [ "$LIQUIBASE_TABLES" -eq 2 ]; then
    echo "   ✓ Liquibase tables exist"
    echo
    echo "   Migration history:"
    docker exec writesys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT id, author, filename, dateexecuted FROM databasechangelog ORDER BY dateexecuted;"
else
    echo "   ✗ Liquibase tables not found"
    echo "   Run migrations with: docker compose --profile migrate up liquibase"
fi

# Check for WriteSys tables
echo
echo "6. Checking WriteSys tables..."
EXPECTED_TABLES=("user" "manuscript" "processed_commit" "sentence" "annotation" "annotation_version")
FOUND_COUNT=0

for table in "${EXPECTED_TABLES[@]}"; do
    EXISTS=$(docker exec writesys-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='$table';" 2>/dev/null || echo "0")
    if [ "$EXISTS" -eq 1 ]; then
        echo "   ✓ Table '$table' exists"
        ((FOUND_COUNT++))
    else
        echo "   ✗ Table '$table' not found"
    fi
done

echo
echo "=== Summary ==="
echo "Found $FOUND_COUNT out of ${#EXPECTED_TABLES[@]} expected tables"

if [ "$FOUND_COUNT" -eq ${#EXPECTED_TABLES[@]} ]; then
    echo "✓ All tables created successfully!"
    exit 0
else
    echo "✗ Some tables are missing. Run migrations first."
    exit 1
fi
