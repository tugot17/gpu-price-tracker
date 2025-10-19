#!/usr/bin/env python3
"""
View GPU Price Data
Simple CLI to view tracked pricing data and trends.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any


DATA_DIR = Path(__file__).parent / "data"
SUMMARY_DIR = DATA_DIR / "summary"


def load_snapshots(gpu_type: str, socket_type: str = None) -> List[Dict[str, Any]]:
    """Load all snapshots for a GPU type from JSONL file."""
    if socket_type:
        filepath = SUMMARY_DIR / f"{gpu_type}_{socket_type}.jsonl"
    else:
        filepath = SUMMARY_DIR / f"{gpu_type}.jsonl"

    if not filepath.exists():
        return []

    snapshots = []
    with open(filepath, "r") as f:
        for line in f:
            snapshots.append(json.loads(line))

    return snapshots


def format_timestamp(iso_timestamp: str) -> str:
    """Format ISO timestamp to readable string."""
    dt = datetime.fromisoformat(iso_timestamp)
    return dt.strftime("%Y-%m-%d %H:%M:%S UTC")


def show_latest_prices(gpu_type: str = None):
    """Show latest prices for GPU type(s)."""
    print("=" * 80)
    print("Latest GPU Prices (per GPU)")
    print("=" * 80)

    # GPU types that have socket-specific tracking
    socket_tracked = {
        "H100_80GB": ["SXM5", "PCIe"],
        "A100_80GB": ["SXM4", "PCIe"],
    }

    if gpu_type:
        gpu_types = [gpu_type]
    else:
        gpu_types = ["B200_180GB", "H200_141GB", "H100_80GB", "GH200_96GB", "A100_80GB"]

    for gpu in gpu_types:
        # Check if this GPU has socket-specific tracking
        if gpu in socket_tracked:
            for socket in socket_tracked[gpu]:
                snapshots = load_snapshots(gpu, socket)
                if not snapshots:
                    continue

                latest = snapshots[-1]
                print(f"\n{gpu} ({socket})")
                print("-" * 80)
                _print_gpu_details(latest)
        else:
            snapshots = load_snapshots(gpu)
            if not snapshots:
                continue

            latest = snapshots[-1]
            print(f"\n{gpu}")
            print("-" * 80)
            _print_gpu_details(latest)


def _print_gpu_details(latest: Dict[str, Any]):
    """Print details for a GPU snapshot."""
    print(f"Last updated: {format_timestamp(latest['timestamp'])}")
    print(f"Total configs: {latest['availability']['total']}")
    print(f"Available: {latest['availability']['available']}")

    stats = latest['price_stats']
    print(f"\nPrice Range (per GPU): ${stats['min']} - ${stats['max']}")
    print(f"  Mean:   ${stats['mean']}")
    print(f"  Median: ${stats['median']}")
    print(f"  P10:    ${stats['p10']}")
    print(f"  P90:    ${stats['p90']}")

    print("\nBy Provider (per GPU):")
    for provider, pstats in sorted(latest['by_provider'].items()):
        print(f"  {provider:15s}: {pstats['count']:3d} configs, "
              f"${pstats['min']:7.2f} - ${pstats['avg']:7.2f} avg")

    print("\nBy Configuration:")
    for config, cstats in sorted(latest['by_config'].items(),
                                 key=lambda x: int(x[0].rstrip('x'))):
        print(f"  {config:4s}: {cstats['count']:3d} configs, "
              f"${cstats['min_per_gpu']:7.2f}/GPU (${cstats['min_total']:8.2f} total)")


def show_price_trend(gpu_type: str, hours: int = 24):
    """Show price trend over time."""
    snapshots = load_snapshots(gpu_type)

    if not snapshots:
        print(f"No data for {gpu_type}")
        return

    print("=" * 80)
    print(f"Price Trend: {gpu_type} (last {hours} hours)")
    print("=" * 80)

    # Filter to last N hours
    now = datetime.now()
    recent = []
    for snap in snapshots:
        dt = datetime.fromisoformat(snap['timestamp'])
        hours_ago = (now - dt.replace(tzinfo=None)).total_seconds() / 3600
        if hours_ago <= hours:
            recent.append(snap)

    if not recent:
        print(f"No data in the last {hours} hours")
        return

    print(f"\nTimestamp                  | Min    | Median | Mean   | Max     | Configs")
    print("-" * 80)

    for snap in recent:
        stats = snap['price_stats']
        avail = snap['availability']
        print(f"{format_timestamp(snap['timestamp']):23s} | "
              f"${stats['min']:6.2f} | ${stats['median']:6.2f} | "
              f"${stats['mean']:6.2f} | ${stats['max']:7.2f} | "
              f"{avail['total']:3d}")


def main():
    """Main CLI."""
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python view_prices.py latest [GPU_TYPE]")
        print("  python view_prices.py trend GPU_TYPE [HOURS]")
        print("\nExamples:")
        print("  python view_prices.py latest")
        print("  python view_prices.py latest H100_80GB")
        print("  python view_prices.py trend H100_80GB 48")
        return

    command = sys.argv[1]

    if command == "latest":
        gpu_type = sys.argv[2] if len(sys.argv) > 2 else None
        show_latest_prices(gpu_type)
    elif command == "trend":
        if len(sys.argv) < 3:
            print("Error: GPU type required for trend")
            return
        gpu_type = sys.argv[2]
        hours = int(sys.argv[3]) if len(sys.argv) > 3 else 24
        show_price_trend(gpu_type, hours)
    else:
        print(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
