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
                dist, soc, out, exe, alc, xmx, wea, meet,
                created_at, updated_at
            ) VALUES (
                %(date)s, %(day_of_week)s, %(category_minutes)s,
                %(sleep_score)s, %(sleep_hours)s,
                %(dep_min)s, %(dep_max)s, %(dep_avg)s,
                %(dist)s, %(soc)s, %(out)s, %(exe)s, %(alc)s, %(xmx)s, %(wea)s, %(meet)s,
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
                meet = EXCLUDED.meet,
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
            'wea': data.get('wea'),
            'meet': data.get('meet')
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

@app.route('/category-rolling-sum', methods=['GET'])
def category_rolling_sum():
    """
    Get rolling sum of category minutes with exponential weighting for multiple groups.

    Query parameters:
    - hobby: Comma-separated hobby category codes (e.g., "wf,wr,bkc")
    - work: Comma-separated work category codes (e.g., "sp")
    - days: Rolling window size (default: 7)
    - limit: Number of recent days to return (default: 30)
    - lambda: Decay parameter for exponential weighting (default: 0.2)

    Returns JSON with separate sums for hobby, work, and other categories

    Note: This endpoint is public (no auth required) for read-only access
    """
    # No authentication required for dashboard queries

    # Parse query parameters
    hobby_str = request.args.get('hobby', '')
    work_str = request.args.get('work', '')

    if not hobby_str and not work_str:
        return jsonify({'error': 'At least one of hobby or work parameters required'}), 400

    hobby_categories = [cat.strip() for cat in hobby_str.split(',') if cat.strip()] if hobby_str else []
    work_categories = [cat.strip() for cat in work_str.split(',') if cat.strip()] if work_str else []
    all_specified = hobby_categories + work_categories

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

        # Build SQL query with window functions for hobby, work, and other
        cur.execute("""
            WITH category_breakdowns AS (
                -- Split category minutes into hobby, work, and other
                SELECT
                    date,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                            WHERE key = ANY(%(hobby_categories)s)
                        ),
                        0
                    ) AS hobby_minutes,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                            WHERE key = ANY(%(work_categories)s)
                        ),
                        0
                    ) AS work_minutes,
                    COALESCE(
                        (
                            SELECT SUM((value)::int)
                            FROM jsonb_each_text(category_minutes)
                            WHERE key != ALL(%(all_specified)s)
                        ),
                        0
                    ) AS other_minutes,
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
            weekdays_only AS (
                -- Filter to weekdays only for work calculation
                SELECT
                    date,
                    work_minutes,
                    ROW_NUMBER() OVER (ORDER BY date DESC) as recency_rank
                FROM category_breakdowns
                WHERE EXTRACT(DOW FROM date) BETWEEN 1 AND 5  -- Monday to Friday
            ),
            rolling_calcs AS (
                -- Calculate raw sums using window functions
                SELECT
                    cb.date,
                    cb.hobby_minutes,
                    cb.work_minutes,
                    cb.other_minutes,
                    cb.total_minutes,
                    EXTRACT(DOW FROM cb.date) AS day_of_week,
                    SUM(cb.hobby_minutes) OVER (
                        ORDER BY cb.date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS hobby_raw,
                    -- Work: sum over last 5 weekdays only (subquery with explicit columns)
                    (
                        SELECT COALESCE(SUM(work_minutes), 0)
                        FROM (
                            SELECT work_minutes
                            FROM weekdays_only
                            WHERE date <= cb.date
                            ORDER BY date DESC
                            LIMIT 5
                        ) AS last_5_weekdays
                    ) AS work_raw,
                    SUM(cb.other_minutes) OVER (
                        ORDER BY cb.date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS other_raw,
                    SUM(cb.total_minutes) OVER (
                        ORDER BY cb.date
                        ROWS BETWEEN %(window_days)s - 1 PRECEDING AND CURRENT ROW
                    ) AS total_raw
                FROM category_breakdowns cb
            )
            SELECT
                date,
                hobby_raw,
                ROUND(
                    (
                        -- Calculate weighted sum for hobby categories
                        SELECT
                            SUM(cb.hobby_minutes * EXP(-%(decay_lambda)s * (rc.date - cb.date))) *
                            (%(window_days)s::float / SUM(EXP(-%(decay_lambda)s * (rc.date - cb.date))))
                        FROM category_breakdowns cb
                        WHERE cb.date <= rc.date
                          AND cb.date > rc.date - INTERVAL '1 day' * %(window_days)s
                    )::numeric,
                    1
                ) AS hobby_weighted,
                work_raw,
                ROUND(
                    COALESCE(
                        (
                            -- Calculate weighted sum for work categories (weekdays only, last 5)
                            SELECT
                                SUM(work_minutes * EXP(-%(decay_lambda)s * (rc.date - date))) *
                                (5.0 / NULLIF(SUM(EXP(-%(decay_lambda)s * (rc.date - date))), 0))
                            FROM (
                                SELECT date, work_minutes
                                FROM weekdays_only
                                WHERE date <= rc.date
                                ORDER BY date DESC
                                LIMIT 5
                            ) AS last_5_weekdays_weighted
                        ),
                        0
                    )::numeric,
                    1
                ) AS work_weighted,
                other_raw,
                total_raw
            FROM rolling_calcs rc
            ORDER BY date DESC
            LIMIT %(limit)s
        """, {
            'hobby_categories': hobby_categories,
            'work_categories': work_categories,
            'all_specified': all_specified,
            'window_days': window_days,
            'limit': limit,
            'decay_lambda': decay_lambda
        })

        rows = cur.fetchall()

        # Get list of all categories and split into hobby/work/other
        cur = conn.cursor()
        cur.execute("""
            SELECT DISTINCT jsonb_object_keys(category_minutes) as category
            FROM daily_summary
            ORDER BY category
        """)
        all_categories = [row[0] for row in cur.fetchall()]
        hobby_cats = [cat for cat in all_categories if cat in hobby_categories]
        work_cats = [cat for cat in all_categories if cat in work_categories]
        other_cats = [cat for cat in all_categories if cat not in all_specified]

        cur.close()
        conn.close()

        # Format response
        data = [
            {
                'date': row[0].isoformat(),
                'hobby_raw': int(row[1]) if row[1] is not None else 0,
                'hobby_weighted': float(row[2]) if row[2] is not None else 0.0,
                'work_raw': int(row[3]) if row[3] is not None else 0,
                'work_weighted': float(row[4]) if row[4] is not None else 0.0,
                'other_raw': int(row[5]) if row[5] is not None else 0,
                'total_raw': int(row[6]) if row[6] is not None else 0
            }
            for row in reversed(rows)  # Reverse to get chronological order
        ]

        return jsonify({
            'data': data,
            'hobby_categories': hobby_cats,
            'work_categories': work_cats,
            'other_categories': other_cats,
            'window_days': window_days,
            'decay_lambda': decay_lambda
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/alcohol-depression', methods=['GET'])
def alcohol_depression():
    """
    Get 7-day and 15-day rolling sum for alcohol, and raw/7-day average for depression.

    Query parameters:
    - limit: Number of recent days to return (default: 60, need extra for 15-day avg)

    Returns JSON with alcohol 7-day sum, 15-day avg, and depression raw and 7-day avg

    Note: This endpoint is public (no auth required) for read-only access
    """
    try:
        limit = int(request.args.get('limit', 60))
    except ValueError:
        return jsonify({'error': 'Invalid numeric parameter'}), 400

    if limit < 1:
        return jsonify({'error': 'limit must be a positive integer'}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Build SQL query with window functions
        cur.execute("""
            WITH rolling_7day AS (
                -- Calculate 7-day rolling sum for alcohol and 7-day average for depression
                -- Keep depression as null when missing (don't coalesce to 0)
                SELECT
                    date,
                    COALESCE(alc, 0) AS alc_value,
                    dep_avg AS dep_raw,
                    SUM(COALESCE(alc, 0)) OVER (
                        ORDER BY date
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) AS alc_7day_sum,
                    AVG(dep_avg) OVER (
                        ORDER BY date
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) AS dep_7day_avg
                FROM daily_summary
                ORDER BY date
            ),
            rolling_15day AS (
                -- Calculate 15-day moving average for alcohol
                SELECT
                    date,
                    alc_value,
                    dep_raw,
                    alc_7day_sum,
                    dep_7day_avg,
                    AVG(alc_7day_sum) OVER (
                        ORDER BY date
                        ROWS BETWEEN 14 PRECEDING AND CURRENT ROW
                    ) AS alc_15day_avg
                FROM rolling_7day
            )
            SELECT
                date,
                alc_7day_sum,
                alc_15day_avg,
                dep_raw,
                dep_7day_avg
            FROM rolling_15day
            ORDER BY date DESC
            LIMIT %(limit)s
        """, {
            'limit': limit
        })

        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Format response (keep depression as null when missing)
        data = [
            {
                'date': row[0].isoformat(),
                'alc_7day_sum': float(row[1]) if row[1] is not None else 0.0,
                'alc_15day_avg': float(row[2]) if row[2] is not None else 0.0,
                'dep_raw': float(row[3]) if row[3] is not None else None,
                'dep_7day_avg': float(row[4]) if row[4] is not None else None
            }
            for row in reversed(rows)  # Reverse to get chronological order
        ]

        return jsonify({
            'data': data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/sleep-score', methods=['GET'])
def sleep_score():
    """
    Get raw (1-day) and 7-day average of sleep score.

    Query parameters:
    - limit: Number of recent days to return (default: 60)

    Returns JSON with sleep score raw and 7-day average

    Note: This endpoint is public (no auth required) for read-only access
    """
    try:
        limit = int(request.args.get('limit', 60))
    except ValueError:
        return jsonify({'error': 'Invalid numeric parameter'}), 400

    if limit < 1:
        return jsonify({'error': 'limit must be a positive integer'}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Build SQL query with window functions
        cur.execute("""
            WITH rolling_7day AS (
                -- Calculate 7-day average (null sleep_score means no data, not 0)
                SELECT
                    date,
                    sleep_score AS sleep_raw,
                    AVG(sleep_score) OVER (
                        ORDER BY date
                        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
                    ) AS sleep_7day_avg
                FROM daily_summary
                ORDER BY date
            )
            SELECT
                date,
                sleep_raw,
                sleep_7day_avg
            FROM rolling_7day
            ORDER BY date DESC
            LIMIT %(limit)s
        """, {
            'limit': limit
        })

        rows = cur.fetchall()
        cur.close()
        conn.close()

        # Format response (keep null as null so frontend can skip missing data)
        data = [
            {
                'date': row[0].isoformat(),
                'sleep_raw': float(row[1]) if row[1] is not None else None,
                'sleep_7day_avg': float(row[2]) if row[2] is not None else None
            }
            for row in reversed(rows)  # Reverse to get chronological order
        ]

        return jsonify({
            'data': data
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run Flask development server
    app.run(host='0.0.0.0', port=5000, debug=True)
