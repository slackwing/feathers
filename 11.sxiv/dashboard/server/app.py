#!/usr/bin/env python3
"""
SXIVA Dashboard API

Simple Flask API for syncing .sxiva data to TimescaleDB.
"""

import os
from datetime import datetime
from flask import Flask, request, jsonify
import psycopg2
from psycopg2.extras import Json

app = Flask(__name__)

# Configuration from environment variables
DB_HOST = os.getenv('DB_HOST', 'timescaledb')
DB_PORT = os.getenv('DB_PORT', '5432')
DB_NAME = os.getenv('DB_NAME', 'sxiva_stats')
DB_USER = os.getenv('DB_USER', 'sxiva_user')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'changeme123')
API_TOKEN = os.getenv('API_TOKEN', 'changeme-set-a-real-token')

def get_db_connection():
    """Create a database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def check_auth():
    """Verify the API token"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return False

    # Expect: "Bearer <token>"
    parts = auth_header.split()
    if len(parts) != 2 or parts[0].lower() != 'bearer':
        return False

    return parts[1] == API_TOKEN

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint (no auth required)"""
    try:
        conn = get_db_connection()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

@app.route('/api/sync/daily', methods=['POST'])
def sync_daily():
    """
    Sync daily data from a .sxiva file.

    Request body:
    {
        "date": "2025-01-17",
        "day_of_week": "F",
        "category_minutes": {"bkc": 40, "jnl": 32, "life": 48},
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
    """
    # Check authentication
    if not check_auth():
        return jsonify({'error': 'Unauthorized'}), 401

    # Parse request body
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Invalid JSON'}), 400

    # Validate required fields
    if 'date' not in data:
        return jsonify({'error': 'Missing required field: date'}), 400

    if 'day_of_week' not in data:
        return jsonify({'error': 'Missing required field: day_of_week'}), 400

    try:
        # Upsert (INSERT ... ON CONFLICT UPDATE) to replace existing data
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            INSERT INTO daily_summary (
                date, day_of_week, category_minutes,
                sleep_score, sleep_hours,
                dep_min, dep_max, dep_avg,
                dist, soc, out, exe, alc, xmx, wea,
                created_at, updated_at
            ) VALUES (
                %(date)s, %(day_of_week)s, %(category_minutes)s,
                %(sleep_score)s, %(sleep_hours)s,
                %(dep_min)s, %(dep_max)s, %(dep_avg)s,
                %(dist)s, %(soc)s, %(out)s, %(exe)s, %(alc)s, %(xmx)s, %(wea)s,
                NOW(), NOW()
            )
            ON CONFLICT (date) DO UPDATE SET
                day_of_week = EXCLUDED.day_of_week,
                category_minutes = EXCLUDED.category_minutes,
                sleep_score = EXCLUDED.sleep_score,
                sleep_hours = EXCLUDED.sleep_hours,
                dep_min = EXCLUDED.dep_min,
                dep_max = EXCLUDED.dep_max,
                dep_avg = EXCLUDED.dep_avg,
                dist = EXCLUDED.dist,
                soc = EXCLUDED.soc,
                out = EXCLUDED.out,
                exe = EXCLUDED.exe,
                alc = EXCLUDED.alc,
                xmx = EXCLUDED.xmx,
                wea = EXCLUDED.wea,
                updated_at = NOW()
        """, {
            'date': data['date'],
            'day_of_week': data['day_of_week'],
            'category_minutes': Json(data.get('category_minutes', {})),
            'sleep_score': data.get('sleep_score'),
            'sleep_hours': data.get('sleep_hours'),
            'dep_min': data.get('dep_min'),
            'dep_max': data.get('dep_max'),
            'dep_avg': data.get('dep_avg'),
            'dist': data.get('dist'),
            'soc': data.get('soc'),
            'out': data.get('out'),
            'exe': data.get('exe'),
            'alc': data.get('alc'),
            'xmx': data.get('xmx'),
            'wea': data.get('wea')
        })

        # Update sync metadata with current timestamp
        cur.execute("""
            UPDATE sync_metadata
            SET last_sync_timestamp = NOW(),
                last_sync_file_count = last_sync_file_count + 1
            WHERE id = 1
        """)

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            'status': 'success',
            'date': data['date'],
            'message': 'Data synced successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/status/last-sync', methods=['GET'])
