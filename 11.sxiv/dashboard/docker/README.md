# SXIVA Dashboard - Docker Infrastructure

This directory contains the Docker Compose setup for TimescaleDB and Liquibase database migrations.

## Quick Start (Local Testing)

### 1. Set up environment
```bash
cd dashboard/docker
cp .env.example .env
# Edit .env and set a secure POSTGRES_PASSWORD
```

### 2. Start TimescaleDB
```bash
docker compose up -d
```

This starts TimescaleDB with the basic initialization script that enables the TimescaleDB extension.

### 3. Check database is healthy
```bash
docker compose ps
docker compose logs timescaledb
```

You should see "TimescaleDB initialized successfully" in the logs.

### 4. Run Liquibase migrations
```bash
docker compose --profile migrate up liquibase
```

This creates the initial schema (sync_metadata and daily_stats tables).

### 5. Connect to database (optional)
```bash
docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats
```

Once connected, you can run queries:
```sql
-- Check TimescaleDB version
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';

-- See all tables
\dt

-- Check sync metadata
SELECT * FROM sync_metadata;

-- Check health check
SELECT * FROM health_check;

-- Exit
\q
```

## Management Commands

### Start services
```bash
docker compose up -d
```

### Stop services
```bash
docker compose down
```

### Stop and remove data (⚠️ deletes all data)
```bash
docker compose down -v
```

### View logs
```bash
docker compose logs -f timescaledb
```

### Run a new Liquibase migration
```bash
# After adding a new changeset XML file
docker compose --profile migrate up liquibase
```

### Access database shell
```bash
docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats
```

### Backup database
```bash
docker compose exec timescaledb pg_dump -U sxiva_user sxiva_stats > backup.sql
```

### Restore database
```bash
cat backup.sql | docker compose exec -T timescaledb psql -U sxiva_user -d sxiva_stats
```

## Architecture

### Components

1. **TimescaleDB** (`timescaledb` service)
   - PostgreSQL with TimescaleDB extension
   - Port 5432 (exposed only on 127.0.0.1 for development)
   - Persistent volume: `timescaledb-data`
   - Init scripts run on first startup: `init-scripts/`

2. **Liquibase** (`liquibase` service)
   - Database schema versioning
   - Only runs when `--profile migrate` is specified
   - Reads changesets from `liquibase/changelog/`

### Network

Services communicate via `sxiva-network` Docker network. The database is not exposed to the internet - only accessible:
- From localhost (127.0.0.1:5432) for development
- From other containers on sxiva-network (e.g., API server)

### Data Persistence

Database data is stored in a Docker volume named `timescaledb-data`. This persists across container restarts. To completely reset:
```bash
docker compose down -v
```

## Liquibase Changesets

### Current Schema

**`sync_metadata` table**:
- Tracks the last sync timestamp
- Single-row table (enforced by unique index)
- Updated after each successful sync

**`daily_stats` table**:
- Stores daily statistics from .sxiva files
- Primary key: date
- JSONB column for flexible data storage (will be refined later)
- Converted to TimescaleDB hypertable for time-series optimization

### Adding New Changesets

1. Create a new XML file in `liquibase/changelog/`:
   ```bash
   touch liquibase/changelog/002-add-category-stats.xml
   ```

2. Add the changeset (see existing files for examples)

3. Include it in `db.changelog-master.xml`:
   ```xml
   <include file="changelog/002-add-category-stats.xml"/>
   ```

4. Run the migration:
   ```bash
   docker compose --profile migrate up liquibase
   ```

## Troubleshooting

### Database won't start
```bash
# Check logs
docker compose logs timescaledb

# Common issues:
# - Port 5432 already in use (stop local Postgres)
# - Invalid password in .env
# - Volume corruption (remove with: docker compose down -v)
```

### Liquibase fails
```bash
# Check logs
docker compose --profile migrate logs liquibase

# Common issues:
# - Database not ready (wait for health check)
# - Invalid XML syntax in changelog
# - Password mismatch in liquibase.properties
```

### Can't connect to database
```bash
# Check service is running
docker compose ps

# Check health
docker compose exec timescaledb pg_isready -U sxiva_user -d sxiva_stats

# Try connecting
docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats
```

## Production Deployment (VM)

On your VM:

1. Install Docker and Docker Compose
2. Clone this repo or copy the `dashboard/docker/` directory
3. Create `.env` with secure password
4. Remove port exposure from docker compose.yml (security)
5. Start services:
   ```bash
   docker compose up -d
   docker compose --profile migrate up liquibase
   ```

The database will only be accessible from the API container on the same Docker network.
