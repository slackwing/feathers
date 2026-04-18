# Manuscript Studio Deployment Plan

## Executive Summary

Transform WriteSys into **Manuscript Studio**, a deployable manuscript annotation system that:
- Runs as a Docker-containerized API server (maximum portability)
- Uses GCP-managed PostgreSQL (data safety, automated backups)
- Integrates migration logic directly into the API (no separate CLI needed)
- Authenticates via token-based system for admin endpoints
- Syncs manuscripts automatically via GitHub webhooks
- Validates users are working with latest manuscript version

## Architecture Overview

### Current State (WriteSys)
```
CLI → Direct DB Access → PostgreSQL (local)
API Server → PostgreSQL (local)
Frontend → API Server (session auth)
Manuscript → Manual CLI processing
```

### Target State (Manuscript Studio)

**Webhook Flow (Git Push → Database Update):**
```
GitHub Push
    ↓
Webhook (with secret)
    ↓
API Server (Docker)
    ├── API Admin Endpoint (/api/admin/webhook)
    ├── Migration Logic (internal)
    └── GCP PostgreSQL Update
```

**Browser Flow (User → Annotations):**
```
Browser/Frontend
    ↓
Apache Proxy (:80/:443)
    ↓
API Server (Docker) (:5001)
    ├── User Auth Middleware
    ├── Version Validation
    └── GCP PostgreSQL
```

## Key Design Decisions

### 1. **Docker Over Systemd**
- **Rationale**: Maximum portability, works on any Linux/Mac/Windows with Docker
- **Trade-off**: Slightly more complex than systemd, but universal
- **Implementation**: Single container with API server serving both API and static files

### 2. **API-Integrated Migration**
- **Rationale**: Eliminates CLI dependency, atomic operations, simpler deployment
- **Change**: Move migration logic from `cli/writesys/` into `api/migrations/` package
- **Benefit**: Single deployment artifact, no coordination between processes

### 3. **Authentication System**

#### User Authentication (Existing)
- **Type**: Session-based with cookies
- **Generation**: Created on login, stored in memory
- **Usage**: Frontend annotation operations
- **Lifespan**: 24 hours or until logout

#### System Token (New)
- **Type**: Static bearer token (like an API key)
- **Generation**: Use `openssl rand -hex 32` or similar during setup
- **Storage**: In config file (never in database)
- **Usage**: Admin endpoints only (webhook handler, manual sync)
- **Rotation**: Manual via config file update + server restart

Example generation:
```bash
# Generate a secure system token during installation
SYSTEM_TOKEN=$(openssl rand -hex 32)
echo "System Token: $SYSTEM_TOKEN"  # Save this in config.yaml
```

### 4. **GitHub Webhooks**
- **Trigger**: Push to main/master branch affecting `.manuscript` files
- **Flow**: GitHub → API endpoint → Pull repo → Run migration
- **Security**: HMAC signature validation using webhook secret

GitHub sends a `X-Hub-Signature-256` header with HMAC-SHA256 of the payload using a shared secret. This is different from the system token - it's specifically for validating the webhook came from GitHub:

```go
// Validate webhook signature
func validateGitHubWebhook(payload []byte, signature string, secret string) bool {
    mac := hmac.New(sha256.New, []byte(secret))
    mac.Write(payload)
    expectedSig := "sha256=" + hex.EncodeToString(mac.Sum(nil))
    return hmac.Equal([]byte(signature), []byte(expectedSig))
}
```

Configuration:
- Generate webhook secret: `openssl rand -hex 32`
- Add to GitHub webhook settings AND config.yaml
- Different from system token (webhook secret validates source, system token authorizes actions)

### 5. **Version Validation (Simplified)**
- **Approach**: API validates all requests against latest migration
- **Implementation**: Middleware checks if requested commit_hash matches latest
- **User Experience**: Error response with "Manuscript has been updated, please refresh"
- **No real-time complexity**: Simpler, more reliable, less code to maintain

## Implementation Plan

### Phase 1: Repository Structure Design

#### 1.1 Ideal Manuscript Studio Repository Structure

