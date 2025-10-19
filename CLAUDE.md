# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

GPU price tracker that monitors datacenter GPU pricing from Prime Intellect's aggregated marketplace. Runs automatically every 4 hours via GitHub Actions.

## Project Structure

```
.
├── track_prices_efficient.py    # Main price tracking script
├── view_prices.py                # CLI viewer for data analysis
├── website/                      # Static website (GitHub Pages)
│   ├── index.html               # Dashboard with charts
│   ├── styles.css               # Dark theme styling
│   └── app.js                   # Data loading & Chart.js
├── data/
│   ├── summary/                 # Aggregated stats (git-tracked)
│   └── full_snapshots/          # Raw data compressed (git-ignored)
└── .github/workflows/
    ├── track-prices.yml         # Runs every 4 hours
    └── deploy-pages.yml         # Auto-deploys website
```

## Key Concepts

### Price Per GPU
**IMPORTANT**: All prices are stored and displayed **per GPU**, not total price.
- API returns total price (e.g., 8x GPUs @ $64/hr)
- We calculate: `price_per_gpu = total_price / gpu_count`
- Example: 8x H100 @ $8/hr total = $1/GPU/hr

### Socket Type Separation
Different socket types are tracked separately:
- **H100_80GB**: Split into `H100_80GB_SXM5.jsonl` and `H100_80GB_PCIe.jsonl`
- **A100_80GB**: Split into `A100_80GB_SXM4.jsonl` and `A100_80GB_PCIe.jsonl`
- Other GPUs (B200, H200, GH200): No socket separation

Rationale: SXM5 and PCIe are fundamentally different products with different performance.

## Tracked GPUs

- B200_180GB (NVIDIA B200 180GB)
- H200_141GB (NVIDIA H200 141GB HBM3e)
- H100_80GB (NVIDIA H100 80GB HBM3) - SXM5 and PCIe variants
- GH200_96GB (NVIDIA Grace Hopper 96GB)
- A100_80GB (NVIDIA A100 80GB HBM2e) - SXM4 and PCIe variants

## Data Format

### Summary Files (`data/summary/*.jsonl`)
Line-delimited JSON, one snapshot per line. Each line contains:
```json
{
  "timestamp": "2025-10-19T20:20:11Z",
  "gpu_type": "H100_80GB",
  "socket_type": "SXM5",
  "price_stats": {
    "min": 1.0,        // per GPU
    "median": 1.99,    // per GPU
    "max": 3.29        // per GPU
  },
  "by_provider": {
    "runpod": {"count": 7, "min": 2.69, "avg": 2.7}
  },
  "by_config": {
    "8x": {
      "count": 9,
      "min_per_gpu": 1.0,       // per GPU price
      "avg_per_gpu": 1.58,
      "min_total": 8.0,         // total price for 8 GPUs
      "avg_total": 12.64,
      "best_deal": {            // provider with min price
        "provider": "primecompute",
        "location": "US",
        "socket": "SXM5",
        "spot": true
      }
    }
  }
}
```

## Common Commands

### Development
```bash
# Install dependencies
uv sync

# Or with pip
pip install prime

# Authenticate
prime login

# Run tracker once
python track_prices_efficient.py

# View latest prices
python view_prices.py latest
python view_prices.py latest H100_80GB

# View price trends
python view_prices.py trend H100_80GB 24
```

### Website
```bash
# Test website locally (serve from project root, not website/)
python3 -m http.server 8000
# Open http://localhost:8000/website/
```

## GitHub Actions

### track-prices.yml
- Runs every 4 hours at :05 past the hour
- Uses `PRIME_API_KEY` secret (set in repository settings)
- Installs Prime SDK dependencies
- Runs `track_prices_efficient.py`
- Auto-commits new data files
- Requires: Actions with read/write permissions enabled

### deploy-pages.yml
- Triggers on pushes to `main` branch (website/ or data/ changes)
- Deploys entire repo to GitHub Pages
- Website accessible at: `https://USERNAME.github.io/REPO/website/`
- Requires: GitHub Pages enabled with "GitHub Actions" source

## Storage Strategy

**Git-tracked** (~11MB/year):
- `data/summary/*.jsonl` - Aggregated statistics with best deals (~5KB per snapshot)

**Git-ignored**:
- `data/full_snapshots/*.json.gz` - Complete raw data (~3KB compressed)
- `.venv/` - Python virtual environment

**Why this matters**: Storing raw data would be 350MB/year. Current approach is 32x more efficient.

## API Integration

Uses Prime Intellect Python SDK:
```python
from prime_cli.api import APIClient
from prime_cli.api.availability import AvailabilityClient

api_client = APIClient()  # Reads PRIME_API_KEY from env or ~/.prime/config.json
availability_client = AvailabilityClient(api_client)
data = availability_client.get(gpu_type="H100_80GB")
```

## Website Architecture

- **Pure static site**: No backend, no build process
- **Chart.js**: For price trend visualizations
- **Data loading**: Fetches `.jsonl` files directly via fetch API
- **Dark theme**: Custom CSS with CSS variables
- **Responsive**: Mobile-friendly design

Data paths in `website/app.js`:
```javascript
const DATA_BASE_URL = '../data';  // Relative to website/ folder
```

## Important Notes

1. **Never commit large files**: Full snapshots go in `data/full_snapshots/` (git-ignored)
2. **Price calculations**: Always divide by GPU count to get per-GPU pricing
3. **Socket separation**: H100 and A100 are split by socket type in filenames
4. **JSONL format**: Summary files are line-delimited JSON (append-only)
5. **Best deals**: Provider info for best deals is included in `by_config.best_deal`

## Troubleshooting

**"No data in summary files"**: Run `python track_prices_efficient.py` at least once

**Website shows "Loading..."**:
- Verify data files exist in `data/summary/`
- Check browser console for fetch errors
- Ensure filenames match (e.g., `H100_80GB_SXM5.jsonl`)
- Serve from project root, not from `website/` directory

**GitHub Actions fails**:
- Check `PRIME_API_KEY` secret is set
- Verify Actions have write permissions
- Review workflow logs in Actions tab

**Wrong prices displayed**:
- Verify calculations divide by `gpu_count`
- Check that socket types are separated correctly

## Development Guidelines

- Keep storage efficient (aggregate, don't store raw)
- All prices must be per-GPU calculations
- Test locally before committing
- Socket separation is mandatory for H100 and A100
- Website should work without build step
