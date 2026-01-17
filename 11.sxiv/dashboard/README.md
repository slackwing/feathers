# SXIVA Dashboard

Personal metrics dashboard powered by SXIVA time-tracking data.

## Quick Start

### Test Locally (Phase 0 - Infrastructure)

```bash
cd dashboard/docker
./test-db.sh
```

This will:
1. Start TimescaleDB in Docker
2. Run Liquibase migrations
3. Verify the setup with test queries
4. Show you how to connect

### Manual Setup

If you prefer step-by-step:

```bash
cd dashboard/docker

# 1. Create environment file
cp .env.example .env
# Edit .env and set a secure POSTGRES_PASSWORD

# 2. Start TimescaleDB
docker compose up -d

# 3. Run migrations
docker compose --profile migrate up liquibase

# 4. Connect to database
docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats
```

## Project Status

### ✅ Phase 0: Infrastructure Setup (COMPLETE)
- [x] Docker Compose configuration
- [x] TimescaleDB container
- [x] Liquibase migrations
- [x] Initial schema (sync_metadata, daily_stats)
- [x] Test script

### 🚧 Phase 1: Database Schema (PENDING)
- [ ] Define data extraction specifications
- [ ] Design detailed schema
- [ ] Create Liquibase changesets

### ⏳ Phase 2: Data Sync (NOT STARTED)
### ⏳ Phase 3: Backend API (NOT STARTED)
### ⏳ Phase 4: Frontend (NOT STARTED)
### ⏳ Phase 5: Deployment (NOT STARTED)

See [DASHBOARD_PLAN.md](../DASHBOARD_PLAN.md) for full project plan.

## Directory Structure

```
dashboard/
├── README.md              # This file
├── docker/                # Docker infrastructure
│   ├── docker compose.yml
│   ├── .env.example
│   ├── init-scripts/      # Database initialization
│   ├── liquibase/         # Schema migrations
│   └── test-db.sh         # Test script
├── server/                # Backend API (Phase 3)
├── static/                # Frontend files (Phase 4)
└── deploy/                # Deployment scripts (Phase 5)
```

## Current Database Schema

### `sync_metadata` table
Tracks the last data sync timestamp.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Always 1 (singleton) |
| last_sync_timestamp | TIMESTAMPTZ | Last successful sync |
| last_sync_file_count | INTEGER | Number of files synced |
| notes | TEXT | Optional notes |

### `daily_stats` table
Stores daily statistics (placeholder schema, will be refined).

| Column | Type | Description |
|--------|------|-------------|
| date | DATE | Primary key |
| day_of_week | VARCHAR(10) | Day name |
| file_path | TEXT | Source .sxiva file |
| data_json | JSONB | Flexible data storage |
| created_at | TIMESTAMPTZ | Record creation |
| updated_at | TIMESTAMPTZ | Last update |

This is a **TimescaleDB hypertable**, optimized for time-series queries.

## Next Steps

1. **Try the setup**:
   ```bash
   cd dashboard/docker
   ./test-db.sh
   ```

2. **Explore the database**:
   ```bash
   docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats
   ```

3. **Define what data you want to track** - This determines the next phase of development

## Useful Commands

```bash
# Start database
docker compose up -d

# Stop database
docker compose down

# View logs
docker compose logs -f timescaledb

# Connect to database
docker compose exec timescaledb psql -U sxiva_user -d sxiva_stats

# Run new migration
docker compose --profile migrate up liquibase

# Backup database
docker compose exec timescaledb pg_dump -U sxiva_user sxiva_stats > backup.sql

# Full reset (⚠️ deletes all data)
docker compose down -v
```

## Documentation

- [Docker README](docker/README.md) - Detailed Docker setup guide
- [Dashboard Plan](../DASHBOARD_PLAN.md) - Full project architecture and plan
- [Liquibase Changelog](docker/liquibase/changelog/) - Database schema versions
