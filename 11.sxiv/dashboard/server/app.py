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

if __name__ == '__main__':
    # Run Flask development server
    app.run(host='0.0.0.0', port=5000, debug=True)
