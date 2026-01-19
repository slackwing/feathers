// Configuration
const API_BASE_URL = '/status/api';
const HOBBY_CATEGORIES = ['wf', 'wr', 'bkc', 'arch', 'ean', 'ff', 'fw', 'gtr', 'hg', 'hu', 'math', 'mus', 'phy', 'prg', 'read', 'vip', 'ws'];
const WORK_CATEGORIES = ['sp'];
const CHART_DAYS_LIMIT = 31; // Request 31 days to ensure we have 30 after excluding today
const ROLLING_WINDOW_DAYS = 7;
const DECAY_LAMBDA = 0.5; // Calibrated so day 6 has 5% weight

// Chart instances
let hobbyChart = null;
let workChart = null;
let alcoholChart = null;

// Fetch data from API
async function fetchData() {
    const params = new URLSearchParams({
        hobby: HOBBY_CATEGORIES.join(','),
        work: WORK_CATEGORIES.join(','),
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

// Fetch alcohol and depression data from API
async function fetchAlcoholDepressionData() {
    const params = new URLSearchParams({
        limit: 60  // Need extra days for 30-day moving average
    });

    const response = await fetch(`${API_BASE_URL}/api/dashboard/alcohol-depression?${params}`);

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

// Create or update hobby chart
function updateHobbyChart(data) {
    const ctx = document.getElementById('hobbyChart').getContext('2d');

    // Extract data for chart
    const labels = data.data.map(d => formatDate(d.date));
    const rawData = data.data.map(d => d.hobby_raw);
    const weightedData = data.data.map(d => d.hobby_weighted);

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

    // Create new hobby chart
    hobbyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual',
                    data: rawData,
                    borderColor: '#4a9eff',
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
                    borderColor: 'rgba(74, 158, 255, 0.25)',
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

// Create or update work chart
function updateWorkChart(data) {
    const ctx = document.getElementById('workChart').getContext('2d');

    // Extract data for chart (multiply work by 2)
    const labels = data.data.map(d => formatDate(d.date));
    const rawData = data.data.map(d => d.work_raw * 2);
    const weightedData = data.data.map(d => d.work_weighted * 2);

    // Destroy existing chart if it exists
    if (workChart) {
        workChart.destroy();
    }

    // Background zone plugin for work (different zones)
    const backgroundZones = {
        id: 'backgroundZones',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart;

            // Define zones: [minHours, maxHours, color]
            // 0-14: light green, 14-21: very light green, 21-28: light yellow, 28+: red-orange
            const zones = [
                [0, 14, 'rgba(100, 200, 100, 0.15)'],    // Light green (0-14h)
                [14, 21, 'rgba(100, 200, 100, 0.08)'],   // Very light green (14-21h)
                [21, 28, 'rgba(255, 220, 100, 0.2)'],    // Light yellow (21-28h)
                [28, 100, 'rgba(255, 100, 80, 0.15)']    // Red-orange (28+h)
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

    // Create new work chart
    workChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Actual',
                    data: rawData,
                    borderColor: '#ef4444',
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
                    borderColor: 'rgba(239, 68, 68, 0.25)',
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

// Helper function to get color based on mood value (-2 to 2)
function getMoodColor(depValue) {
    // Map from -2 (purple) to 2 (green)
    // Normalize to 0-1 range
    const normalized = (depValue + 2) / 4;

    // Interpolate between purple (99, 102, 241) and green (34, 197, 94)
    const r = Math.round(99 + (34 - 99) * normalized);
    const g = Math.round(102 + (197 - 102) * normalized);
    const b = Math.round(241 + (94 - 241) * normalized);

    return `rgb(${r}, ${g}, ${b})`;
}

// Create or update alcohol & mood chart
function updateAlcoholChart(data) {
    const ctx = document.getElementById('alcoholChart').getContext('2d');

    // Extract data for chart (only last 30 days for display)
    const allData = data.data;
    const displayData = allData.slice(-30);  // Last 30 days
    const labels = displayData.map(d => formatDate(d.date));
    const alcSevenDaySum = displayData.map(d => d.alc_7day_sum);
    const alcThirtyDayAvg = displayData.map(d => d.alc_30day_avg);

    // Shift depression from [-2, 2] to [0, max_alc] range for alignment
    // Find max alcohol value to scale depression to
    const maxAlc = Math.max(...alcSevenDaySum, ...alcThirtyDayAvg);
    const depRaw = displayData.map(d => {
        // Shift -2 to 0, 2 to maxAlc: (dep + 2) / 4 * maxAlc
        return ((d.dep_raw + 2) / 4) * maxAlc;
    });
    const depSevenDayAvg = displayData.map(d => {
        return ((d.dep_7day_avg + 2) / 4) * maxAlc;
    });

    // Create segment colors for mood lines based on actual mood values
    const depRawColors = displayData.map(d => getMoodColor(d.dep_raw));
    const depSevenDayColors = displayData.map(d => getMoodColor(d.dep_7day_avg));

    // Destroy existing chart if it exists
    if (alcoholChart) {
        alcoholChart.destroy();
    }

    // Create new alcohol & mood chart
    alcoholChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Alcohol 7-Day',
                    data: alcSevenDaySum,
                    borderColor: '#d97706',  // Gold
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: depRawColors,
                    pointBorderColor: depRawColors,
                    yAxisID: 'y'
                },
                {
                    label: 'Alcohol 30-Day',
                    data: alcThirtyDayAvg,
                    borderColor: 'rgba(217, 119, 6, 0.35)',  // Lighter gold
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: 'Mood Raw',
                    data: depRaw,
                    segment: {
                        borderColor: ctx => {
                            const index = ctx.p0DataIndex;
                            return depRawColors[index];
                        }
                    },
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: 'Mood 7-Day',
                    data: depSevenDayAvg,
                    segment: {
                        borderColor: ctx => {
                            const index = ctx.p0DataIndex;
                            const color = depSevenDayColors[index];
                            // Add transparency
                            return color.replace('rgb', 'rgba').replace(')', ', 0.35)');
                        }
                    },
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    yAxisID: 'y'
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
                            const label = context.dataset.label;
                            if (label.startsWith('Alcohol')) {
                                return `${label}: ${context.parsed.y.toFixed(1)} drinks`;
                            } else {
                                // Convert back to original mood scale for tooltip
                                const originalValue = (context.parsed.y / maxAlc) * 4 - 2;
                                return `${label}: ${originalValue.toFixed(2)}`;
                            }
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
                            return value.toFixed(0);
                        }
                    }
                }
            }
        }
    });
}

// Get color based on hobby zones
function getHobbyColor(hours) {
    if (hours < 7) return '#d97706';  // Orange (readable)
    if (hours < 14) return '#ca8a04'; // Yellow-orange (readable)
    if (hours < 21) return '#16a34a'; // Green
    return '#15803d';                 // Dark green
}

// Get color based on work zones
function getWorkColor(hours) {
    if (hours < 14) return '#16a34a';  // Green
    if (hours < 21) return '#22c55e';  // Light green
    if (hours < 28) return '#ca8a04';  // Yellow-orange (readable)
    return '#d97706';                  // Orange
}

// Update stats cards
function updateStats(data) {
    const latest = data.data[data.data.length - 1];

    // Convert minutes to hours and combine raw + weighted for hobbies
    const hobbyRawHours = Math.round(latest.hobby_raw / 60);
    const hobbyWeightedHours = Math.round(latest.hobby_weighted / 60);
    const hobbyColor = getHobbyColor(hobbyRawHours);
    const hobbyWeightedColor = getHobbyColor(hobbyWeightedHours);
    document.getElementById('latestHobby').innerHTML = `<span style="color: ${hobbyColor};">${hobbyRawHours}</span> <span style="color: ${hobbyWeightedColor}; opacity: 0.4;">(${hobbyWeightedHours})</span>`;

    // Show work raw + weighted in hours (multiply by 2)
    const workRawHours = Math.round((latest.work_raw * 2) / 60);
    const workWeightedHours = Math.round((latest.work_weighted * 2) / 60);
    const workColor = getWorkColor(workRawHours);
    const workWeightedColor = getWorkColor(workWeightedHours);
    document.getElementById('latestWork').innerHTML = `<span style="color: ${workColor};">${workRawHours}</span> <span style="color: ${workWeightedColor}; opacity: 0.4;">(${workWeightedHours})</span>`;

    // Show other raw sum in hours
    const otherHours = Math.round(latest.other_raw / 60);
    document.getElementById('latestOther').textContent = otherHours;
}

// Update category lists
function updateCategories(data) {
    const hobbyContainer = document.getElementById('hobbyCategories');
    const otherContainer = document.getElementById('otherCategories');

    hobbyContainer.innerHTML = '';
    otherContainer.innerHTML = '';

    // Add hobby categories
    data.hobby_categories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-tag matched';
        tag.textContent = cat;
        hobbyContainer.appendChild(tag);
    });

    // Add other categories
    data.other_categories.forEach(cat => {
        const tag = document.createElement('span');
        tag.className = 'category-tag';
        tag.textContent = cat;
        otherContainer.appendChild(tag);
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
        const alcoholDepressionData = await fetchAlcoholDepressionData();

        // Update all components
        updateHobbyChart(data);
        updateWorkChart(data);
        updateAlcoholChart(alcoholDepressionData);
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
            const alcoholDepressionData = await fetchAlcoholDepressionData();
            updateHobbyChart(data);
            updateWorkChart(data);
            updateAlcoholChart(alcoholDepressionData);
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
