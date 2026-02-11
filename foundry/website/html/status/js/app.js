// Configuration
const API_BASE_URL = '/status/api';
const HOBBY_CATEGORIES = ['wf', 'wr', 'bkc', 'arch', 'ean', 'ff', 'fw', 'gtr', 'hg', 'hu', 'math', 'mus', 'phy', 'prg', 'read', 'vip', 'ws', 'qt', 'life', 'cs', 'act', 'rk', 'ky', 'agi'];
const WORK_CATEGORIES = ['sp'];
const CHART_DAYS_LIMIT = 31; // Request 31 days to ensure we have 30 after excluding today
const ROLLING_WINDOW_DAYS = 7;
const DECAY_LAMBDA = 0.5; // Calibrated so day 6 has 5% weight

// Color scheme - centralized color definitions
const COLORS = {
    // Primary colors for good/bad states
    RED: '#dc2626',          // Bad state (too low hobbies, too high work)
    YELLOW: '#ca8a04',       // Warning state
    GREEN: '#16a34a',        // Good state
    GREEN_LIGHT: '#22c55e',  // Light green variant
    GREEN_DARK: '#15803d',   // Dark green variant

    // Chart zone colors (with alpha for backgrounds)
    ZONE_RED: 'rgba(220, 38, 38, 0.15)',      // Bad zones
    ZONE_YELLOW: 'rgba(202, 138, 4, 0.15)',   // Warning zones
    ZONE_GREEN: 'rgba(22, 163, 74, 0.15)',    // Good zones
    ZONE_GREEN_LIGHT: 'rgba(100, 200, 100, 0.08)',  // Very light green

    // Chart line colors (solid for "Actual", light for "Feels Like" or secondary lines)
    HOBBY_LINE: '#10b981',                          // Green (want more hobbies)
    HOBBY_LINE_LIGHT: 'rgba(16, 185, 129, 0.25)',  // Light green for feels-like

    WORK_LINE: '#ef4444',                           // Red (want less work)
    WORK_LINE_LIGHT: 'rgba(239, 68, 68, 0.25)',    // Light red for feels-like

    ALCOHOL_LINE: '#eab308',                        // Yellow for alcohol
    ALCOHOL_LINE_LIGHT: 'rgba(234, 179, 8, 0.35)', // Light yellow for 15-day avg

    MOOD_LINE: '#4a9eff',                           // Blue for mood
    MOOD_LINE_LIGHT: 'rgba(74, 158, 255, 0.35)',   // Light blue for 7-day avg

    SLEEP_LINE: '#8b5cf6',                          // Purple for sleep
    SLEEP_LINE_LIGHT: 'rgba(139, 92, 246, 0.35)'   // Light purple for 7-day avg
};

// Unified chart scale configuration
// This ensures summary chart and individual charts use the same y-axis scaling
const CHART_SCALES = {
    hours: {
        min: 0,
        max: 35 * 60  // 35 hours in minutes
    },
    alcohol: {
        min: 0,
        max: null  // Auto-scale based on data (will be set dynamically)
    },
    mood: {
        min: -2,
        max: 2
    },
    sleep: {
        min: 0,
        max: 100
    }
};

// Chart instances
let summaryChart = null;
let hobbyChart = null;
let workChart = null;
let alcoholChart = null;
let sleepChart = null;

// Helper to determine if on mobile and get responsive options
function isMobile() {
    return window.innerWidth < 768;
}

