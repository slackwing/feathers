package database

import (
	"context"
	"fmt"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB wraps a database connection pool
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB creates a new database connection
func NewDB(ctx context.Context) (*DB, error) {
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%s/%s",
		getEnv("POSTGRES_USER", "writesys_user"),
		getEnv("POSTGRES_PASSWORD", "changeme_secure_password"),
		getEnv("POSTGRES_HOST", "127.0.0.1"),
		getEnv("POSTGRES_PORT", "5432"),
		getEnv("POSTGRES_DB", "writesys"),
	)

	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("unable to connect to database: %w", err)
	}

	return &DB{Pool: pool}, nil
}

// Close closes the database connection
func (db *DB) Close() {
	db.Pool.Close()
}

func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