def last_sync():
    """Get the last sync timestamp from sync_metadata table"""
    # Check authentication
    if not check_auth():
        return jsonify({'error': 'Unauthorized'}), 401

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT last_sync_timestamp, last_sync_file_count
            FROM sync_metadata
            WHERE id = 1
        """)

        row = cur.fetchone()
        cur.close()
        conn.close()

        if row:
            return jsonify({
                'last_sync_timestamp': row[0].isoformat(),
                'last_sync_file_count': row[1]
            }), 200
        else:
            return jsonify({
                'last_sync_timestamp': None,
                'message': 'No sync metadata found'
            }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/category-rolling-sum', methods=['GET'])
def category_rolling_sum():
    """
    Get rolling sum of category minutes with exponential weighting.

    Query parameters:
    - categories: Comma-separated category codes (e.g., "wf,wr,bkc")
    - days: Rolling window size (default: 7)
    - limit: Number of recent days to return (default: 30)
    - lambda: Decay parameter for exponential weighting (default: 0.2)

    Returns JSON with data array containing date, raw_sum, and weighted_sum
    """
    # Check authentication
    if not check_auth():
        return jsonify({'error': 'Unauthorized'}), 401

    # Parse query parameters
    categories_str = request.args.get('categories', '')
    if not categories_str:
        return jsonify({'error': 'Missing required parameter: categories'}), 400

    categories = [cat.strip() for cat in categories_str.split(',')]

    try:
        window_days = int(request.args.get('days', 7))
        limit = int(request.args.get('limit', 30))
        decay_lambda = float(request.args.get('lambda', 0.2))
    except ValueError:
        return jsonify({'error': 'Invalid numeric parameter'}), 400

    if window_days < 1 or limit < 1:
        return jsonify({'error': 'days and limit must be positive integers'}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Build SQL query with window functions
        # For each date, calculate:
        # 1. matched categories: raw_sum and weighted_sum
        # 2. unmatched categories: raw_sum only
        # 3. total: raw_sum
        cur.execute("""
            WITH category_breakdowns AS (
                -- Split category minutes into matched and unmatched
                SELECT
                    date,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                            WHERE key = ANY(%(categories)s)
                        ),
                        0
                    ) AS matched_minutes,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                            WHERE key != ALL(%(categories)s)
                        ),
                        0
                    ) AS unmatched_minutes,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                        ),
                        0
                    ) AS total_minutes
                FROM daily_summary
                ORDER BY date
            ),
            rolling_calcs AS (
                -- Calculate raw sums using window functions
                SELECT
                    date,
                    matched_minutes,
                    unmatched_minutes,
                    total_minutes,
                    SUM(matched_minutes) OVER (
                        ORDER BY date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS matched_raw,
                    SUM(unmatched_minutes) OVER (
                        ORDER BY date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS unmatched_raw,
                    SUM(total_minutes) OVER (
                        ORDER BY date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS total_raw
                FROM category_breakdowns
            )
            SELECT
                date,
                matched_raw,
                ROUND(
                    (
                        -- Calculate weighted sum for matched categories only
                        -- Normalized so that equal daily values give same total as raw_sum
                        SELECT
                            SUM(cb.matched_minutes * EXP(-%(decay_lambda)s * (rc.date - cb.date))) *
                            (%(window_days)s::float / SUM(EXP(-%(decay_lambda)s * (rc.date - cb.date))))
                        FROM category_breakdowns cb
                        WHERE cb.date <= rc.date
                          AND cb.date > rc.date - INTERVAL '1 day' * %(window_days)s
                    )::numeric,
                    1
                ) AS matched_weighted,
                unmatched_raw,
                total_raw
            FROM rolling_calcs rc
            ORDER BY date DESC
            LIMIT %(limit)s
        """, {
            'categories': categories,
            'window_days': window_days,
            'limit': limit,
            'decay_lambda': decay_lambda
        })

        rows = cur.fetchall()

        # Get list of all categories and split into matched/unmatched
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT jsonb_object_keys(category_minutes) as category
            FROM daily_summary
            ORDER BY category
        """)
        all_categories = [row[0] for row in cur.fetchall()]
        matched_categories = [cat for cat in all_categories if cat in categories]
        unmatched_categories = [cat for cat in all_categories if cat not in categories]

        cur.close()
        conn.close()

        # Format response
        data = [
            {
                'date': row[0].isoformat(),
                'matched_raw': int(row[1]) if row[1] is not None else 0,
                'matched_weighted': float(row[2]) if row[2] is not None else 0.0,
                'unmatched_raw': int(row[3]) if row[3] is not None else 0,
                'total_raw': int(row[4]) if row[4] is not None else 0
            }
            for row in reversed(rows)  # Reverse to get chronological order
        ]

        return jsonify({
            'data': data,
            'matched_categories': matched_categories,
            'unmatched_categories': unmatched_categories,
            'window_days': window_days,
            'decay_lambda': decay_lambda
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run Flask development server
    app.run(host='0.0.0.0', port=5000, debug=True)