```
manuscript-studio/
├── README.md                    # Professional open-source documentation
├── LICENSE                      # MIT or Apache 2.0
├── install.sh                   # One-liner installation script
├── config.example.yaml          # Template configuration
├── VERSION                      # Semantic versioning
├── go.mod                       # Module: github.com/slackwing/manuscript-studio
├── go.sum
├── Dockerfile                   # Multi-stage build
├── docker-compose.yml           # For local development
├── .github/
│   └── workflows/
│       ├── test.yml            # CI testing
│       └── release.yml         # Auto-release on tag
│
├── cmd/
│   └── server/                 # Main application entry point
│       └── main.go
│
├── internal/                   # Private packages
│   ├── config/                 # Configuration management
│   │   └── config.go
│   ├── database/               # Database connection and queries
│   │   ├── connection.go
│   │   └── queries.go
│   ├── auth/                   # Authentication logic
│   │   ├── sessions.go
│   │   └── tokens.go
│   ├── migrations/             # Manuscript migration engine (from CLI)
│   │   ├── processor.go
│   │   ├── differ.go
│   │   └── git.go
│   └── sentence/               # Sentence processing wrapper for segman
│       └── tokenizer.go        # Wrapper that calls segman library
│
├── api/                        # HTTP API
│   ├── router.go               # Route definitions
│   ├── middleware/
│   │   ├── auth.go             # User authentication
│   │   ├── admin.go            # System token validation
│   │   ├── cors.go
│   │   └── version.go          # Manuscript version validation
│   ├── handlers/
│   │   ├── health.go
│   │   ├── auth.go             # Login/logout
│   │   ├── users.go
│   │   ├── manuscripts.go
│   │   ├── annotations.go
│   │   ├── tags.go
│   │   └── admin.go            # Webhook, sync endpoints
│   └── models/                 # Request/response structs
│       ├── requests.go
│       └── responses.go
│
├── web/                        # Frontend (static files)
│   ├── index.html
│   ├── login.html
│   ├── css/
│   │   ├── book.css
│   │   └── styles.css
│   ├── js/
│   │   ├── auth.js
│   │   ├── renderer.js
│   │   ├── annotations.js
│   │   ├── segmenter.js
│   │   ├── pagedjs-config.js
│   │   └── rainbow-slice.js
│
├── liquibase/                  # Database migrations (Liquibase)
│   ├── changelog/
│   │   ├── db.changelog-master.xml
│   │   ├── changes/
│   │   │   ├── 001-initial-schema.xml
│   │   │   ├── 002-seed-default-user.xml
│   │   │   ├── 003-add-annotation-position.xml
│   │   │   └── 004-add-manuscript-access.xml
│   └── liquibase.properties
│
├── scripts/                     # Utility scripts
│   ├── generate-token.sh       # Generate secure tokens
│   ├── backup-database.sh      # Backup before migration
│   └── test-webhook.sh         # Test GitHub webhook locally
│
├── tests/                       # Test files
│   ├── e2e/                    # Playwright tests
│   │   └── annotations.spec.js
│   └── integration/            # Go integration tests
│       └── migration_test.go
│
└── docs/                        # Documentation
    ├── INSTALLATION.md
    ├── CONFIGURATION.md
    ├── API.md
    ├── DEVELOPMENT.md
    └── TROUBLESHOOTING.md
```

#### 1.2 Migration Strategy from WriteSys

**Step-by-step file mapping:**

| WriteSys Location | Manuscript Studio Location | Action |
|------------------|---------------------------|---------|
| `api/main.go` | `cmd/server/main.go` | Copy & refactor |
| `api/handlers_*.go` | `api/handlers/*.go` | Split into separate files |
| `api/middleware.go` | `api/middleware/*.go` | Split by concern |
| `internal/database/` | `internal/database/` | Copy as-is |
| `internal/sentence/tokenizer.go` | `internal/sentence/tokenizer.go` | Update to use external segman |
| `internal/senseg/*` | *(not copied)* | Replace with segman library import |
| `cli/writesys/main.go` | `internal/migrations/processor.go` | Extract migration logic |
| `web/*` | `web/*` | Copy & update references |
| `web/js/segmenter.js` | `web/js/segmenter.js` | Keep for client-side (matches segman) |
| `liquibase/*` | `liquibase/*` | Copy as-is |
| `tests/e2e/*` | `tests/e2e/*` | Copy & update |
| `docker-compose.yml` | `docker-compose.yml` | Simplify for development |
| `Dockerfile` | `Dockerfile` | Update paths |
| `.env.example` | `config.example.yaml` | Convert to YAML |

