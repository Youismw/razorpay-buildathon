"""
Locust Load Testing Suite for Agentic UPI Commerce Bridge (AP2 x Razorpay Autopay)
Target: Sustaining 1,500+ Decisions/sec with <5ms Latency on the Deterministic Guardrail Gate.

To run headless load test:
    locust -f benchmarks/locustfile.py --headless -u 100 -r 20 -t 30s --host http://localhost:8000
To run with interactive web UI:
    locust -f benchmarks/locustfile.py --host http://localhost:8000
"""

import random
from locust import HttpUser, task, between


class GuardrailStressUser(HttpUser):
    # Minimal wait time between requests to simulate saturated concurrent pipelines
    wait_time = between(0.001, 0.003)

    CANDIDATE_PRODUCTS = [
        {"id": "PROD-WH-CH520", "name": "Sony WH-CH520 Wireless Headphones", "price_paise": 460800},
        {"id": "PROD-SONY-WH-CH520-WIRELE", "name": "Sony WH-CH520 Wireless Headphones", "price_paise": 460800},
        {"id": "PROD-JBL-T350BT", "name": "JBL Tune 350BT On-Ear Wireless Headphones", "price_paise": 299900},
        {"id": "PROD-AMUL-GOLD", "name": "Amul Gold Pasteurized Full Cream Milk (1L)", "price_paise": 6800},
        {"id": "PROD-COFFEE-BT", "name": "Blue Tokai Attikan Estate Coffee Beans (250g)", "price_paise": 45000},
    ]

    @task(5)
    def evaluate_guardrail_decision(self):
        """
        Stress tests the 4-stage Deterministic Guardrail Gate (INV-002, INV-010).
        Verifies schema check, spending ceiling bound, catalog grounding, and confidence gating.
        """
        chosen = random.choice(self.CANDIDATE_PRODUCTS)
        payload = {
            "max_spend_inr": 5000.0,
            "allowed_merchant": "demo-merchant.myshopify.com",
            "proposal": {
                "proposal_id": f"prop-locust-{random.randint(1000, 9999)}",
                "intent_id": "intent-locust-001",
                "constraint_hash": "sha256:575baca9d093ff72095a5a0b83e5d3a44",
                "items": [{
                    "product_id": chosen["id"],
                    "product_name": chosen["name"],
                    "merchant_id": "demo-merchant.myshopify.com",
                    "offer_price_paise": chosen["price_paise"],
                    "quantity": 1,
                    "currency": "INR",
                }],
                "total_price_paise": chosen["price_paise"],
            }
        }

        with self.client.post("/api/guardrail/evaluate", json=payload, catch_response=True) as response:
            if response.status_code == 200:
                data = response.json()
                # Enforce < 5ms latency SLA on every request
                if data.get("latency_ms", 0) > 5.0:
                    response.failure(f"SLA Breach: latency {data.get('latency_ms')}ms exceeded 5.0ms ceiling")
                else:
                    response.success()
            else:
                response.failure(f"HTTP {response.status_code}: {response.text}")

    @task(1)
    def run_live_benchmark_batch(self):
        """Periodically requests the high-speed in-memory benchmark endpoint."""
        self.client.get("/api/guardrail/benchmark?iterations=500")

    @task(1)
    def health_check(self):
        """Verify server liveness and low jitter."""
        self.client.get("/healthz")
