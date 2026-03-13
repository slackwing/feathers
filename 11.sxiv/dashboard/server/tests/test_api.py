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
    response = requests.get(f'{API_BASE_URL}/api/health')
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'healthy'


def test_rolling_sum_public_access(api_headers):
    """Test that dashboard endpoint is public (no auth required)"""
    # Without auth - should work
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5}
    )
    assert response.status_code == 200

    # With auth - should also work
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 200


def test_rolling_sum_missing_categories(api_headers):
    """Test that hobby or work parameter is required"""
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 400
    assert 'hobby or work' in response.json()['error']


def test_rolling_sum_data_integrity(api_headers):
    """
    Test that returned data has proper structure and mathematical consistency.
    This test works regardless of which dates exist in the database.
    """
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert 'data' in data
    assert 'hobby_categories' in data
    assert 'work_categories' in data
    assert 'other_categories' in data
    assert 'window_days' in data
    assert 'decay_lambda' in data

    # Must have at least some data
    assert len(data['data']) > 0, "API should return at least one day of data"

    # Check each data point for consistency
    for day in data['data']:
        # Verify all required fields exist
        assert 'date' in day
        assert 'hobby_raw' in day
        assert 'hobby_weighted' in day
        assert 'work_raw' in day
        assert 'work_weighted' in day
        assert 'other_raw' in day
        assert 'total_raw' in day

        # Verify mathematical consistency: hobby + work + other = total
        total_sum = day['hobby_raw'] + day['work_raw'] + day['other_raw']
        assert day['total_raw'] == total_sum, f"Total mismatch on {day['date']}: {day['total_raw']} != {total_sum}"

        # Verify all values are non-negative
        assert day['hobby_raw'] >= 0
        assert day['hobby_weighted'] >= 0
        assert day['work_raw'] >= 0
        assert day['work_weighted'] >= 0
        assert day['other_raw'] >= 0
        assert day['total_raw'] >= 0


def test_rolling_sum_weighted_behavior(api_headers):
    """
    Test that exponential weighting behaves correctly.
    Weighted values can be higher or lower than raw depending on recent activity.
    """
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    assert len(data['data']) > 0, "Need data to test weighted behavior"

    # For at least some days, weighted should differ from raw
    # (unless every single day had identical values, which is unlikely)
    differences = [d for d in data['data'] if d['hobby_weighted'] != d['hobby_raw']]
    assert len(differences) > 0, "Weighted values should differ from raw in at least some cases"


def test_rolling_sum_date_ordering(api_headers):
    """
    Test that dates are returned in chronological order.
    """
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 30},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    if len(data['data']) > 1:
        # Verify dates are in ascending chronological order
        dates = [d['date'] for d in data['data']]
        assert dates == sorted(dates), "Dates should be in chronological order"


def test_rolling_sum_category_lists(api_headers):
    """Test that hobby, work, and other category lists are correct"""
    response = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response.status_code == 200
    data = response.json()

    # Verify hobby categories
    assert 'hobby_categories' in data
    assert set(data['hobby_categories']) == {'wf', 'wr', 'bkc'}

    # Verify other categories exist and don't overlap with hobby
    assert 'other_categories' in data
    assert len(data['other_categories']) > 0

    # Ensure no overlap between hobby and other
    hobby_set = set(data['hobby_categories'])
    other_set = set(data['other_categories'])
    assert hobby_set.isdisjoint(other_set)


def test_rolling_sum_different_window_sizes(api_headers):
    """Test that different window sizes produce different results"""
    # Get 7-day window
    response_7 = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5},
        headers=api_headers
    )
    assert response_7.status_code == 200
    data_7 = response_7.json()

    # Get 14-day window
    response_14 = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 14, 'limit': 5},
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
            assert matching_14[0]['hobby_raw'] >= data_7['data'][0]['hobby_raw']


def test_rolling_sum_lambda_parameter(api_headers):
    """Test that different lambda values affect weighting"""
    # Lambda 0.2 (default)
    response_02 = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5, 'lambda': 0.2},
        headers=api_headers
    )
    assert response_02.status_code == 200
    data_02 = response_02.json()

    # Lambda 0.5 (stronger recency bias)
    response_05 = requests.get(
        f'{API_BASE_URL}/api/category-rolling-sum',
        params={'hobby': 'wf,wr,bkc', 'days': 7, 'limit': 5, 'lambda': 0.5},
        headers=api_headers
    )
    assert response_05.status_code == 200
    data_05 = response_05.json()

    # Verify lambda values are stored correctly
    assert data_02['decay_lambda'] == 0.2
    assert data_05['decay_lambda'] == 0.5

    # Both should have the same raw sums (lambda only affects weighted)
    if data_02['data'] and data_05['data']:
        assert data_02['data'][0]['hobby_raw'] == data_05['data'][0]['hobby_raw']


if __name__ == '__main__':
    # Allow running directly for quick testing
    print(f"Testing API at: {API_BASE_URL}")
    pytest.main([__file__, '-v'])