### Phase 2: API Architecture (Revised)

#### 2.1 Core API Structure

```go
// cmd/server/main.go
package main

import (
    "github.com/slackwing/manuscript-studio/internal/config"
    "github.com/slackwing/manuscript-studio/api"
)

func main() {
    // Load configuration
    cfg, err := config.Load()
    if err != nil {
        log.Fatal("Failed to load config:", err)
    }

    // Initialize database
    db, err := database.Connect(cfg.Database)
    if err != nil {
        log.Fatal("Failed to connect to database:", err)
    }

    // Create and start server
    server := api.NewServer(cfg, db)
    log.Fatal(server.Start())
}
```

#### 2.2 API Endpoints (Complete List)

**Public Endpoints** (no auth):
```
GET    /health                      # Health check
GET    /api/version                 # API version info
```

**User Endpoints** (session auth):
```
POST   /api/login                   # Create session
POST   /api/logout                  # Destroy session
GET    /api/session                 # Current session info
GET    /api/users                   # List users (for login dropdown)

# Manuscripts & Migrations
GET    /api/manuscripts             # List accessible manuscripts
GET    /api/migrations              # List migrations for manuscript
GET    /api/migrations/latest       # Get latest migration
GET    /api/migrations/{id}         # Get specific migration
GET    /api/manuscripts/content     # Get manuscript content for commit

# Annotations
GET    /api/annotations             # List annotations for migration
POST   /api/annotations             # Create annotation
PUT    /api/annotations/{id}        # Update annotation
PUT    /api/annotations/{id}/reorder # Reorder annotation
DELETE /api/annotations/{id}        # Soft delete annotation

# Tags
GET    /api/tags                    # List all tags
GET    /api/annotations/{id}/tags   # Get annotation tags
POST   /api/annotations/{id}/tags   # Add tag to annotation
DELETE /api/annotations/{id}/tags/{tag_id} # Remove tag
```

**Admin Endpoints** (system token):
```
POST   /api/admin/webhook           # GitHub webhook receiver
POST   /api/admin/sync              # Manual sync trigger
GET    /api/admin/status            # Migration status & logs
POST   /api/admin/migrate           # Force migration of specific commit
```

#### 2.3 Authentication Middleware

```go
// api/middleware/auth.go
package middleware

// UserAuth - validates session cookie
func UserAuth(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        session, err := validateSession(r)
        if err != nil {
            http.Error(w, "Unauthorized", http.StatusUnauthorized)
            return
        }
        ctx := context.WithValue(r.Context(), "user", session.User)
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// SystemAuth - validates bearer token for admin operations
func SystemAuth(cfg *config.Config) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            token := r.Header.Get("Authorization")
            if token != "Bearer " + cfg.Auth.SystemToken {
                http.Error(w, "Forbidden", http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

// WebhookAuth - validates GitHub HMAC signature
func WebhookAuth(secret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            signature := r.Header.Get("X-Hub-Signature-256")
            body, _ := io.ReadAll(r.Body)
            r.Body = io.NopCloser(bytes.NewReader(body))

            if !validateGitHubSignature(body, signature, secret) {
                http.Error(w, "Invalid signature", http.StatusForbidden)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

#### 2.4 Version Validation Middleware

```go
// api/middleware/version.go
package middleware

// ValidateVersion ensures user is working with latest manuscript
func ValidateVersion(db *pgx.Pool) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            commitHash := r.URL.Query().Get("commit_hash")
            if commitHash == "" {
                // Extract from path for routes like /api/annotations/{commit_hash}
                commitHash = chi.URLParam(r, "commit_hash")
            }

            if commitHash != "" {
                latest, err := getLatestCommit(db)
                if err == nil && commitHash != latest {
                    http.Error(w, `{"error": "Manuscript has been updated. Please refresh the page."}`,
                              http.StatusConflict)
                    return
                }
            }
            next.ServeHTTP(w, r)
        })
    }
}
```

### Phase 3: Authentication System

#### 3.1 Token Types
```go
type AuthLevel int
const (
    AuthLevelPublic AuthLevel = iota
    AuthLevelUser            // Regular users
    AuthLevelSystem          // System/admin operations
)
```

#### 3.2 Middleware Stack
```go
// Public endpoints (health check)
router.Get("/health", handlers.Health)