function getResponsiveChartOptions() {
    const mobile = isMobile();
    return {
        responsive: true,
        maintainAspectRatio: !mobile, // Disable aspect ratio on mobile
        aspectRatio: mobile ? undefined : 2,
        plugins: {
            tooltip: {
                enabled: false
            }
        }
    };
}

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

    // Calculate max alcohol value for dynamic scaling (match individual chart behavior)
    const maxAlcValue = Math.max(...alcoholWeekly);
    // Round up to nearest 10 for cleaner scale
    const alcoholMaxScale = Math.ceil(maxAlcValue / 10) * 10;

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
                    borderColor: COLORS.HOBBY_LINE,
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
                    borderColor: COLORS.WORK_LINE,
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
                    borderColor: COLORS.ALCOHOL_LINE,
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
                    borderColor: COLORS.MOOD_LINE,
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
            ...getResponsiveChartOptions(),
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
                    enabled: false
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
                    min: CHART_SCALES.hours.min / 60,  // Convert to hours for summary chart
                    max: CHART_SCALES.hours.max / 60   // Convert to hours for summary chart
                },
                yAlcohol: {
                    display: false,
                    position: 'left',
                    min: 0,
                    max: alcoholMaxScale  // Dynamic max based on data
                },
                yMood: {
                    display: false,
                    position: 'left',
                    min: CHART_SCALES.mood.min,
                    max: CHART_SCALES.mood.max
                },
                ySleep: {
                    display: false,
                    position: 'left',
                    min: CHART_SCALES.sleep.min,
                    max: CHART_SCALES.sleep.max
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
                [0, 7, COLORS.ZONE_RED],      // Red (0-7h - too low)
                [7, 14, COLORS.ZONE_YELLOW],  // Yellow (7-14h - low)
                [14, 21, COLORS.ZONE_GREEN],  // Green (14-21h - good)
                [21, 100, COLORS.ZONE_GREEN]  // Green (21+h - great)
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
                    borderColor: COLORS.HOBBY_LINE,
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
                    borderColor: COLORS.HOBBY_LINE_LIGHT,
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
            ...getResponsiveChartOptions(),
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
                    enabled: false
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
                    min: CHART_SCALES.hours.min,
                    max: CHART_SCALES.hours.max,
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
            // 0-14: green (good), 14-21: light green (ok), 21-28: yellow (high), 28+: red (too high)
            const zones = [
                [0, 14, COLORS.ZONE_GREEN],        // Green (0-14h - good)
                [14, 21, COLORS.ZONE_GREEN_LIGHT], // Light green (14-21h - okay)
                [21, 28, COLORS.ZONE_YELLOW],      // Yellow (21-28h - getting high)
                [28, 100, COLORS.ZONE_RED]         // Red (28+h - too high)
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
                    borderColor: COLORS.WORK_LINE,
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
                    borderColor: COLORS.WORK_LINE_LIGHT,
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
            ...getResponsiveChartOptions(),
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
                    enabled: false
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
                    min: CHART_SCALES.hours.min,
                    max: CHART_SCALES.hours.max,
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
    // Round up to nearest 10 for cleaner scale (match summary chart)
    const alcoholMaxScale = Math.ceil(maxAlc / 10) * 10;
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
                    borderColor: COLORS.ALCOHOL_LINE,
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
                    borderColor: COLORS.ALCOHOL_LINE_LIGHT,
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
                    borderColor: COLORS.MOOD_LINE,
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
                    borderColor: COLORS.MOOD_LINE_LIGHT,
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
            ...getResponsiveChartOptions(),
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
                    enabled: false
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
                    max: alcoholMaxScale,
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
                    borderColor: COLORS.SLEEP_LINE,
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
                    borderColor: COLORS.SLEEP_LINE_LIGHT,
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
            ...getResponsiveChartOptions(),
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
                    enabled: false
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
                    min: CHART_SCALES.sleep.min,
                    max: CHART_SCALES.sleep.max,
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
    if (hours < 7) return COLORS.RED;         // Red (too low - bad)
    if (hours < 14) return COLORS.YELLOW;     // Yellow (low)
    if (hours < 21) return COLORS.GREEN;      // Green (good range)
    return COLORS.GREEN_DARK;                 // Dark green (high - great)
}

// Get color based on work zones
function getWorkColor(hours) {
    if (hours < 14) return COLORS.GREEN;        // Green (good - not too much)
    if (hours < 21) return COLORS.GREEN_LIGHT;  // Light green (okay)
    if (hours < 28) return COLORS.YELLOW;       // Yellow (getting high)
    return COLORS.RED;                          // Red (too high - bad)
}

// Create mini pie chart
function createMiniPie(canvasId, value, maxValue, color, opacity = 1.0) {
    const canvas = document.getElementById(canvasId);

    // Set canvas dimensions explicitly
    canvas.width = 40;
    canvas.height = 40;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart if present
    if (canvas.chart) {
        canvas.chart.destroy();
    }

    const percentage = Math.min(value / maxValue, 1.0);
    const remaining = 1.0 - percentage;

    canvas.chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage * 100, remaining * 100],
                backgroundColor: [
                    `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`,
                    '#e5e7eb'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            cutout: '70%'
        }
    });
}

// Update stats cards
function updateStats(data) {
    const latest = data.data[data.data.length - 1];

    // Convert minutes to hours and combine raw + weighted for hobbies
    const hobbyRawHours = Math.round(latest.hobby_raw / 60);
    const hobbyWeightedHours = Math.round(latest.hobby_weighted / 60);
    const hobbyColor = getHobbyColor(hobbyRawHours);
    const hobbyWeightedColor = getHobbyColor(hobbyWeightedHours);

    // Update hobby left (REAL)
    document.getElementById('hobbyValueLeft').textContent = hobbyRawHours;
    document.getElementById('hobbyValueLeft').style.color = hobbyColor;
    document.getElementById('hobbyLabelLeft').style.color = hobbyColor;
    createMiniPie('hobbyPieLeft', hobbyRawHours, 21, hobbyColor, 1.0);

    // Update hobby right (FEELS LIKE)
    document.getElementById('hobbyValueRight').textContent = hobbyWeightedHours;
    document.getElementById('hobbyValueRight').style.color = hobbyWeightedColor;
    document.getElementById('hobbyValueRight').style.opacity = '0.4';
    document.getElementById('hobbyLabelRight').style.color = hobbyWeightedColor;
    document.getElementById('hobbyLabelRight').style.opacity = '0.4';
    createMiniPie('hobbyPieRight', hobbyWeightedHours, 21, hobbyWeightedColor, 0.4);

    // Show work raw + weighted in hours (multiply by 2)
    const workRawHours = Math.round((latest.work_raw * 2) / 60);
    const workWeightedHours = Math.round((latest.work_weighted * 2) / 60);
    const workColor = getWorkColor(workRawHours);
    const workWeightedColor = getWorkColor(workWeightedHours);

    // Update work left (REAL)
    document.getElementById('workValueLeft').textContent = workRawHours;
    document.getElementById('workValueLeft').style.color = workColor;
    document.getElementById('workLabelLeft').style.color = workColor;
    createMiniPie('workPieLeft', workRawHours, 21, workColor, 1.0);

    // Update work right (FEELS LIKE)
    document.getElementById('workValueRight').textContent = workWeightedHours;
    document.getElementById('workValueRight').style.color = workWeightedColor;
    document.getElementById('workValueRight').style.opacity = '0.4';
    document.getElementById('workLabelRight').style.color = workWeightedColor;
    document.getElementById('workLabelRight').style.opacity = '0.4';
    createMiniPie('workPieRight', workWeightedHours, 21, workWeightedColor, 0.4);

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
