// Configuration
const DATA_BASE_URL = '../data'; // Adjust for GitHub Pages
let currentGPU = 'H100_80GB_SXM5';
let currentTimeRange = 7; // days
let smoothEnabled = false;
let priceChart = null;
let allData = null; // Cache all data
let processedChartData = null; // Cache processed data for chart

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDarkMode();
    initializeGPUButtons();
    initializeTimeRangeButtons();
    initializeSmoothToggle();
    loadGPUData(currentGPU);
});

function initializeDarkMode() {
    const toggle = document.getElementById('darkModeToggle');
    const themeIcon = toggle.querySelector('.theme-icon');

    // Check current theme (already applied by inline script)
    const isDark = document.documentElement.classList.contains('dark-mode');

    // Set initial icon based on current theme
    themeIcon.textContent = isDark ? '☀️' : '🌙';

    // Toggle on click
    toggle.addEventListener('click', () => {
        const willBeDark = document.documentElement.classList.toggle('dark-mode');
        themeIcon.textContent = willBeDark ? '☀️' : '🌙';
        localStorage.setItem('theme', willBeDark ? 'dark' : 'light');

        // Update chart colors
        if (priceChart) {
            const colors = getChartColors();
            priceChart.options.scales.x.grid.color = colors.grid;
            priceChart.options.scales.x.ticks.color = colors.text;
            priceChart.options.scales.y.grid.color = colors.grid;
            priceChart.options.scales.y.ticks.color = colors.text;
            priceChart.options.plugins.legend.labels.color = colors.text;
            priceChart.options.plugins.tooltip.backgroundColor = colors.tooltipBg;
            priceChart.options.plugins.tooltip.titleColor = colors.tooltipTitle;
            priceChart.options.plugins.tooltip.bodyColor = colors.tooltipBody;
            priceChart.options.plugins.tooltip.borderColor = colors.tooltipBorder;
            priceChart.update();
        }
    });
}

function initializeGPUButtons() {
    const buttons = document.querySelectorAll('.gpu-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Load data for selected GPU
            currentGPU = btn.dataset.gpu;
            loadGPUData(currentGPU);
        });
    });
}

function initializeTimeRangeButtons() {
    const buttons = document.querySelectorAll('.time-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Update time range
            const days = btn.dataset.days;
            currentTimeRange = days === 'all' ? 'all' : parseInt(days);

            // Update chart with new time range
            if (allData) {
                updateChart(allData);
            }
        });
    });
}

function initializeSmoothToggle() {
    const toggle = document.getElementById('smoothToggle');
    toggle.addEventListener('change', (e) => {
        smoothEnabled = e.target.checked;
        if (allData) {
            updateChart(allData);
        }
    });
}

// Get theme-appropriate colors for chart from CSS variables
function getChartColors() {
    const styles = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.classList.contains('dark-mode');
    return {
        grid: styles.getPropertyValue('--border').trim(),
        text: styles.getPropertyValue('--text-secondary').trim(),
        tooltipBg: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
        tooltipTitle: styles.getPropertyValue('--text-primary').trim(),
        tooltipBody: styles.getPropertyValue('--text-secondary').trim(),
        tooltipBorder: styles.getPropertyValue('--border').trim()
    };
}

async function loadGPUData(gpuType) {
    try {
        // Load summary data
        const summaryData = await loadSummaryData(gpuType);

        // Cache all data
        allData = summaryData;

        // Update UI
        updateStats(summaryData);
        updateChart(summaryData);
        updateBestDealsTable(summaryData);
        updateProviderTable(summaryData);

    } catch (error) {
        console.error('Error loading data:', error);
        showError('Failed to load data. Please try again later.');
    }
}