// User-authenticated endpoints
router.Group(func(r chi.Router) {
    r.Use(middleware.UserAuth)
    r.Get("/api/annotations/*", handlers.GetAnnotations)
})

// System-authenticated endpoints
router.Group(func(r chi.Router) {
    r.Use(middleware.SystemAuth)
    r.Post("/api/admin/webhook", handlers.GitHubWebhook)
})
```

### Phase 3: Configuration System

#### 3.1 Configuration File Format
Location: `~/.config/manuscript-studio/config.yaml`

```yaml
# Manuscript Studio Configuration
version: 1.0

# Database Connection (GCP Managed PostgreSQL)
database:
  host: "10.x.x.x"  # Private IP of GCP PostgreSQL
  port: 5432
  name: "manuscript_studio"
  user: "manuscript_user"
  password: "your-secure-password-here"

# Authentication
auth:
  system_token: "generated-secure-token-here"  # For admin endpoints
  session_secret: "random-secret-for-sessions"  # For cookie signing
  webhook_secret: "github-webhook-secret"       # For GitHub validation

# Paths
paths:
  # Where frontend files go (served by Apache)
  public_dir: "/var/www/html/the-wildfire"

  # Where server files, Docker data, etc. go
  private_dir: "/var/www/manuscript-studio"

  # Where to clone/pull manuscript repositories
  manuscript_repos: "~/.config/manuscript-studio/repos"

# Server
server:
  port: 5001  # Internal port (Apache proxies to this)
  host: "0.0.0.0"
  env: "production"  # or "development"

# Logging
logging:
  directory: "~/.config/manuscript-studio/logs"
  level: "info"  # debug, info, warn, error
  max_age_days: 30
  max_size_mb: 100
  rotate: true

# Manuscripts (multiple supported)
manuscripts:
  - name: "the-wildfire"              # Internal identifier
    title: "The Wildfire"              # Display title
    author: "Andrew Cheong"
    repository:
      url: "https://github.com/slackwing/darkfeather"
      branch: "main"
      path: "16.the-wildfire/the-wildfire.manuscript"
      auth_token: "github_pat_xxxxx"  # Can be shared or per-manuscript
    webhook_secret: "per-manuscript-secret"  # Optional per-manuscript webhook

  # Example of second manuscript (commented out)
  # - name: "another-book"
  #   title: "Another Book"
  #   author: "Andrew Cheong"
  #   repository:
  #     url: "https://github.com/slackwing/another-repo"
  #     branch: "main"
  #     path: "manuscript.md"
  #     auth_token: "github_pat_yyyyy"
  #   webhook_secret: "different-secret"

# Migration Settings
migrations:
  lock_during_migration: true
  backup_before_migration: false  # Rely on GCP backups
  queue_annotations: true         # Queue annotations during migration
```

### Phase 4: Installation Script

#### 4.1 One-Liner Installation
```bash
curl -sSL https://raw.githubusercontent.com/slackwing/manuscript-studio/main/install.sh | bash
```

#### 4.2 Installation Script (`install.sh`)

```bash
#!/usr/bin/env bash
set -euo pipefail

VERSION="${1:-latest}"
CONFIG_DIR="$HOME/.config/manuscript-studio"
CONFIG_FILE="$CONFIG_DIR/config.yaml"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for config file
if [[ ! -f "$CONFIG_FILE" ]]; then
    log_info "Creating configuration template at $CONFIG_FILE"
    mkdir -p "$CONFIG_DIR"
    mkdir -p "$CONFIG_DIR/logs"
    mkdir -p "$CONFIG_DIR/repos"

    # Download template
    curl -sSL https://raw.githubusercontent.com/slackwing/manuscript-studio/main/config.example.yaml \
        -o "$CONFIG_FILE"

    log_warn "Please edit $CONFIG_FILE with your settings and run this script again"
    exit 0
fi

# Validate configuration
log_info "Validating configuration..."

# Check dependencies
check_dependency() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 is not installed. Please install it and try again."
        exit 1
    fi
}

check_dependency docker
check_dependency git
check_dependency psql

