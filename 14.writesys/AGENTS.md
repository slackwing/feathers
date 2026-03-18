# WriteSys - Project Guide for AI Agents

## Project Overview

WriteSys is a book annotation system that tracks highlights, tags, and tasks on sentences in a Markdown manuscript. Annotations intelligently migrate as the text evolves through git commits.

## Key Resources

**📋 Primary Design Document:** [PLAN.md](./PLAN.md)

The PLAN.md file contains:
- Complete system architecture
- Database schema with all tables
- Sentence processing and migration algorithms
- Git workflow and commit processing
- Web UI design and interaction patterns
- Implementation milestones
- Edge cases and design decisions

**Always read PLAN.md first** when working on this project.

## Quick Context

- **Tech Stack:** Go (backend/CLI), PostgreSQL, Liquibase, Plain HTML/CSS/JS (frontend)
- **Pattern Reference:** `/home/slackwing/src/worktree-writesys/11.sxiv/dashboard/docker/` (Docker + Liquibase setup)
- **Phase:** Currently in Phase 1 (data structures, migration algorithm, basic UI)
- **Database:** Postgres in Docker, following sxiva project patterns

## Core Principles

1. **Markdown in git is the source of truth** - annotations are a layer on top
2. **Sentences get new IDs when edited** - no false lineage tracking
3. **Heuristic migration with confidence scores** - user reviews/fixes manually
4. **Append-only annotation history** - never delete, only soft-delete
5. **Content-addressed sentence storage** - deduplicate text across commits

## Common Tasks

### Working on the CLI (`writesys` command)
- See: PLAN.md → "Sentence Processing Algorithm" and "Git Processing Flow"
- Code location: `cmd/writesys/`

### Working on Migration Algorithm
- See: PLAN.md → "Migration Algorithm (Commit A → Commit B)"
- Code location: `internal/sentence/matcher.go`

### Working on Database Schema
- See: PLAN.md → "Data Model" section
- Liquibase changelogs: `docker/liquibase/changelog/`

### Working on Web UI
- See: PLAN.md → "Web UI Design" section
- Code location: `web/`

### Working on API Endpoints
- See: PLAN.md → "Rendering Pipeline" (API endpoints listed)
- Code location: `api/`

## Development Workflow

```bash
# Start database
cd docker && docker compose up -d

# Run migrations
docker compose --profile migrate up liquibase

# Build CLI
cd ../cmd/writesys && go build -o writesys

# Process a commit
./writesys process --file ../../manuscripts/the-wildfire.md

# Start API server
cd ../api && go run main.go
```

## Architecture at a Glance

```
Markdown (git) → writesys CLI → Postgres DB ← API Server ← Web UI
                      ↓
              Sentence tokenizer
              ID generator
              Migration algorithm
```

## Important Design Decisions

1. **Why no `sentence_anchor`?** We don't track sentence identity across commits. Annotations migrate heuristically, user fixes manually.

2. **Why 8 hex chars in IDs?** 4.3 billion possible values = collision-proof without runtime checks. Deterministic from hash (text + ordinal + commit).

3. **Why no separate `sentence_text` table?** Text stored directly in `sentence` table. Space savings (~8%) not worth the complexity. ~304MB for full novel lifecycle is acceptable.

4. **Why store sentence ID array uncompressed?** Acts as integrity check and backup. Human-readable for debugging. JSONB in Postgres is efficient enough (~100KB for 7,500 sentences).

5. **Why NOT store markdown in database?** Git already stores it. Use `git show <hash>:path` to retrieve any commit's content.

6. **Why tokenizer parity?** Frontend uses sequential DOM wrapping (fast, robust). Requires Go and JavaScript tokenizers to split sentences identically. One-time porting effort with high payoff.

7. **Why confidence scores?** Makes low-quality migrations visible in UI so user knows to review.

## Phase 1 Boundaries

**In scope:**
- Local development (Docker)
- Single user ("andrew")
- Desktop UI only
- Basic annotations (highlights, tags, tasks)

**Out of scope:**
- Multi-user auth
- Mobile optimization
- Real-time collaboration
- Search/filter/export
- AI features

See PLAN.md → "Phase 1: Scope & Goals" for complete list.

## Key Files to Read

1. **PLAN.md** - Complete design (READ THIS FIRST)
2. `docker/docker-compose.yml` - Infrastructure setup
3. `docker/liquibase/changelog/db.changelog-master.xml` - Database schema evolution
4. `cmd/writesys/main.go` - CLI entry point
5. `internal/sentence/tokenizer.go` - Sentence splitting logic
6. `api/handlers.go` - API endpoints

## External References

- **Pattern source:** `/home/slackwing/src/worktree-writesys/11.sxiv/` (sxiva dashboard Docker/Liquibase patterns)
- **Sentence splitting:** `github.com/jdkato/prose` (Go NLP library)
- **Fuzzy matching:** Levenshtein distance at word level

## Questions?

If anything is unclear or conflicts with PLAN.md, **ask the user** rather than making assumptions. The design is intentionally opinionated to avoid scope creep.

---

**Last Updated:** 2024-03-18