async function loadSummaryData(gpuType) {
    const filename = `${gpuType}.jsonl`;
    const url = `${DATA_BASE_URL}/summary/${filename}`;

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load ${filename}`);
    }

    const text = await response.text();
    const lines = text.trim().split('\n').filter(line => line);
    const data = lines.map(line => JSON.parse(line));

    return data;
}

function updateStats(data, datapoint = null) {
    if (!data || data.length === 0) {
        return;
    }

    // Use selected datapoint or latest snapshot
    const snapshot = datapoint || data[data.length - 1];

    // Update timestamp
    const timestamp = new Date(snapshot.timestamp);
    document.getElementById('lastUpdated').textContent = timestamp.toLocaleString();

    // Update stats cards
    document.getElementById('minPrice').textContent = `$${snapshot.price_stats.min.toFixed(2)}`;
    document.getElementById('medianPrice').textContent = `$${snapshot.price_stats.median.toFixed(2)}`;

    // Only show availability if it exists (may not exist in aggregated data)
    if (snapshot.availability) {
        document.getElementById('available').textContent = snapshot.availability.total;
    }
}

// Helper: Aggregate data by period (day or week)
function aggregateData(data, period) {
    const grouped = {};

    data.forEach(d => {
        const date = new Date(d.timestamp);
        let key;

        if (period === 'day') {
            // Group by calendar day
            key = date.toISOString().split('T')[0];
        } else if (period === 'week') {
            // Group by week (Monday as start of week)
            const weekStart = new Date(date);
            const day = weekStart.getDay();
            const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
            weekStart.setDate(diff);
            key = weekStart.toISOString().split('T')[0];
        }

        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(d);
    });

    // Calculate averages for each period
    return Object.keys(grouped).sort().map(key => {
        const items = grouped[key];
        const avgMin = items.reduce((sum, d) => sum + d.price_stats.min, 0) / items.length;
        const avgMedian = items.reduce((sum, d) => sum + d.price_stats.median, 0) / items.length;
        const avgMax = items.reduce((sum, d) => sum + d.price_stats.max, 0) / items.length;

        // Use middle datapoint in period for timestamp and original data reference
        const middleIndex = Math.floor(items.length / 2);
        const middleItem = items[middleIndex];

        return {
            timestamp: middleItem.timestamp, // Use middle timestamp
            price_stats: {
                min: avgMin,
                median: avgMedian,
                max: avgMax
            },
            originalData: middleItem, // Keep reference to original datapoint
            isAggregated: true
        };
    });
}

// Helper: Apply EMA smoothing
function applyEMA(data, alpha = 0.3) {
    if (data.length === 0) return data;

    // Preserve original data reference for first element
    const smoothed = [{...data[0]}];

    for (let i = 1; i < data.length; i++) {
        smoothed.push({
            timestamp: data[i].timestamp,
            price_stats: {
                min: alpha * data[i].price_stats.min + (1 - alpha) * smoothed[i-1].price_stats.min,
                median: alpha * data[i].price_stats.median + (1 - alpha) * smoothed[i-1].price_stats.median,
                max: alpha * data[i].price_stats.max + (1 - alpha) * smoothed[i-1].price_stats.max
            },
            // Preserve original data reference if it exists
            originalData: data[i].originalData || data[i],
            isAggregated: data[i].isAggregated
        });
    }

    return smoothed;
}

function updateChart(data) {
    if (!data || data.length === 0) {
        return;
    }

    // Filter data based on time range
    let filteredData;
    if (currentTimeRange === 'all') {
        filteredData = data;
    } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - currentTimeRange);
        filteredData = data.filter(d => {
            const date = new Date(d.timestamp);
            return date >= cutoffDate;
        });
    }

    // Apply aggregation for longer periods (reduces noise)
    let processedData = filteredData;
    if (currentTimeRange === 14 || currentTimeRange === 30) {
        // 14-30 days: aggregate by day
        processedData = aggregateData(filteredData, 'day');
    } else if (currentTimeRange === 'all') {
        // All: aggregate by week
        processedData = aggregateData(filteredData, 'week');
    }

    // Apply EMA smoothing if enabled
    if (smoothEnabled) {
        processedData = applyEMA(processedData, 0.3);
    }

    // Smart date formatting based on time range
    const labels = processedData.map(d => {
        const date = new Date(d.timestamp);

        // For 24h: show time only
        if (currentTimeRange === 1) {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        // For 3-7 days: show date and time
        else if (currentTimeRange <= 7) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
        }
        // For 14-30 days: show date only
        else if (currentTimeRange <= 30) {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        // For longer periods: show month and year
        else {
            return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
    });

    const minPrices = processedData.map(d => d.price_stats.min);
    const medianPrices = processedData.map(d => d.price_stats.median);
    const maxPrices = processedData.map(d => d.price_stats.max);

    // Cache processed data for click handling
    processedChartData = processedData;

    // Update existing chart or create new one
    if (priceChart) {
        // Update data efficiently without destroying
        priceChart.data.labels = labels;
        priceChart.data.datasets[0].data = minPrices;
        priceChart.data.datasets[1].data = medianPrices;
        priceChart.data.datasets[2].data = maxPrices;
        priceChart.update();
        return;
    }

    // Create new chart only on first load
    const ctx = document.getElementById('priceChart').getContext('2d');
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Min Price',
                    data: minPrices,
                    borderColor: '#059669',
                    backgroundColor: 'rgba(5, 150, 105, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Median Price',
                    data: medianPrices,
                    borderColor: '#FF6719',
                    backgroundColor: 'rgba(255, 103, 25, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: false
                },
                {
                    label: 'Max Price',
                    data: maxPrices,
                    borderColor: '#DC2626',
                    backgroundColor: 'rgba(220, 38, 38, 0.1)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getChartColors().text,
                        font: {
                            size: 13,
                            weight: 500
                        },
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: getChartColors().tooltipBg,
                    titleColor: getChartColors().tooltipTitle,
                    bodyColor: getChartColors().tooltipBody,
                    borderColor: getChartColors().tooltipBorder,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: $${context.parsed.y}/GPU`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: getChartColors().grid,
                        drawBorder: false
                    },
                    ticks: {
                        color: getChartColors().text,
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: getChartColors().grid,
                        drawBorder: false
                    },
                    ticks: {
                        color: getChartColors().text,
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return '$' + value;
                        }
                    }
                }
            },
            onClick: (_event, activeElements) => {
                if (activeElements.length > 0 && processedChartData) {
                    const dataIndex = activeElements[0].index;

                    // Get the selected datapoint
                    const selectedData = processedChartData[dataIndex];

                    // Update stats with selected datapoint
                    // For aggregated data, use the original middle datapoint for full details
                    const datapointToShow = selectedData.originalData || selectedData;
                    updateStats(allData, datapointToShow);

                    // Also update tables if they need specific datapoint
                    if (datapointToShow.by_config) {
                        updateBestDealsTable([datapointToShow]);
                    }
                    if (datapointToShow.by_provider) {
                        updateProviderTable([datapointToShow]);
                    }
                }
            }
        }
    });
}

