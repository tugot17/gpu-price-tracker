#!/usr/bin/env python3
"""
GPU Price Tracker - Storage Efficient Version
Stores only aggregated statistics to minimize git repo size.
"""

import gzip
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

from prime_cli.api import APIClient
from prime_cli.api.availability import AvailabilityClient


# GPU types to track
# For GPUs with different socket types, we track them separately
GPU_TYPES = [
    "B200_180GB",
    "H200_96GB",
    "H200_141GB",
    "H100_80GB",  # Will be split by socket type (SXM5 vs PCIe)
    "GH200_96GB",
    "GH200_480GB",
    "GH200_624GB",
    "A100_80GB",  # Will be split by socket type (SXM4 vs PCIe)
]

# Socket types to track separately for certain GPUs
# These have significantly different performance characteristics
SOCKET_TYPES_TO_TRACK = {
    "H100_80GB": ["SXM5", "PCIe"],
    "A100_80GB": ["SXM4", "PCIe"],
}

# Data directories
DATA_DIR = Path(__file__).parent / "data"
SUMMARY_DIR = DATA_DIR / "summary"
FULL_SNAPSHOTS_DIR = DATA_DIR / "full_snapshots"  # Git-ignored


def calculate_percentile(values: List[float], percentile: int) -> float:
    """Calculate percentile from sorted values."""
    if not values:
        return 0.0
    idx = int(len(values) * percentile / 100)
    return round(values[min(idx, len(values) - 1)], 2)


