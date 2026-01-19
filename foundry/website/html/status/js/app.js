// Configuration
const API_BASE_URL = '/status/api';
const HOBBY_CATEGORIES = ['wf', 'wr', 'bkc', 'arch', 'ean', 'ff', 'fw', 'gtr', 'hg', 'hu', 'math', 'mus', 'phy', 'prg', 'read', 'vip', 'ws'];
const CHART_DAYS_LIMIT = 31; // Request 31 days to ensure we have 30 after excluding today
const ROLLING_WINDOW_DAYS = 7;
const DECAY_LAMBDA = 0.5; // Calibrated so day 6 has 5% weight

// Chart instance
let hobbyChart = null;

// Fetch data from API
async function fetchData() {
    const params = new URLSearchParams({
        categories: HOBBY_CATEGORIES.join(','),
        days: ROLLING_WINDOW_DAYS,
        limit: CHART_DAYS_LIMIT,
        lambda: DECAY_LAMBDA
    });

    const response = await fetch(`${API_BASE_URL}/api/dashboard/category-rolling-sum?${params}`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter out today's data (always exclude current day since it's in flux)
    const today = new Date().toISOString().split('T')[0];
    data.data = data.data.filter(d => d.date !== today);

    return data;
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Create or update chart
function updateChart(data) {
    const ctx = document.getElementById('hobbyChart').getContext('2d');

    // Extract data for chart
    const labels = data.data.map(d => formatDate(d.date));
    const rawData = data.data.map(d => d.matched_raw);
    const weightedData = data.data.map(d => d.matched_weighted);

    // Destroy existing chart if it exists
    if (hobbyChart) {
        hobbyChart.destroy();
    }

    // Background zone plugin
    const backgroundZones = {
        id: 'backgroundZones',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;

            // Define zones: [minHours, maxHours, color]
            const zones = [
                [0, 7, 'rgba(255, 100, 80, 0.15)'],      // Red-orange (0-7h)
                [7, 14, 'rgba(255, 220, 100, 0.2)'],     // Yellow (7-14h)
                [14, 21, 'rgba(100, 200, 100, 0.15)'],   // Light green (14-21h)
                [21, 100, 'rgba(100, 200, 100, 0.25)']   // Green, bolder (21+h)
            ];

            zones.forEach(([minHours, maxHours, color]) => {
                const minMinutes = minHours * 60;
                const maxMinutes = maxHours * 60;
                const yMin = y.getPixelForValue(minMinutes);
                const yMax = y.getPixelForValue(maxMinutes);

                ctx.fillStyle = color;
                ctx.fillRect(left, yMax, right - left, yMin - yMax);
            });
        }
    };

    // Create new chart
    hobbyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual',
                    data: rawData,
                    borderColor: 'rgba(74, 158, 255, 0.25)',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                },
                {
                    label: 'Feels Like',
                    data: weightedData,
                    borderColor: '#4a9eff',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: '#333',
                        padding: 15,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#222',
                    bodyColor: '#333',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(0)} min`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666',
                        callback: function(value) {
                            const hours = Math.floor(value / 60);
                            return hours + 'h';
                        }
                    }
                }
            }
        },
        plugins: [backgroundZones]
    });
}

// Update stats cards
function updateStats(data) {
    const latest = data.data[data.data.length - 1];

    document.getElementById('latestRaw').textContent = latest.matched_raw.toFixed(0);
    document.getElementById('latestWeighted').textContent = latest.matched_weighted.toFixed(0);

    const totalCategories = data.matched_categories.length + data.unmatched_categories.length;
    document.getElementById('categoryCount').textContent = totalCategories;
}

// Update category lists
function updateCategories(data) {
    const matchedContainer = document.getElementById('matchedCategories');
    const unmatchedContainer = document.getElementById('unmatchedCategories');

    matchedContainer.innerHTML = '';
    unmatchedContainer.innerHTML = '';

    // Add matched categories
    data.matched_categories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-tag matched';
        tag.textContent = cat;
        matchedContainer.appendChild(tag);
    });

    // Add unmatched categories
    data.unmatched_categories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.textContent = cat;
        unmatchedContainer.appendChild(tag);
    });
}

// Update last updated timestamp
function updateTimestamp() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = now.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
    });
}

// Show error message
function showError(message) {
    const main = document.querySelector('main');
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `Error: ${message}`;
    main.insertBefore(errorDiv, main.firstChild);
}

// Initialize dashboard
async function init() {
    try {
        // Add loading state
        document.querySelector('.container').classList.add('loading');

        // Fetch data
        const data = await fetchData();

        // Update all components
        updateChart(data);
        updateStats(data);
        updateCategories(data);
        updateTimestamp();

        // Remove loading state
        document.querySelector('.container').classList.remove('loading');

    } catch (error) {
        console.error('Failed to load dashboard:', error);
        showError(error.message);
        document.querySelector('.container').classList.remove('loading');
    }
}

// Refresh data periodically (every 5 minutes)
function startAutoRefresh() {
    setInterval(async () => {
        try {
            const data = await fetchData();
            updateChart(data);
            updateStats(data);
            updateCategories(data);
            updateTimestamp();
        } catch (error) {
            console.error('Auto-refresh failed:', error);
        }
    }, 5 * 60 * 1000); // 5 minutes
}

// Start the dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    init();
    startAutoRefresh();
});
