#!/usr/bin/env python3
"""
run_benchmark.py — Root-Level Benchmark Launcher for Hackathon Judges

Usage:
  python run_benchmark.py                # Run full benchmark with 10,000 iterations
  python run_benchmark.py 25000          # Run 25,000 iterations
  python run_benchmark.py --fast         # Quick 2,500 iteration smoke test
  python run_benchmark.py --http-only    # Test ASGI HTTP endpoint latency only
"""

import sys
import os
import argparse

# Force UTF-8 output on Windows terminals
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure project root is in sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from benchmarks.guardrail_stress_test import (
    run_in_process_benchmark,
    run_http_endpoint_benchmark,
)


def main():
    parser = argparse.ArgumentParser(
        description="Deterministic Guardrail Gate High-Throughput Stress Test Launcher",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_benchmark.py
  python run_benchmark.py 25000
  python run_benchmark.py --fast
  python run_benchmark.py --http-only
        """
    )
    parser.add_argument(
        "count",
        nargs="?",
        type=int,
        default=10000,
        help="Number of in-process guardrail decisions to evaluate (default: 10,000)"
    )
    parser.add_argument(
        "--fast",
        action="store_true",
        help="Run a rapid 2,500 iteration smoke benchmark"
    )
    parser.add_argument(
        "--http-only",
        action="store_true",
        help="Run ASGI HTTP endpoint evaluation only"
    )

    args = parser.parse_args()

    iterations = 2500 if args.fast else args.count

    print("\n" + "=" * 62)
    print("  🚀 RAZORPAY BUILDATHON 2026 — PERFORMANCE BENCHMARK SUITE")
    print("  Target SLA: >= 1,500 decisions/sec with < 5.0ms P99 Latency")
    print("=" * 62)

    if not args.http_only:
        res1 = run_in_process_benchmark(iterations)
        if not res1.get("sla_passed", False):
            print("  [!] Warning: Guardrail Gate fell below SLA target.")
            sys.exit(1)

    http_count = min(iterations, 3000)
    res2 = run_http_endpoint_benchmark(http_count)

    print("=" * 62)
    print("  ✨ BENCHMARK COMPLETE — DETAILED REPORT IN PERFORMANCE_BENCHMARK.md")
    print("=" * 62 + "\n")


if __name__ == "__main__":
    main()
