// Configuration
const DATA_BASE_URL = '../data'; // Adjust for GitHub Pages
let currentGPU = 'H100_80GB_SXM5';
let priceChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeGPUButtons();
    loadGPUData(currentGPU);
});

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

async function loadGPUData(gpuType) {
    try {
        // Load summary data
        const summaryData = await loadSummaryData(gpuType);

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

function updateStats(data) {
    if (!data || data.length === 0) {
        return;
    }

    // Get latest snapshot
    const latest = data[data.length - 1];

    // Update timestamp
    const timestamp = new Date(latest.timestamp);
    document.getElementById('lastUpdated').textContent = timestamp.toLocaleString();

    // Update stats cards
    document.getElementById('minPrice').textContent = `$${latest.price_stats.min}`;
    document.getElementById('medianPrice').textContent = `$${latest.price_stats.median}`;
    document.getElementById('available').textContent = latest.availability.available;
}

function updateChart(data) {
    if (!data || data.length === 0) {
        return;
    }

    // Get last 7 days of data
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentData = data.filter(d => {
        const date = new Date(d.timestamp);
        return date >= sevenDaysAgo;
    });

    // Prepare chart data
    const labels = recentData.map(d => {
        const date = new Date(d.timestamp);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
    });

    const minPrices = recentData.map(d => d.price_stats.min);
    const medianPrices = recentData.map(d => d.price_stats.median);
    const maxPrices = recentData.map(d => d.price_stats.max);

    // Destroy existing chart
    if (priceChart) {
        priceChart.destroy();
    }

    // Create new chart
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
                        color: '#191919',
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
                    backgroundColor: 'rgba(255, 255, 255, 0.95)',
                    titleColor: '#191919',
                    bodyColor: '#666666',
                    borderColor: '#E6E6E6',
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
                        color: '#E6E6E6',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666666',
                        font: {
                            size: 12
                        }
                    }
                },
                y: {
                    grid: {
                        color: '#E6E6E6',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#666666',
                        font: {
                            size: 12
                        },
                        callback: function(value) {
                            return '$' + value;
                        }
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
