# SXIVA Dashboard API

Flask API for syncing .sxiva data to TimescaleDB.

## Endpoints

### `GET /health`
Health check endpoint (no auth required).

**Response:**
```json
{
  "status": "healthy",
  "database": "connected"
}
```

### `POST /api/sync/daily`
Sync daily data from a .sxiva file.

**Authentication:** Bearer token in `Authorization` header

**Request:**
```json
{
  "date": "2025-01-17",
  "day_of_week": "F",
  "category_minutes": {
    "bkc": 40,
    "jnl": 32,
    "life": 48
  },
  "sleep_score": 79,
  "sleep_hours": 7.0,
  "dep_min": 1.0,
  "dep_max": -3.0,
  "dep_avg": -1.0,
  "dist": null,
  "soc": 2,
  "out": 2,
  "exe": null,
  "alc": null,
  "xmx": 1,
  "wea": 0.0
}
```

**Response:**
```json
{
  "status": "success",
  "date": "2025-01-17",
  "message": "Data synced successfully"
}
```

### `GET /api/status/last-sync`
Get the most recent date synced to the database.

**Authentication:** Bearer token in `Authorization` header

**Response:**
```json
{
  "last_sync_date": "2025-01-17",
  "last_updated_at": "2025-01-17T21:30:00+00:00"
}
```

## Setup

### 1. Generate API Token

```bash
# Generate a secure random token
openssl rand -hex 32
```

### 2. Configure Environment

Copy `.env.example` and set your values:
```bash
cp .env.example .env
# Edit .env and set API_TOKEN and DB_PASSWORD
```

### 3. Run with Docker Compose

```bash
cd ../docker
docker compose up -d dashboard-api
```

### 4. Test the API

```bash
# Health check (no auth)
curl http://localhost:5000/health

# Sync data (requires auth)
curl -X POST http://localhost:5000/api/sync/daily \
  -H "Authorization: Bearer your-token-here" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-17",
    "day_of_week": "F",
    "category_minutes": {"bkc": 40}
  }'

# Check last sync
curl http://localhost:5000/api/status/last-sync \
  -H "Authorization: Bearer your-token-here"
```

## Restarting After Code Changes

```bash
cd ../docker
docker compose restart dashboard-api

# Or rebuild if dependencies changed:
docker compose up -d --build dashboard-api
```

## Security Notes

- **Never commit `.env` files** - they contain secrets
- API token should be a long random string (32+ characters)
- In production, use HTTPS (Apache reverse proxy handles this)
- API is exposed on `127.0.0.1:5000` (localhost only)
- Apache will proxy `https://andrewcheong.com/api/*` → `http://localhost:5000/api/*`