# Parse config (simple approach using grep/sed)
DB_HOST=$(grep "host:" "$CONFIG_FILE" | head -1 | sed 's/.*host: *"\(.*\)"/\1/')
DB_USER=$(grep "user:" "$CONFIG_FILE" | head -1 | sed 's/.*user: *"\(.*\)"/\1/')
PUBLIC_DIR=$(grep "public_dir:" "$CONFIG_FILE" | sed 's/.*public_dir: *"\(.*\)"/\1/')
PRIVATE_DIR=$(grep "private_dir:" "$CONFIG_FILE" | sed 's/.*private_dir: *"\(.*\)"/\1/')

# Validate paths exist
if [[ ! -d "$PUBLIC_DIR" ]]; then
    log_error "Public directory does not exist: $PUBLIC_DIR"
    log_error "Please create it manually: mkdir -p $PUBLIC_DIR"
    exit 1
fi

if [[ ! -d "$PRIVATE_DIR" ]]; then
    log_error "Private directory does not exist: $PRIVATE_DIR"
    log_error "Please create it manually: mkdir -p $PRIVATE_DIR"
    exit 1
fi

# Test database connection
log_info "Testing database connection..."
DB_PASS=$(grep "password:" "$CONFIG_FILE" | head -1 | sed 's/.*password: *"\(.*\)"/\1/')
DB_NAME=$(grep "name:" "$CONFIG_FILE" | head -1 | sed 's/.*name: *"\(.*\)"/\1/')

if ! PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &>/dev/null; then
    log_error "Cannot connect to database. Please check your configuration."
    exit 1
fi

# Clone/pull repository
REPO_URL=$(grep "url:" "$CONFIG_FILE" | sed 's/.*url: *"\(.*\)"/\1/')
REPO_DIR="$CONFIG_DIR/repos/manuscript"

if [[ ! -d "$REPO_DIR" ]]; then
    log_info "Cloning manuscript repository..."
    git clone "$REPO_URL" "$REPO_DIR"
else
    log_info "Updating manuscript repository..."
    cd "$REPO_DIR" && git pull
fi

# Download and build Docker image
log_info "Building Manuscript Studio Docker image..."
cd "$PRIVATE_DIR"

if [[ "$VERSION" == "latest" ]]; then
    git clone https://github.com/slackwing/manuscript-studio.git manuscript-studio-src || \
        (cd manuscript-studio-src && git pull)
else
    # Specific version
    curl -sSL "https://github.com/slackwing/manuscript-studio/archive/refs/tags/$VERSION.tar.gz" | \
        tar xz -C "$PRIVATE_DIR"
    mv "manuscript-studio-$VERSION" manuscript-studio-src
fi

cd manuscript-studio-src

# Run Liquibase migrations
log_info "Running database migrations..."
docker build -f Dockerfile.liquibase -t manuscript-studio-liquibase .
docker run --rm \
    --network host \
    -e POSTGRES_HOST="$DB_HOST" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASS" \
    -e POSTGRES_DB="$DB_NAME" \
    manuscript-studio-liquibase

# Build main application
docker build -t manuscript-studio:latest .

# Check if already running
if docker ps | grep -q manuscript-studio-server; then
    log_info "Stopping existing Manuscript Studio server..."
    docker stop manuscript-studio-server
    docker rm manuscript-studio-server
fi

# Start server
log_info "Starting Manuscript Studio server..."
docker run -d \
    --name manuscript-studio-server \
    --restart unless-stopped \
    -p 127.0.0.1:5001:5001 \
    -v "$CONFIG_FILE:/config/config.yaml:ro" \
    -v "$CONFIG_DIR/logs:/logs" \
    -v "$CONFIG_DIR/repos:/repos" \
    -v "$PUBLIC_DIR:/public" \
    manuscript-studio:latest

# Verify server is running
sleep 3
if curl -s http://localhost:5001/health | grep -q "healthy"; then
    log_info "Manuscript Studio server is running!"
else
    log_error "Server failed to start. Check logs: docker logs manuscript-studio-server"
    exit 1
fi

# Show Apache configuration
log_info "Server installed successfully!"
echo ""
log_warn "Configure Apache to proxy requests to Manuscript Studio:"
echo ""
cat << EOF
<VirtualHost *:80>
    ServerName yourdomain.com

    # Proxy all requests to PageNotes
    ProxyPass / http://localhost:5001/
    ProxyPassReverse / http://localhost:5001/

    # WebSocket/SSE support for real-time updates
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://localhost:5001/\$1" [P,L]

    ProxyPass /api/realtime/updates http://localhost:5001/api/realtime/updates
    ProxyPassReverse /api/realtime/updates http://localhost:5001/api/realtime/updates
