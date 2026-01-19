// Configuration
const API_BASE_URL = '/status/api';
const HOBBY_CATEGORIES = ['wf', 'wr', 'bkc', 'arch', 'ean', 'ff', 'fw', 'gtr', 'hg', 'hu', 'math', 'mus', 'phy', 'prg', 'read', 'vip', 'ws'];
const WORK_CATEGORIES = ['sp'];
const CHART_DAYS_LIMIT = 31; // Request 31 days to ensure we have 30 after excluding today
const ROLLING_WINDOW_DAYS = 7;
const DECAY_LAMBDA = 0.5; // Calibrated so day 6 has 5% weight

// Chart instances
let summaryChart = null;
let hobbyChart = null;
let workChart = null;
let alcoholChart = null;
let sleepChart = null;

// Extra-exaggerated mood transformation: 0 to 0.5 takes same space as 0.5 to 2.0
function transformMood(mood) {
    if (mood === null) return null;

    const sign = mood >= 0 ? 1 : -1;
    const absMood = Math.abs(mood);

    // Map [0, 0.5] to [0, 1.0] (linear, takes up half the space)
    // Map [0.5, 2.0] to [1.0, 2.0] (compressed, takes up other half)
    if (absMood <= 0.5) {
        // Linear expansion: 0 to 0.5 becomes 0 to 1.0
        return sign * (absMood * 2.0);
    } else {
        // Compress 0.5 to 2.0 into 1.0 to 2.0
        // normalized = (absMood - 0.5) / 1.5  -> maps [0.5, 2.0] to [0, 1]
        // Then map [0, 1] to [1.0, 2.0]
        const normalized = (absMood - 0.5) / 1.5;
        return sign * (1.0 + normalized);
    }
}

// Exponential sleep score transformation: 80 appears in the middle of 40-100 range
function transformSleep(sleep) {
    if (sleep === null) return null;

    // Apply exponential transformation to [40, 100] range
    // where y = a * exp(b * x) is calibrated so that 80 maps to ~50
    // Normalize sleep to [0, 1]: (sleep - 40) / 60
    // Apply exponential: exp(k * normalized) - 1
    // Scale to [0, 100]: result / (exp(k) - 1) * 100
    // Choose k ≈ 1.099 so that 80 maps to 50
    const normalized = (sleep - 40) / 60;  // [40, 100] -> [0, 1]
    const k = 1.099;  // Calibrated so f(80) ≈ 50
    const expValue = Math.exp(k * normalized) - 1;
    const maxExp = Math.exp(k) - 1;
    return (expValue / maxExp) * 100;
}

// Fetch data from API
async function fetchData() {
    const params = new URLSearchParams({
        hobby: HOBBY_CATEGORIES.join(','),
        work: WORK_CATEGORIES.join(','),
        days: ROLLING_WINDOW_DAYS,
        limit: CHART_DAYS_LIMIT,
        lambda: DECAY_LAMBDA
    });

    const response = await fetch(`${API_BASE_URL}/category-rolling-sum?${params}`);

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

    const response = await fetch(`${API_BASE_URL}/alcohol-depression?${params}`);

    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();

    // Filter out today's data (always exclude current day since it's in flux)
    const today = new Date().toISOString().split('T')[0];
    data.data = data.data.filter(d => d.date !== today);

    return data;
}

