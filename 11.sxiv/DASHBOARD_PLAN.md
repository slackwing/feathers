# SXIVA Dashboard Project Plan

## Executive Summary

**Goal**: Build an online dashboard at `andrewcheong.com/status` that visualizes personal data collected through SXIVA time-tracking files.

**Architecture**: Static frontend → REST API (on VM) → TimescaleDB (Docker on VM) ← Data sync from local SXIVA files

**Feasibility**: ✅ **This approach is valid and feasible.** The architecture follows standard web app patterns and all components are well-supported.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Local Machine (~/src/feathers/11.sxiv/data/*.sxiva)            │
│                                                                 │
│  1. Run `sxiva` command                                         │
│  2. Check last sync timestamp (via public API)                 │
│  3. Run `sxiva -a` (calculate all files)                       │
│  4. Parse modified .sxiva files                                │
│  5. Sync data to VM database (via API)                         │
└─────────────────────────────────────────────────────────────────┘
                           │
                           │ HTTPS
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ Google Cloud VM (andrewcheong.com)                             │
│                                                                 │
│  ┌──────────────────┐  ┌─────────────────┐  ┌───────────────┐ │
│  │ Apache           │  │ Backend API     │  │ Docker Compose│ │
│  │ /var/www/html/   │  │ (Python/Flask)  │  │               │ │
│  │   status/        │  │                 │  │ - Postgres/   │ │
│  │   (static files) │◄─┤ /api/status/*   │◄─┤   TimescaleDB │ │
│  │                  │  │ /api/sync/*     │  │ - Liquibase   │ │
│  └──────────────────┘  └─────────────────┘  └───────────────┘ │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ GitHub → bootstrap.sh (curl from repo)                   │  │
│  │   - docker-compose.yml                                   │  │
│  │   - Liquibase changesets                                 │  │
│  │   - API server code                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Components

### 1. **Frontend** (`dashboard/static/`)
- **Tech**: Plain HTML/CSS/JavaScript (or lightweight framework like Alpine.js)
- **Purpose**: Static dashboard UI with charts/graphs
- **Deployment**: Manual rsync to VM `/var/www/html/status/`
- **Data source**: Calls backend API routes

### 2. **Backend API** (`dashboard/server/`)
- **Tech**: Python Flask (lightweight, easy to deploy)
- **Purpose**:
  - Serve data queries for dashboard panels
  - Accept data sync from local machine
  - Provide last sync timestamp
- **Routes**:
  - `GET /api/status/last-sync` - Returns last sync timestamp
  - `POST /api/sync/data` - Accepts parsed .sxiva data for a date
  - `GET /api/dashboard/hobby-hours?days=7` - Example query endpoint
  - `GET /api/dashboard/alcohol-timeseries?start=...&end=...`
- **Deployment**: Systemd service on VM, or Docker container

### 3. **Database** (`dashboard/docker/`)
- **Tech**: TimescaleDB (Postgres extension for time-series)
- **Purpose**: Store all SXIVA-derived metrics
- **Management**: Docker Compose + Liquibase for schema versioning
- **Access**: Local to VM only (no public exposure), API server connects via Docker network

### 4. **Deployment/Bootstrap** (`dashboard/deploy/`)
- **Tech**: Bash scripts + Docker Compose
- **Purpose**: Cold-start VM setup, deploy updates, run migrations

---

## Suggested Improvements to Your Plan

### ✅ What's Good
1. **Static frontend + API backend**: Clean separation of concerns
2. **Docker Compose for database**: Easy reproducibility
3. **Liquibase for schema**: Version-controlled database changes
4. **Sync on sxiva startup**: Automatic, seamless integration
5. **Replace-all for each date**: Simplifies sync logic (idempotent)

### 🔧 Suggested Refinements

#### 1. **Deployment Workflow**
**Your idea**: Curl a bootstrap script from GitHub
**Better approach**: Use a small deployment repo structure

```bash
# On VM, one-time setup:
cd /opt
git clone https://github.com/you/sxiva-dashboard.git
cd sxiva-dashboard

# Initial setup
./scripts/bootstrap.sh

# Updates (pull latest changes)
git pull
./scripts/deploy.sh
```

**Why**: Git gives you version control, rollback capability, and doesn't require maintaining a curl-based bootstrap. You can still have `bootstrap.sh` handle initial Docker setup.

#### 2. **Database Access from Local Machine**
**Your concern**: "I don't know how I'd set things up so my computer can speak to a remote VM database"

**Solution**: Don't expose the database directly. Use the API.
- Database only accessible within Docker network on VM
- API endpoint accepts sync data: `POST /api/sync/data`
- API authenticates requests (API key in env var or config file)
- Your local `sxiva` tool sends parsed data via HTTPS to API

**Why**: More secure (database not exposed), easier to manage, standard web pattern.

#### 3. **Modification Timestamps**
**Your concern**: "We might have to fix the calculation step to not overwrite files that haven't changed"

**Current behavior**: The calculator always writes the file (even if unchanged)

**Solution options**:
- **A. Fix calculator**: Only write file if content actually changed (compare before/after)
- **B. Use git timestamps**: Query `git log --format=%at -- path/to/file.sxiva` for last modification
- **C. Track sync state locally**: Keep a local cache of what's been synced (`.sxiva-sync-cache.json`)

**Recommendation**: Option A (fix calculator to not overwrite unchanged files) is cleanest and benefits all users.

#### 4. **Sync Authentication**
**Missing from your plan**: How to authenticate sync requests

**Solution**: Simple API key
```python
# In local sxiva config: ~/.sxivarc or .env
SXIVA_DASHBOARD_API_KEY=your-secret-key-here

# API validates on each sync request
Authorization: Bearer your-secret-key-here
```

#### 5. **Data Sync Strategy**
**Your plan**: Parse .sxiva files, replace all data for that date

**Recommendation**: Use a staging + swap approach
```sql
-- For each date being synced:
BEGIN;
  DELETE FROM daily_stats WHERE date = '2025-01-17';
  INSERT INTO daily_stats (...) VALUES (...);
  UPDATE sync_metadata SET last_sync = NOW();
COMMIT;
```

This ensures atomic updates (all-or-nothing).

---

## Development Phases

### Phase 0: Infrastructure Setup ✅ (COMPLETE)
**Goal**: Get the VM and database foundation ready

- [x] Set up Docker and Docker Compose on VM
- [x] Create `dashboard/` directory structure in this repo
- [x] Create basic Docker Compose file (Postgres/TimescaleDB + Liquibase)
- [x] Test Docker setup locally first
- [x] Deploy to VM and verify database is accessible

**Status**: Complete! TimescaleDB running on VM with Liquibase migrations working.

**Actual time**: ~3 hours

### Phase 1: Database Schema Design
**Goal**: Define what data we're storing

- [x] Document exactly what fields to extract from .sxiva files (you'll provide specs)
- [x] Design database schema (tables, indexes, hypertables)
- [x] Create initial Liquibase changeset (002-daily-summary-schema.xml)
- [x] Test schema creation locally
- [x] Deploy to VM

**Status**: Complete! `daily_summary` table created with JSONB for flexible categories, typed columns for attributes, TimescaleDB hypertable, and GIN index for fast JSONB queries.

**Actual time**: ~2 hours

### Phase 2: Data Sync (Local → VM)
**Goal**: Get data from .sxiva files into the database

- [ ] Create .sxiva parser (extract summary, attributes, med data, etc.)
- [ ] Create sync client in `tools/sxiva/sync.py`
- [ ] Integrate sync into `sxiva` CLI command (pre-open hook)
- [ ] Create API endpoint: `POST /api/sync/data`
- [ ] Create API endpoint: `GET /api/status/last-sync`
- [ ] Test full sync workflow locally
- [ ] Deploy API to VM
- [ ] Test sync from local machine to VM

**Estimated time**: 6-8 hours

### Phase 3: Backend API (Query Endpoints)
**Goal**: Serve data to the dashboard

- [ ] Design API endpoints based on dashboard panels (you'll provide specs)
- [ ] Implement query endpoints
- [ ] Add API authentication/authorization
- [ ] Test API locally
- [ ] Deploy to VM
- [ ] Configure Apache reverse proxy for API

**Depends on**: You specifying what dashboard panels you want

**Estimated time**: 4-6 hours (once panel specs provided)

### Phase 4: Frontend Dashboard
**Goal**: Build the visual interface

- [ ] Design dashboard layout (you'll provide mockup or specs)
- [ ] Create HTML/CSS structure
- [ ] Implement JavaScript to call API endpoints
- [ ] Add charts/graphs (using Chart.js or similar)
- [ ] Test locally (with API)
- [ ] Deploy to VM (`rsync` to `/var/www/html/status/`)
- [ ] Configure Apache to serve static files

**Depends on**: You specifying what panels and visualizations you want

**Estimated time**: 8-12 hours (once panel specs provided)

### Phase 5: Deployment & Operations
**Goal**: Make it easy to deploy and maintain

- [ ] Create `bootstrap.sh` for cold-start VM setup
- [ ] Create `deploy.sh` for updates
- [ ] Document deployment process
- [ ] Set up backup strategy for database
- [ ] Test cold-start from scratch on clean VM

**Estimated time**: 3-4 hours

---

## Directory Structure

```
11.sxiv/
├── dashboard/
│   ├── README.md                  # Dashboard-specific docs
│   ├── static/                    # Frontend files (rsync to VM)
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.js
│   │   └── assets/
│   ├── server/                    # Backend API
│   │   ├── app.py                 # Flask application
│   │   ├── routes/
│   │   │   ├── sync.py           # Sync endpoints
│   │   │   └── dashboard.py      # Query endpoints
│   │   ├── models/                # Database models
│   │   ├── requirements.txt
│   │   └── config.py
│   ├── docker/                    # Docker infrastructure
│   │   ├── docker-compose.yml
│   │   ├── postgres/
│   │   │   └── Dockerfile
│   │   └── liquibase/
│   │       ├── Dockerfile
│   │       └── changelog/
│   │           └── db.changelog-master.xml
│   ├── deploy/                    # Deployment scripts
│   │   ├── bootstrap.sh          # Cold-start setup
│   │   ├── deploy.sh             # Update deployment
│   │   └── backup.sh             # Database backup
│   └── docs/                      # Additional documentation
│       ├── API.md                # API documentation
│       └── SCHEMA.md             # Database schema docs
├── tools/sxiva/
│   └── sync.py                    # Data sync client (NEW)
└── DASHBOARD_PLAN.md              # This file
```

---

## Technical Decisions & Rationale

### Why TimescaleDB over plain Postgres?
- **Time-series optimization**: Fast queries on date ranges
- **Automatic partitioning**: Better performance as data grows
- **Compression**: Saves disk space for historical data
- **Continuous aggregates**: Pre-computed rollups (e.g., weekly sums)
- **Still Postgres**: Can use all standard Postgres features

### Why Flask over other frameworks?
- **Lightweight**: Easy to deploy, minimal dependencies
- **Python**: Matches existing SXIVA tooling
- **Simple**: No ORM complexity needed for simple queries
- **Fast to develop**: Get API up quickly

### Why static frontend over React/Vue?
- **Simplicity**: No build step, no node_modules
- **Fast**: Direct HTML/CSS/JS loads instantly
- **Easy deployment**: Just rsync files
- **Can upgrade later**: If needed, add a framework later

### Why API key authentication?
- **Simple**: No OAuth complexity
- **Sufficient**: You're the only user
- **Secure enough**: HTTPS + secret key
- **Easy to rotate**: Just update config and redeploy

---

## Security Considerations

1. **Database**: Not exposed to internet, only accessible from API container
2. **API**: HTTPS only (via Apache), requires API key for writes
3. **API Key**: Stored in environment variables, not in code
4. **Frontend**: Static files, no sensitive data hardcoded
5. **VM**: Standard security (firewall, SSH keys, regular updates)

---

## Unknowns / Need Your Input

Before proceeding, I need you to specify:

### 1. **Data to Extract from .sxiva Files**
What specific fields/values should we parse and store?
- Summary time totals per category? (we have this)
- Attribute values? (sleep hours, depression score, etc.)
- Medication data from `[med]` lines?
- Individual time block data? (probably not needed, just aggregates)
- Date and day of week?
- Other metadata?

### 2. **Dashboard Panels/Visualizations**
What do you want to see? Examples:
- "7-day sum of hours spent on hobbies" - Bar chart? Line chart?
- "Time-series of drinks (alcohol) each day" - Line chart over how many days?
- "Sleep hours trend over last 30 days"
- "Category breakdown pie chart for this week"
- "Streaks: days with meditation, exercise, etc."
- Others?

### 3. **Database Schema Details**
Once I know what data to extract, I can design:
- Table structure
- Indexes
- Hypertables (for TimescaleDB)
- Sample queries for your panels

---

## Next Steps

1. **Review this plan**: Does the architecture make sense? Any concerns?
2. **Provide specifications**:
   - What data to extract from .sxiva files
   - What dashboard panels/visualizations you want
3. **Choose starting phase**: Want to start with infrastructure (Phase 0) or wait until specs are complete?

---

## Estimated Total Time

- **Infrastructure + Database**: 4-7 hours
- **Data Sync**: 6-8 hours
- **Backend API**: 4-6 hours (depends on complexity of panels)
- **Frontend**: 8-12 hours (depends on number of panels)
- **Deployment**: 3-4 hours

**Total**: ~25-37 hours of development time

**Phased approach**: We can build this incrementally:
- Phase 0-2: Get data flowing (basic infrastructure)
- Phase 3-4: Build one panel at a time
- Phase 5: Polish and deployment

---

## Questions?

- Does this architecture make sense?
- Should we simplify or expand any part?
- Ready to define data extraction specs and dashboard panels?
- Want to start with Phase 0 (infrastructure setup)?