</VirtualHost>
EOF
echo ""
log_info "Then reload Apache: sudo systemctl reload apache2"
```

### Phase 5: Migration Logic Integration

#### 5.1 API-Based Migration Flow

```go
// api/migrations/processor.go
package migrations

type Processor struct {
    db     *pgx.Pool
    repo   *GitRepository
    config *Config
}

func (p *Processor) ProcessWebhook(payload WebhookPayload) error {
    // 1. Validate webhook signature
    if !validateSignature(payload, p.config.WebhookSecret) {
        return ErrInvalidSignature
    }

    // 2. Check if manuscript file was changed
    if !containsManuscriptChange(payload.Commits) {
        return nil // Nothing to do
    }

    // 3. Pull latest from repository
    if err := p.repo.Pull(); err != nil {
        return fmt.Errorf("pull failed: %w", err)
    }

    // 4. Lock manuscript for migration
    if err := p.lockManuscript(); err != nil {
        return err
    }
    defer p.unlockManuscript()

    // 5. Run migration
    result, err := p.migrate()
    if err != nil {
        p.notifyClients(MigrationFailed, err.Error())
        return err
    }

    // 6. Store new migration commit as latest
    // Frontend will detect version mismatch on next API call

    return nil
}

func (p *Processor) migrate() (*MigrationResult, error) {
    // This is the core logic from current CLI
    // Modified to work within API context

    // Begin transaction
    tx, err := p.db.Begin(context.Background())
    if err != nil {
        return nil, err
    }
    defer tx.Rollback()

    // ... migration logic here ...

    // Commit transaction
    if err := tx.Commit(); err != nil {
        return nil, err
    }

    return result, nil
}
```


## Implementation Steps

### Step 1: Create Manuscript Studio Repository Structure
1. Repository already exists at `~/src/manuscript-studio`
2. Create directory structure as outlined in Phase 1
3. Set up go.mod with module path `github.com/slackwing/manuscript-studio`
4. Keep existing LICENSE (do not overwrite)
5. Create initial README.md

### Step 2: Migrate Core Components from WriteSys
**Copy and refactor in order:**

1. **Database & Sentence Logic** (unchanged):
   - Copy `internal/database/*` → `internal/database/*`
   - Copy `internal/sentence/*` → `internal/sentence/*`

2. **Migration Logic** (extract from CLI):
   - Extract migration functions from `cli/writesys/main.go`
   - Create `internal/migrations/processor.go`
   - Create `internal/migrations/differ.go`
   - Create `internal/migrations/git.go`
   - Add segman dependency: `go get github.com/slackwing/segman`

3. **API Structure** (reorganize):
   - Split `api/main.go` → `cmd/server/main.go` + `api/router.go`
   - Split handlers into separate files in `api/handlers/`
   - Split middleware into `api/middleware/`
   - Add new `api/handlers/admin.go` for webhook/sync

4. **Frontend** (minimal changes):
   - Copy entire `web/` directory
   - Update API endpoints if needed
   - Add version checking on API errors

5. **Database Migrations**:
   - Copy `liquibase/*` → `migrations/*`
   - Update paths in changelog files

### Step 3: Implement New Features
1. **System Token Authentication**:
   - Create `api/middleware/admin.go`
   - Implement bearer token validation

2. **GitHub Webhook Handler**:
   - Create webhook endpoint in `api/handlers/admin.go`
   - Implement HMAC signature validation
   - Trigger migration on push

3. **Version Validation**:
   - Create `api/middleware/version.go`
   - Check commit hash on annotation operations
   - Return 409 Conflict if outdated

4. **Configuration System**:
   - Create `internal/config/config.go`
   - Parse YAML configuration
   - Provide defaults

### Step 4: Docker & Installation
1. Create multi-stage Dockerfile
2. Create docker-compose.yml for development
3. Write install.sh script
4. Create config.example.yaml template
5. Test installation flow end-to-end

### Step 5: Documentation
1. **README.md**: Overview, features, quick start
2. **docs/INSTALLATION.md**: Detailed setup guide
3. **docs/CONFIGURATION.md**: All config options explained
4. **docs/API.md**: Complete API reference
5. **docs/DEVELOPMENT.md**: Contributing guide
6. **docs/TROUBLESHOOTING.md**: Common issues & solutions

### Step 6: Testing & Deployment
1. Test locally with docker-compose
2. Test installation script on clean VM
3. Set up GCP PostgreSQL instance
4. Deploy to GCP VM
5. Configure GitHub webhook
6. Verify end-to-end flow

## Risk Mitigation

### Data Safety
- **Risk**: Data loss during migration
- **Mitigation**:
  - Transaction-wrapped migrations
  - Backup before each migration
  - Ability to rollback migrations

### Performance
- **Risk**: Large manuscripts causing timeout
- **Mitigation**:
  - Chunked processing for large files
  - Background job queue for migrations
  - Progress indicators for users

### Security
- **Risk**: Unauthorized access to admin endpoints
- **Mitigation**:
  - Strong system token generation
  - Webhook signature validation
  - Rate limiting on all endpoints
  - Audit logging for admin actions

### Availability
- **Risk**: Server downtime during updates
- **Mitigation**:
  - Docker health checks
  - Automatic restart on failure
  - Blue-green deployment capability
  - Manuscript locking during migration only

## Success Criteria

1. **Functional Requirements**
   - [ ] Push to GitHub triggers automatic migration via webhook
   - [ ] Version validation prevents working on stale manuscripts
   - [ ] All existing features continue to work
   - [ ] Installation completes in under 5 minutes

2. **Non-Functional Requirements**
   - [ ] Migration completes in < 30 seconds for 500-page manuscript
   - [ ] Server uses < 512MB RAM under normal load
   - [ ] Zero data loss during migrations
   - [ ] Works on any Linux/macOS with Docker installed

3. **Open Source Standards**
   - [ ] Professional README with badges, screenshots
   - [ ] Clear installation instructions
   - [ ] Comprehensive documentation
   - [ ] Example configuration file
   - [ ] MIT or Apache 2.0 license
   - [ ] GitHub Actions for CI/CD
   - [ ] Semantic versioning with tags

4. **User Experience**
   - [ ] One-line installation command
   - [ ] Clear error messages with recovery instructions
   - [ ] No manual intervention for normal operations
   - [ ] Same command updates to latest version

## Design Decisions (Based on User Feedback)

1. **Backup Strategy**: Rely on GCP PostgreSQL automated backups
2. **Multi-Manuscript Support**: YES - configuration supports multiple manuscripts
3. **Collaborative Editing**: Queue annotations by creation time during migration
4. **Version Rollback**: Forward-only (no rollback support)
5. **Monitoring**: No metrics for initial version

### Multi-Manuscript Implications

Supporting multiple manuscripts affects:

1. **Database Schema**: Already supports via `manuscript` table
2. **API Endpoints**: Need manuscript identifier in URLs:
   - `/api/manuscripts/{manuscript_name}/migrations`
   - `/api/manuscripts/{manuscript_name}/annotations`
3. **Webhook Handling**: Each manuscript can have its own webhook secret
4. **Frontend**: Manuscript selector on login or in UI
5. **Migration Processing**: Queue per manuscript, process in parallel
6. **User Access**: Existing `manuscript_access` table controls permissions

## Key Differences from Original Plan

1. **Name**: PageNotes → **Manuscript Studio** (better branding)
2. **Repository**: Building fresh in new repo, copying from WriteSys (read-only)
3. **Real-time**: Removed SSE/WebSocket complexity, using version validation instead
4. **Authentication**: Clarified token types (static system token vs session cookies)
5. **Open Source**: Designed as a professional open-source project from the start

## Conclusion

This plan transforms WriteSys into a production-ready **Manuscript Studio** system with:
- **Professional open-source structure** ready for community adoption
- **Simplified deployment** via Docker and one-line installer
- **Automated workflows** via GitHub webhooks
- **Enhanced security** with separate system/user authentication
- **Better maintainability** by consolidating migration logic in API
- **Maximum portability** works on any Docker-enabled system

The architecture prioritizes **simplicity** (no real-time complexity), **safety** (GCP PostgreSQL), and **professional standards** (proper documentation, testing, CI/CD) while maintaining all current functionality and preparing for future enhancements.