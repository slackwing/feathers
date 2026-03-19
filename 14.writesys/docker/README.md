# WriteSys Docker Setup

This directory contains Docker configuration for the WriteSys project.

## Quick Start

### 1. Environment Setup

```bash
cd docker
cp .env.example .env
# Edit .env and set secure passwords
```

### 2. Start Database

```bash
docker compose up -d
```

This starts the PostgreSQL database container.

### 3. Run Database Migrations

```bash
docker compose --profile migrate up liquibase
```

This applies all Liquibase changelogs to create the database schema.

### 4. Verify Setup

```bash
./test-db.sh
```

This script checks:
- Postgres container is running
- Database connectivity
- Initialization scripts executed
- Liquibase migrations applied
- All expected tables exist

### 5. Start API Server

```bash
docker compose up -d api
```

The API will be available at http://localhost:5000

## Services

### postgres
- **Image:** postgres:16-alpine
- **Port:** 127.0.0.1:5432
- **Database:** writesys
- **User:** writesys_user (configurable via .env)

### liquibase
- **Profile:** migrate (must be explicitly started)
- **Purpose:** Database schema migrations
- **Changelog:** liquibase/changelog/db.changelog-master.xml

### api
- **Build:** Multi-stage Go build
- **Port:** 127.0.0.1:5000
- **Purpose:** HTTP API server for frontend

## Directory Structure

```
docker/
├── docker-compose.yml           # Service definitions
├── Dockerfile                   # API server build
├── Dockerfile.liquibase         # Liquibase container
├── .env.example                 # Environment template
├── .env                         # Your local config (gitignored)
├── test-db.sh                   # Verification script
├── README.md                    # This file
├── init-scripts/
│   └── 01-init-database.sql    # Bootstrap SQL
└── liquibase/
    ├── liquibase.properties
    └── changelog/
        ├── db.changelog-master.xml
        └── 001-*.xml ... 007-*.xml
```

## Common Commands

### View logs
```bash
docker compose logs -f postgres
docker compose logs -f api
```

### Stop all services
```bash
docker compose down
```

### Reset database (WARNING: deletes all data)
```bash
docker compose down -v
docker compose up -d
docker compose --profile migrate up liquibase
```

### Connect to database
```bash
docker exec -it writesys-postgres psql -U writesys_user -d writesys
```

Or use pgcli:
```bash
pgcli postgresql://writesys_user:password@localhost:5432/writesys
```

### Re-run migrations
```bash
docker compose --profile migrate up liquibase --force-recreate
```

## Troubleshooting

### Port 5432 already in use
Another Postgres instance may be running. Check with:
```bash
lsof -i :5432
```

### Migrations fail
Check Liquibase logs:
```bash
docker compose --profile migrate logs liquibase
```

### Can't connect to database
Verify the container is healthy:
```bash
docker ps
docker exec writesys-postgres pg_isready -U writesys_user -d writesys
```