// Fetch sleep score data from API
async function fetchSleepData() {
    const params = new URLSearchParams({
        limit: 60
    });

    const response = await fetch(`${API_BASE_URL}/sleep-score?${params}`);

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
    // Parse as UTC to avoid timezone offset issues
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Create or update summary chart with all composite metrics
function updateSummaryChart(hobbyData, workData, alcoholData, sleepData) {
    const ctx = document.getElementById('summaryChart').getContext('2d');

    // Use last 30 days for display
    const hobbyDisplay = hobbyData.data.slice(-30);
    const workDisplay = workData.data.slice(-30);
    const alcoholDisplay = alcoholData.data.slice(-30);
    const sleepDisplay = sleepData.data.slice(-30);

    // All should have same dates, use hobby data for labels
    const labels = hobbyDisplay.map(d => formatDate(d.date));

    // Normalize all metrics to 0-100 scale for visual consistency
    // Hobbies: already in minutes, convert to hours (divide by 60), then scale
    const hobbyFeelsLike = hobbyDisplay.map(d => d.hobby_weighted / 60);  // hours

    // Work: already in minutes, convert to hours * 2 (divide by 60, multiply by 2)
    const workFeelsLike = workDisplay.map(d => d.work_weighted * 2 / 60);  // hours

    // Alcohol: weekly rate (already reasonable scale)
    const alcoholWeekly = alcoholDisplay.map(d => d.alc_7day_sum);

    // Mood: transform with logarithmic compression, then scale from [-2,2] to visible range
    const moodSevenDay = alcoholDisplay.map(d => transformMood(d.dep_7day_avg));

    // Sleep: apply logarithmic transformation where 80 is in the middle
    const sleepSevenDay = sleepDisplay.map(d => transformSleep(d.sleep_7day_avg));

    // Destroy existing chart
    if (summaryChart) {
        summaryChart.destroy();
    }

    // Plugin to draw horizontal line at mood y=0
    const moodZeroLinePlugin = {
        id: 'moodZeroLine',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right }, scales: { yMood } } = chart;
            if (yMood) {
                const y = yMood.getPixelForValue(0);
                ctx.save();
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(left, y);
                ctx.lineTo(right, y);
                ctx.stroke();
                ctx.restore();
            }
        }
    };

    // Plugin to draw border around chart area
    const chartBorderPlugin = {
        id: 'chartBorder',
        afterDraw: (chart) => {
            const { ctx, chartArea: { left, top, right, bottom } } = chart;
            ctx.save();
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.strokeRect(left, top, right - left, bottom - top);
            ctx.restore();
        }
    };

    // Create summary chart with multiple y-axes (hidden)
    summaryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Hobbies Feels Like 7-Day',
                    data: hobbyFeelsLike,
                    borderColor: '#10b981',  // Green
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'yHours'
                },
                {
                    label: 'Work Feels Like 7-Day',
                    data: workFeelsLike,
                    borderColor: '#ef4444',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'yHours'
                },
                {
                    label: 'Weekly Alcohol Rate',
                    data: alcoholWeekly,
                    borderColor: '#eab308',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'yAlcohol'
                },
                {
                    label: 'Mood 7-Day',
                    data: moodSevenDay,
                    borderColor: '#4a9eff',  // Blue
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    yAxisID: 'yMood'
                },
                {
                    label: 'Sleep 7-Day',
                    data: sleepSevenDay,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    spanGaps: false,
                    yAxisID: 'ySleep'
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
                        font: { size: 12 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#222',
                    bodyColor: '#333',
                    borderColor: '#ddd',
                    borderWidth: 1,
                    padding: 12
                },
                moodZeroLine: {},
                chartBorder: {}
            },
            scales: {
                x: {
                    grid: { color: '#e5e7eb', drawBorder: false },
                    ticks: { color: '#666', maxRotation: 45, minRotation: 45 }
                },
                yHours: {
                    display: false,  // Hide axis
                    position: 'left',
                    min: 0,
                    max: 28
                },
                yAlcohol: {
                    display: false,
                    position: 'left',
                    min: 0,
                    max: 50
                },
                yMood: {
                    display: false,
                    position: 'left',
                    min: -2,
                    max: 2
                },
                ySleep: {
                    display: false,
                    position: 'left',
                    min: 0,
                    max: 100
                }
            }
        },
        plugins: [moodZeroLinePlugin, chartBorderPlugin]
    });
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
                    label: 'Actual 7-Day',
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
                    label: 'Feels Like 7-Day',
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
                    min: 0,
                    max: 1680,  // 28 hours in minutes
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
                    label: 'Actual 7-Day',
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
                    label: 'Feels Like 7-Day',
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
    const alcFifteenDayAvg = displayData.map(d => d.alc_15day_avg);

    // Shift depression from [-2, 2] to [0, max_alc] range for alignment
    // Find max alcohol value to scale depression to
    const maxAlc = Math.max(...alcSevenDaySum, ...alcFifteenDayAvg);
    const depRaw = displayData.map(d => {
        // Shift -2 to 0, 2 to maxAlc: (dep + 2) / 4 * maxAlc
        return ((d.dep_raw + 2) / 4) * maxAlc;
    });
    const depSevenDayAvg = displayData.map(d => {
        return ((d.dep_7day_avg + 2) / 4) * maxAlc;
    });

    // Transform mood data with logarithmic scale (skip nulls)
    const depRawTransformed = displayData.map(d => {
        if (d.dep_raw === null || d.dep_raw === undefined) return null;
        const transformed = transformMood(d.dep_raw);
        return transformed !== null ? ((transformed + 2) / 4) * maxAlc : null;
    });
    const depSevenDayTransformed = displayData.map(d => {
        if (d.dep_7day_avg === null || d.dep_7day_avg === undefined) return null;
        const transformed = transformMood(d.dep_7day_avg);
        return transformed !== null ? ((transformed + 2) / 4) * maxAlc : null;
    });

    // Destroy existing chart if it exists
    if (alcoholChart) {
        alcoholChart.destroy();
    }

    // Plugin to draw horizontal line at mood y=0 (scaled to alcohol range)
    const moodZeroLineAlcohol = {
        id: 'moodZeroLineAlcohol',
        beforeDraw: (chart) => {
            const { ctx, chartArea: { left, right }, scales: { y } } = chart;
            if (y) {
                // Mood 0 maps to (0 + 2) / 4 * maxAlc = maxAlc / 2
                const moodZeroScaled = maxAlc / 2;
                const yPos = y.getPixelForValue(moodZeroScaled);
                ctx.save();
                ctx.strokeStyle = '#999';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(left, yPos);
                ctx.lineTo(right, yPos);
                ctx.stroke();
                ctx.restore();
            }
        }
    };

    // Create new alcohol & mood chart
    alcoholChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Weekly Alcohol Rate',
                    data: alcSevenDaySum,
                    borderColor: '#eab308',  // Yellow
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    yAxisID: 'y'
                },
                {
                    label: 'Weekly Alcohol Rate 15-day',
                    data: alcFifteenDayAvg,
                    borderColor: 'rgba(234, 179, 8, 0.35)',  // Lighter yellow
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
                    data: depRawTransformed,
                    borderColor: '#4a9eff',  // Blue
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: false,  // Don't connect across null values
                    yAxisID: 'y'
                },
                {
                    label: 'Mood 7-Day',
                    data: depSevenDayTransformed,
                    borderColor: 'rgba(74, 158, 255, 0.35)',  // Lighter blue
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: false,  // Don't connect across null values
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
                                // Convert back from scaled transformed mood to original mood scale
                                const transformedMood = (context.parsed.y / maxAlc) * 4 - 2;
                                // Reverse the transformation
                                let originalMood;
                                const sign = transformedMood >= 0 ? 1 : -1;
                                const absTransformed = Math.abs(transformedMood);

                                if (absTransformed <= 1.0) {
                                    // Was in [0, 0.5] range, reverse: transformed/2.0
                                    originalMood = sign * (absTransformed / 2.0);
                                } else {
                                    // Was in [0.5, 2.0] range, reverse: 0.5 + (transformed - 1.0) * 1.5
                                    originalMood = sign * (0.5 + (absTransformed - 1.0) * 1.5);
                                }
                                return `${label}: ${originalMood.toFixed(2)}`;
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
        },
        plugins: [moodZeroLineAlcohol]
    });
}