function updateBestDealsTable(data) {
    const tbody = document.getElementById('bestDealsBody');

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No deals available</td></tr>';
        return;
    }

    // Get latest snapshot
    const latest = data[data.length - 1];
    const byConfig = latest.by_config;

    if (!byConfig) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">No configuration data available</td></tr>';
        return;
    }

    // Extract and sort configurations
    // Format: "1x", "2x", "8x", etc.
    const configs = Object.entries(byConfig)
        .map(([key, stats]) => ({
            gpus: parseInt(key.replace('x', '')),
            pricePerGpu: stats.min_per_gpu,
            priceTotal: stats.min_total,
            count: stats.count,
            provider: stats.best_deal?.provider || 'N/A',
            location: stats.best_deal?.location || 'N/A',
            spot: stats.best_deal?.spot || false
        }))
        .sort((a, b) => a.gpus - b.gpus);

    // Build table rows
    const rows = configs.map(config => {
        const spotBadge = config.spot
            ? '<span class="spot-badge spot-yes">SPOT</span>'
            : '<span class="spot-badge spot-no">ON-DEMAND</span>';

        return `
            <tr>
                <td>${config.gpus}x</td>
                <td>$${config.pricePerGpu.toFixed(2)}</td>
                <td>$${config.priceTotal.toFixed(2)}</td>
                <td>${config.provider}</td>
                <td>${config.location}</td>
                <td>${spotBadge}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rows;
}

function updateProviderTable(data) {
    if (!data || data.length === 0) {
        return;
    }

    const latest = data[data.length - 1];
    const providers = latest.by_provider;

    const tbody = document.getElementById('providerBody');

    // Sort providers by min price
    const sortedProviders = Object.entries(providers).sort((a, b) => a[1].min - b[1].min);

    const rows = sortedProviders.map(([name, stats]) => `
        <tr>
            <td>${name}</td>
            <td>${stats.count}</td>
            <td>$${stats.min}</td>
            <td>$${stats.avg}</td>
        </tr>
    `).join('');

    tbody.innerHTML = rows;
}

function showError(message) {
    // Simple error display
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'background: #ef4444; color: white; padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;';
    errorDiv.textContent = message;
    container.insertBefore(errorDiv, container.firstChild);
}
