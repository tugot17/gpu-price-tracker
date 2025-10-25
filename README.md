# Compute Price Tracker

[![CI](https://github.com/tugot17/gpu-price-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/tugot17/gpu-price-tracker/actions/workflows/ci.yml)
[![Website](https://img.shields.io/badge/website-live-brightgreen)](https://tugot17.github.io/gpu-price-tracker/website/)

Providing transparency and open data for datacenter GPU compute markets. Built for [Tensor Economics](https://www.tensoreconomics.com/).

## Live Dashboard

🌐 **[View Live Dashboard](https://tugot17.github.io/gpu-price-tracker/website/)**

Price trends, best deals, and provider comparisons updated every 30 minutes. Data sourced from [Prime Intellect](https://primeintellect.ai)'s aggregated marketplace.

## Setup

```bash
# Install uv (if not already installed)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install dependencies
uv sync

# Login to Prime Intellect
prime login
```

## Usage

### Track prices

```bash
python track_prices_efficient.py
```

This saves:
- Price stats to `data/summary/*.jsonl` (~5KB per snapshot, tracked in git)
- Compressed raw data to `data/full_snapshots/` (~3KB per snapshot, git-ignored)

### View the dashboard

```bash
cd website
python3 -m http.server 8000
# Open http://localhost:8000
```

The dashboard shows:
- Price trends over the last 7 days
- Best deals by GPU configuration (1x, 8x, 16x, etc.)
- Provider comparison
- Current availability

### CLI viewer

```bash
# Latest prices for all GPUs
python view_prices.py latest

# Latest for specific GPU
python view_prices.py latest H100_80GB

# Price trend over 24 hours
python view_prices.py trend H100_80GB 24
```

## What gets tracked

The script monitors these GPUs:
- B200 180GB
- H200 141GB
- H100 80GB (SXM5 and PCIe tracked separately)
- GH200 96GB / 480GB / 624GB
- A100 80GB (SXM4 and PCIe tracked separately)

For each snapshot (every 30 minutes), it calculates:
- Price percentiles (min, p10, p25, median, p75, p90, max)
- Availability by stock status
- Breakdown by provider
- Cheapest config for each GPU count

## Data format

Each line in `data/summary/*.jsonl`:

```json
{
  "timestamp": "2025-10-19T22:00:00Z",
  "gpu_type": "H100_80GB",
  "socket_type": "SXM5",
  "price_stats": {
    "min": 1.0,
    "median": 1.99,
    "max": 3.29,
    "mean": 2.2
  },
  "availability": {
    "total": 39,
    "available": 11
  },
  "by_provider": {
    "hyperstack": {"count": 1, "min": 2.4, "avg": 2.4},
    "primecompute": {"count": 4, "min": 1.0, "avg": 1.4}
  },
  "by_config": {
    "1x": {"count": 5, "min_per_gpu": 2.12, "avg_per_gpu": 2.71},
    "8x": {"count": 9, "min_per_gpu": 1.0, "avg_per_gpu": 1.8}
  }
}
```


## Files

```
track_prices_efficient.py   # Main tracking script
view_prices.py              # CLI for viewing data
website/                    # Web dashboard
  ├── index.html
  ├── styles.css
  └── app.js
data/
  ├── summary/              # Stats (git-tracked)
  └── full_snapshots/       # Raw data (git-ignored)
```


## Example output

```
$ python view_prices.py latest H100_80GB_SXM5

H100_80GB_SXM5
--------------------------------------------------------------------------------
Last updated: 2025-10-19 22:00:00 UTC
Total configs: 39
Available: 11

Price Range: $1.00 - $3.29 per GPU
  Mean:   $2.20
  Median: $1.99
  P10:    $1.80
  P90:    $2.71

By Provider:
  primecompute   :   4 configs, $   1.00 - $   1.40 avg
  dc_roan        :  21 configs, $   1.99 - $   2.09 avg
  nebius         :   4 configs, $   2.12 - $   2.12 avg

By Configuration:
  1x  :   5 configs, $   2.12 min, $   2.71 avg
  8x  :   9 configs, $   1.00 min, $   1.80 avg
  16x :   3 configs, $   1.99 min, $   2.20 avg
```

## License

MIT - See [LICENSE](LICENSE) file for details.