// Create or update sleep score chart
function updateSleepChart(data) {
    const ctx = document.getElementById('sleepChart').getContext('2d');

    // Extract data for chart (only last 30 days for display)
    const allData = data.data;
    const displayData = allData.slice(-30);  // Last 30 days
    const labels = displayData.map(d => formatDate(d.date));

    // Apply logarithmic transformation so 80 appears in the middle
    const sleepRaw = displayData.map(d => transformSleep(d.sleep_raw));
    const sleepSevenDayAvg = displayData.map(d => transformSleep(d.sleep_7day_avg));

    // Destroy existing chart if it exists
    if (sleepChart) {
        sleepChart.destroy();
    }

    // Create new sleep chart
    sleepChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Raw',
                    data: sleepRaw,
                    borderColor: '#8b5cf6',  // Purple
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: false  // Don't connect across missing data
                },
                {
                    label: '7-Day Average',
                    data: sleepSevenDayAvg,
                    borderColor: 'rgba(139, 92, 246, 0.35)',  // Lighter purple
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    spanGaps: false  // Don't connect across missing data
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
                            // Reverse the exponential transformation to show original value
                            const transformed = context.parsed.y;
                            const k = 1.099;
                            const maxExp = Math.exp(k) - 1;
                            // Reverse: normalized = log((transformed / 100) * maxExp + 1) / k
                            const normalized = Math.log((transformed / 100) * maxExp + 1) / k;
                            const original = normalized * 60 + 40;
                            return `${context.dataset.label}: ${original.toFixed(0)}`;
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
                    min: 0,
                    max: 100,
                    grid: {
                        color: '#e5e7eb',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666',
                        callback: function(value) {
                            // Show original sleep scores on y-axis (40-100 range)
                            const k = 1.099;
                            const maxExp = Math.exp(k) - 1;
                            const normalized = Math.log((value / 100) * maxExp + 1) / k;
                            const original = normalized * 60 + 40;
                            return original.toFixed(0);
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
        const sleepData = await fetchSleepData();

        // Update all components
        updateSummaryChart(data, data, alcoholDepressionData, sleepData);
        updateHobbyChart(data);
        updateWorkChart(data);
        updateAlcoholChart(alcoholDepressionData);
        updateSleepChart(sleepData);
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
            const sleepData = await fetchSleepData();
            updateHobbyChart(data);
            updateWorkChart(data);
            updateAlcoholChart(alcoholDepressionData);
            updateSleepChart(sleepData);
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