def aggregate_statistics(configurations: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Calculate aggregated statistics without storing all configs."""
    if not configurations:
        return None

    # Filter out infinite prices
    valid_configs = [c for c in configurations if c["price_per_hour"] != float("inf")]
    if not valid_configs:
        return None

    # Calculate price per GPU (total price / number of GPUs)
    prices = sorted([c["price_per_hour"] / c["gpu_count"] for c in valid_configs])

    # Overall price statistics
    price_stats = {
        "min": round(min(prices), 2),
        "p10": calculate_percentile(prices, 10),
        "p25": calculate_percentile(prices, 25),
        "median": calculate_percentile(prices, 50),
        "p75": calculate_percentile(prices, 75),
        "p90": calculate_percentile(prices, 90),
        "max": round(max(prices), 2),
        "mean": round(sum(prices) / len(prices), 2),
    }

    # Availability by stock status
    availability = {
        "total": len(valid_configs),
        "available": len([c for c in valid_configs if c["stock_status"] == "Available"]),
        "low": len([c for c in valid_configs if c["stock_status"] == "Low"]),
        "medium": len([c for c in valid_configs if c["stock_status"] == "Medium"]),
        "high": len([c for c in valid_configs if c["stock_status"] == "High"]),
    }

    # Group by provider
    by_provider = {}
    for config in valid_configs:
        provider = config["provider"]
        if provider not in by_provider:
            by_provider[provider] = []
        # Price per GPU
        price_per_gpu = config["price_per_hour"] / config["gpu_count"]
        by_provider[provider].append(price_per_gpu)

    provider_stats = {}
    for provider, provider_prices in by_provider.items():
        provider_stats[provider] = {
            "count": len(provider_prices),
            "min": round(min(provider_prices), 2),
            "avg": round(sum(provider_prices) / len(provider_prices), 2),
        }

    # Group by GPU count
    by_gpu_count = {}
    for config in valid_configs:
        count = config["gpu_count"]
        if count not in by_gpu_count:
            by_gpu_count[count] = []
        by_gpu_count[count].append(config)

    config_stats = {}
    for count, configs in by_gpu_count.items():
        config_key = f"{count}x"

        # Calculate prices per GPU
        prices_per_gpu = [c["price_per_hour"] / c["gpu_count"] for c in configs]

        # Find the config with minimum price per GPU
        min_config = min(configs, key=lambda c: c["price_per_hour"] / c["gpu_count"])
        min_price_per_gpu = min_config["price_per_hour"] / min_config["gpu_count"]

        config_stats[config_key] = {
            "count": len(configs),
            "min_per_gpu": round(min_price_per_gpu, 2),
            "avg_per_gpu": round(sum(prices_per_gpu) / len(prices_per_gpu), 2),
            "min_total": round(min_config["price_per_hour"], 2),
            "avg_total": round(sum(prices_per_gpu) / len(prices_per_gpu) * count, 2),
            "best_deal": {
                "provider": min_config["provider"],
                "location": min_config["location"],
                "socket": min_config["socket"],
                "spot": min_config["is_spot"],
            }
        }

    return {
        "price_stats": price_stats,
        "availability": availability,
        "by_provider": provider_stats,
        "by_config": config_stats,
    }


def save_snapshot(gpu_type: str, socket_type: str, timestamp: str, stats: Dict[str, Any]) -> None:
    """Append aggregated snapshot to JSONL file."""
    SUMMARY_DIR.mkdir(parents=True, exist_ok=True)

    # Include socket type in filename if specified
    filename = f"{gpu_type}_{socket_type}.jsonl" if socket_type else f"{gpu_type}.jsonl"
    filepath = SUMMARY_DIR / filename

    snapshot = {
        "timestamp": timestamp,
        "gpu_type": gpu_type,
        "socket_type": socket_type,
        **stats,
    }

    with open(filepath, "a") as f:
        f.write(json.dumps(snapshot) + "\n")


def save_full_snapshot(timestamp: str, all_configs: Dict[str, List[Dict[str, Any]]]) -> None:
    """Save full configurations to compressed file (git-ignored)."""
    FULL_SNAPSHOTS_DIR.mkdir(parents=True, exist_ok=True)

    # Filename: YYYY-MM-DDTHH-MM-SS.json.gz
    filename = timestamp.replace(":", "-").split("+")[0] + ".json.gz"
    filepath = FULL_SNAPSHOTS_DIR / filename

    data = {
        "timestamp": timestamp,
        "configurations": all_configs,
    }

    with gzip.open(filepath, "wt", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    return filepath


def fetch_gpu_prices(gpu_type: str, client: AvailabilityClient) -> List[Dict[str, Any]]:
    """Fetch pricing data for a specific GPU type."""
    print(f"Fetching prices for {gpu_type}...")

    try:
        availability_data = client.get(gpu_type=gpu_type)

        configurations = []
        for gpu_type_key, gpus in availability_data.items():
            for gpu in gpus:
                config = {
                    "cloud_id": gpu.cloud_id,
                    "gpu_count": gpu.gpu_count,
                    "socket": gpu.socket or "N/A",
                    "provider": gpu.provider or "unknown",
                    "location": gpu.country or "N/A",
                    "stock_status": gpu.stock_status,
                    "price_per_hour": gpu.prices.price,
                    "is_spot": gpu.is_spot or False,
                    "security": gpu.security or "N/A",
                    "vcpus": gpu.vcpu.default_count if gpu.vcpu else None,
                    "memory_gb": gpu.memory.default_count if gpu.memory else None,
                    "gpu_memory_gb": gpu.gpu_memory,
                }
                configurations.append(config)

        print(f"  Found {len(configurations)} configurations")
        return configurations

    except Exception as e:
        print(f"  Error fetching {gpu_type}: {e}")
        return []


def main():
    """Main function to fetch and store GPU prices efficiently."""
    print("=" * 60)
    print("GPU Price Tracker (Storage Efficient)")
    print("=" * 60)

    # Initialize API client
    api_client = APIClient()
    availability_client = AvailabilityClient(api_client)

    # Current timestamp
    timestamp = datetime.now(timezone.utc).isoformat()

    # Store all configurations for full snapshot
    all_configs = {}

    # Fetch prices for each GPU type
    for gpu_type in GPU_TYPES:
        configurations = fetch_gpu_prices(gpu_type, availability_client)

        if not configurations:
            print(f"  Skipping {gpu_type} (no data)")
            continue

        # Store for full snapshot
        all_configs[gpu_type] = configurations

        # Check if we should track socket types separately
        if gpu_type in SOCKET_TYPES_TO_TRACK:
            socket_types = SOCKET_TYPES_TO_TRACK[gpu_type]

            for socket_type in socket_types:
                # Filter configurations by socket type
                socket_configs = [c for c in configurations if c["socket"] == socket_type]

                if not socket_configs:
                    print(f"  Skipping {gpu_type} {socket_type} (no data)")
                    continue

                print(f"\n  {gpu_type} ({socket_type})")

                # Calculate aggregated statistics
                stats = aggregate_statistics(socket_configs)
                if stats:
                    save_snapshot(gpu_type, socket_type, timestamp, stats)
                    print(f"    Stats: ${stats['price_stats']['min']} - ${stats['price_stats']['max']} per GPU "
                          f"(avg: ${stats['price_stats']['mean']}, median: ${stats['price_stats']['median']})")
                    print(f"    Available configs: {stats['availability']['available']}/{stats['availability']['total']}")
        else:
            # No socket type separation
            print(f"\n  {gpu_type}")

            # Calculate aggregated statistics
            stats = aggregate_statistics(configurations)
            if stats:
                save_snapshot(gpu_type, None, timestamp, stats)
                print(f"    Stats: ${stats['price_stats']['min']} - ${stats['price_stats']['max']} per GPU "
                      f"(avg: ${stats['price_stats']['mean']}, median: ${stats['price_stats']['median']})")
                print(f"    Available configs: {stats['availability']['available']}/{stats['availability']['total']}")

    # Save full snapshot (compressed, git-ignored)
    if all_configs:
        snapshot_path = save_full_snapshot(timestamp, all_configs)
        print(f"\nFull snapshot saved: {snapshot_path}")

    print("\n" + "=" * 60)
    print("Tracking complete!")
    print(f"Summary files: {SUMMARY_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
