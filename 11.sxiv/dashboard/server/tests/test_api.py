#!/usr/bin/env python3
"""
API Integration Tests

Tests the dashboard API endpoints against real historical data.
Can test both local and remote APIs.

Usage:
    # Test local
    pytest dashboard/server/tests/test_api.py -v

    # Test remote
    TEST_API_URL=https://andrewcheong.com/status/api pytest dashboard/server/tests/test_api.py -v
"""

import os
import pytest
import requests

# Test against local or remote based on environment variable
API_BASE_URL = os.getenv('TEST_API_URL', 'http://localhost:5000')
API_TOKEN = '70e76d8aa02a319a510b8c239e1e7cbe86dbc3c35fec7bf270564757af0c6a90'


@pytest.fixture
def api_headers():
    """Standard headers for API requests"""
    return {'Authorization': f'Bearer {API_TOKEN}'}


def test_health_endpoint():
    """Test that the health endpoint is accessible"""
    response = requests.get(f'{API_BASE_URL}/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'healthy'


def test_rolling_sum_auth_required(api_headers):
    """Test that authentication is required"""
    # Without auth
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5}
    )
    assert response.status_code == 401

    # With auth
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 200


def test_rolling_sum_missing_categories(api_headers):
    """Test that categories parameter is required"""
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 400
    assert 'categories' in response.json()['error']


def test_rolling_sum_dec_24_2025(api_headers):
    """
    Test Dec 24, 2025 - date with high hobby activity
    Expected: matched values higher than earlier dates
    """
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert 'data' in data
    assert 'matched_categories' in data
    assert 'unmatched_categories' in data
    assert 'window_days' in data
    assert 'decay_lambda' in data

    # Find Dec 24, 2025 in the results
    dec_24_data = [d for d in data['data'] if d['date'] == '2025-12-24']
    assert len(dec_24_data) == 1, "Dec 24, 2025 should exist in database"

    dec_24 = dec_24_data[0]

    # Verify all required fields exist
    assert 'matched_raw' in dec_24
    assert 'matched_weighted' in dec_24
    assert 'unmatched_raw' in dec_24
    assert 'total_raw' in dec_24

    # Assert specific values from historical data
    assert dec_24['matched_raw'] == 541
    assert abs(dec_24['matched_weighted'] - 718.9) < 1.0
    assert dec_24['unmatched_raw'] == 1066
    assert dec_24['total_raw'] == 1607

    # Verify matched_raw + unmatched_raw = total_raw
    assert dec_24['matched_raw'] + dec_24['unmatched_raw'] == dec_24['total_raw']

    # Verify weighted sum is higher than raw (recent activity boost)
    assert dec_24['matched_weighted'] > dec_24['matched_raw']


def test_rolling_sum_dec_26_2025(api_headers):
    """
    Test Dec 26, 2025 - peak hobby activity date
    Expected: highest matched values in the test range
    """
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    dec_26_data = [d for d in data['data'] if d['date'] == '2025-12-26']
    assert len(dec_26_data) == 1

    dec_26 = dec_26_data[0]

    # Assert exact values from current database
    assert dec_26['matched_raw'] == 838
    assert abs(dec_26['matched_weighted'] - 1077.4) < 1.0
    assert dec_26['unmatched_raw'] == 752
    assert dec_26['total_raw'] == 1590

    # Verify math
    assert dec_26['matched_raw'] + dec_26['unmatched_raw'] == dec_26['total_raw']

    # Weighted should be higher (recent activity)
    assert dec_26['matched_weighted'] > dec_26['matched_raw']


def test_rolling_sum_dec_28_2025(api_headers):
    """
    Test Dec 28, 2025 - date with no recent hobby activity
    Expected: raw sum stays high but weighted drops (recency bias)
    """
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    dec_28_data = [d for d in data['data'] if d['date'] == '2025-12-28']
    assert len(dec_28_data) == 1

    dec_28 = dec_28_data[0]

    # Assert exact values
    assert dec_28['matched_raw'] == 838  # Same as Dec 26 (7-day window includes same dates)
    assert abs(dec_28['matched_weighted'] - 722.2) < 1.0  # Lower due to no recent activity
    assert dec_28['unmatched_raw'] == 752
    assert dec_28['total_raw'] == 1590

    # Verify math
    assert dec_28['matched_raw'] + dec_28['unmatched_raw'] == dec_28['total_raw']

    # Weighted should be LOWER (no recent activity)
    assert dec_28['matched_weighted'] < dec_28['matched_raw']


def test_rolling_sum_category_lists(api_headers):
    """Test that matched and unmatched category lists are correct"""
    response = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify matched categories
    assert 'matched_categories' in data
    assert set(data['matched_categories']) == {'wf', 'wr', 'bkc'}

    # Verify unmatched categories exist and don't overlap
    assert 'unmatched_categories' in data
    assert len(data['unmatched_categories']) > 0

    # Ensure no overlap between matched and unmatched
    matched_set = set(data['matched_categories'])
    unmatched_set = set(data['unmatched_categories'])
    assert matched_set.isdisjoint(unmatched_set)


def test_rolling_sum_different_window_sizes(api_headers):
    """Test that different window sizes produce different results"""
    # Get 7-day window
    response_7 = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response_7.status_code == 200
    data_7 = response_7.json()

    # Get 14-day window
    response_14 = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 14, 'limit': 5},
        headers=api_headers
    )
    assert response_14.status_code == 200
    data_14 = response_14.json()

    # 14-day raw sums should generally be higher than 7-day
    # (or at least different, assuming non-uniform data)
    assert data_7['window_days'] == 7
    assert data_14['window_days'] == 14

    # Find same date in both responses to compare
    if data_7['data'] and data_14['data']:
        date_7 = data_7['data'][0]['date']
        matching_14 = [d for d in data_14['data'] if d['date'] == date_7]
        if matching_14:
            # 14-day window should have >= 7-day window raw sum
            assert matching_14[0]['matched_raw'] >= data_7['data'][0]['matched_raw']


def test_rolling_sum_lambda_parameter(api_headers):
    """Test that different lambda values affect weighting"""
    # Lambda 0.2 (default)
    response_02 = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5, 'lambda': 0.2},
        headers=api_headers
    )
    assert response_02.status_code == 200
    data_02 = response_02.json()

    # Lambda 0.5 (stronger recency bias)
    response_05 = requests.get(
        f'{API_BASE_URL}/api/dashboard/category-rolling-sum',
        params={'categories': 'wf,wr,bkc', 'days': 7, 'limit': 5, 'lambda': 0.5},
        headers=api_headers
    )
    assert response_05.status_code == 200
    data_05 = response_05.json()

    # Verify lambda values are stored correctly
    assert data_02['decay_lambda'] == 0.2
    assert data_05['decay_lambda'] == 0.5

    # Both should have the same raw sums (lambda only affects weighted)
    if data_02['data'] and data_05['data']:
        assert data_02['data'][0]['matched_raw'] == data_05['data'][0]['matched_raw']


if __name__ == '__main__':
    # Allow running directly for quick testing
    print(f"Testing API at: {API_BASE_URL}")
    pytest.main([__file__, '-v'])
