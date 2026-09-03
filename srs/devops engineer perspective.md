# ***Questions*** 



&#x20;\[by AI / LLM Engineer = Hardware Enclave Isolation: How will we architect the runtime deployment for the Mandate Vault (e.g., AWS Nitro Enclaves, Azure Confidential Computing, or GCP Confidential VMs) to guarantee that host-level container processes and LLM execution environments can never inspect private Ed25519 signing key memory during token generation?

\* Zero-Trust Network Egress: What network-level isolation policies (e.g., eBPF/Cilium rules, mesh sidecars) will be applied to LLM reasoning sub-agents to physically block egress traffic to external payment gateways or unvetted IPs, ensuring security even in the event of a successful prompt injection exploit?

\* CI/CD Benchmarking \& Tracing: How will the CI/CD deployment pipeline automate pre-release evaluation gates (specifically running prompt-injection red-teaming suites and Pydantic schema breakage checks), and what OpenTelemetry context-propagation standard will correlate parallel sub-agent logs to the append-only ledger? , by Technical Lead + Backend Engineer = 1. Containerization and Local Orchestration

Given our architecture spans Python (FastAPI), Node.js, PostgreSQL, Redis, and potentially Vault, what specific Docker Compose configuration will give us a single-command reproducible environment for local development and the buildathon demo?

&#x20; \* How do we define service dependencies, health checks, and secure environment variable injection so that no secrets (Razorpay keys, signing keys) are baked into images or the compose file itself?

&#x20; 2. CI/CD and Automated Testing

For the MVP, what minimal CI/CD pipeline (e.g., GitHub Actions) should we set up to run unit tests, integration tests, and linting automatically on every commit?

&#x20; \* What is the exact mechanism for injecting Razorpay test-mode credentials and other secrets into the CI environment without exposing them in logs or configuration files?

&#x20; \* Do we need separate pipelines for the AP2 samples repo and our own services, or can one repository suffice?

&#x20; 3. Observability Stack in a Resource-Constrained Demo

We have mandated OpenTelemetry, Prometheus, Grafana, and Jaeger for tracing and metrics. What is the minimal Docker Compose setup to run these alongside our core services on a typical laptop?

&#x20; \* How do we configure the Python and Node.js services to export telemetry to Jaeger/Prometheus with low overhead, and ensure the transaction\_id context propagation is visible in a single Jaeger trace for QA to debug a failed end-to-end payment?

&#x20; \* Are there any lightweight alternatives we should consider for the demo (e.g., using Jaeger all-in-one, disabling Prometheus long-term storage) to keep resource usage within acceptable limits? , by QA Engineer = Observability: What specific GenAI telemetry (token usage, prompt injection flags, grounding mismatch counts) must be exported to our monitoring stack, and what are the alerting thresholds?

&#x20; \* Secrets \& Keys: Where are the AP2 signing keys and third-party API keys stored, and what is the exact mechanism for injecting them into the runtime without exposing them in logs or CI/CD artifacts?

&#x20; \* Cost \& Abuse Guardrails: What infrastructure-level limits (e.g., max concurrent LLM calls per minute, max daily API spend) must be enforced to prevent runaway agent behavior?

&#x20; \* State Persistence: For the Mandate Vault and Redis cart locks, what is the minimum durability requirement (e.g., RDB snapshots every X minutes, AOF enabled) to survive a pod eviction during an active negotiation? , by Cryptography / Security Engineer = DevOps Q1 — Deployment \& trust isolation

&#x20;   How should the Mandate Vault, LLM agent, guardrail service, payment adapter, and audit ledger be isolated at runtime (containers/services/network boundaries), and which service-to-service communications require authenticated TLS/mTLS?

&#x20;   This gives us SRS requirements for:

&#x20;   \* deployment topology;

&#x20;   \* network segmentation;

&#x20;   \* service authentication;

&#x20;   \* Vault isolation.

&#x20;   DevOps Q2 — Secrets, CI/CD \& supply chain

&#x20;   What is the required lifecycle for secrets and cryptographic configuration across development, CI, staging, and production, and what controls must prevent credentials or compromised dependencies from entering the deployed artifact?

&#x20;   This captures:

&#x20;   \* secret injection;

&#x20;   \* environment separation;

&#x20;   \* secret rotation;

&#x20;   \* CI/CD permissions;

&#x20;   \* dependency/image verification;

&#x20;   \* SBOM/signing if we choose to go that far.

&#x20;   DevOps Q3 — Observability, recovery \& incident response

&#x20;   What security events must be monitored and alerted on, what logs/metrics must be retained, and what are the recovery/rollback requirements if the Vault, policy engine, or payment adapter is compromised or unavailable?

&#x20;   This gives us:

&#x20;   \* security monitoring;

&#x20;   \* audit-log retention;

&#x20;   \* alerting;

&#x20;   \* availability requirements;

&#x20;   \* fail-closed behavior;

&#x20;   \* rollback/recovery. , by system Architect / Protocol Engineer = DevOps Lead — Question 1: Observability Contract Across the Deterministic Sandwich

&#x20;     The Question: Our architecture has a probabilistic core (LLM via MCP) sandwiched between two deterministic shells (Constraint Compiler / Guardrail Shell). A single checkout session may span Python (Modules 1, 4, 5, 6), Node.js (Module 3), and an external LLM API. What is the exact observability contract for correlating a single mandate across these boundaries? Specifically:

&#x20;     \* What are the mandatory span tags and trace context propagation rules (e.g., OpenTelemetry traceparent) that must survive the Python → LLM API → Python round-trip?

&#x20;     \* How do we guarantee that the constraint\_hash output by the Constraint Compiler, the llm\_invocation\_id of the reasoning call, and the final payment\_mandate\_nonce all appear in a single queryable trace?

&#x20;     \* What is the retention policy for these traces, and which fields are considered PII that must be redacted before long-term storage (e.g., the LLM's reasoning string may contain user intent details)?

&#x20;     Why this matters for SRS: If we cannot reconstruct the full decision chain for a rejected or disputed mandate in under 30 seconds during a 2 AM incident, the system is not production-operable. The SRS must specify the telemetry schema, propagation rules, and retention SLAs as hard non-functional requirements. Without this, debugging a "why did the guardrail reject this offer?" failure becomes a forensic exercise across four runtimes and an external API.

&#x20;     DevOps Lead — Question 2: Secret Lifecycle \& Cryptographic Key Management

&#x20;     The Question: The system relies on ECDSA P-256 signing keys for AP2 mandates, DID document resolution, and JWS verification of A2A Agent Cards and UCP manifests. These keys are the root of trust. What is the exact secret management topology for the MVP?

&#x20;     \* Are DID signing keys generated inside an HSM (AWS CloudHSM, HashiCorp Vault with PKCS#11, or Google Cloud KMS) and exposed to the application runtime only as signing handles, or are they software keys injected via environment variables / Kubernetes secrets at container startup?

&#x20;     \* What is the key rotation playbook: can a DID key be rotated without restarting the Commerce Engine (Module 3) or Payment Adapter (Module 5), and how does the system handle the transition window where old mandates (signed with the previous key) must still verify?

&#x20;     \* How do we prevent key material from persisting in container image layers, build caches, or pod crash dumps? Specifically, what is the policy for cryptography library ephemeral key buffers and Python core dumps in the runtime environment?

&#x20;     Why this matters for SRS: A leaked DID private key is not a patchable bug — it is a catastrophic trust failure that invalidates every mandate ever signed by that identity. The Crypto/Security Engineer defined the signing algorithm, but the SRS must also specify the deployment-time secret contract: how keys enter the system, how long they live in memory, and how they exit. If we discover in Week 3 that our container image contains a .env file with a test key that accidentally became the production signing key, the architecture collapses.

&#x20;     DevOps Lead — Question 3: Ledger Infrastructure, Disaster Recovery \& Environment Parity

&#x20;     The Question: The external ledger (PostgreSQL with outbox pattern) is the single source of truth for mandate state, revocation, and audit. Its consistency and recoverability are security-critical. What is the infrastructure contract for this component?

&#x20;     \* What is the exact RPO (Recovery Point Objective) and RTO (Recovery Time Objective) for the ledger? If the primary PostgreSQL cluster fails, do we failover to a hot standby (synchronous replication), a warm replica (asynchronous), or a point-in-time restore from WAL archives? How does each option affect the append-only ordering invariant and the consumed\_nonces set?

&#x20;     \* How do we maintain environment parity between staging and production when the system depends on external sandbox APIs (Razorpay test mode, Shopify development stores) that have different rate limits, data shapes, and latency profiles than production? Is staging a scaled-down clone of prod topology, or a hermetic simulation with mocked merchants?

&#x20;     \* What is the cost guardrail policy for LLM API calls? The AI/LLM Engineer defined a 10-round negotiation limit, but a misconfigured load test or a runaway buyer agent could generate thousands of LLM invocations per hour. What infrastructure-level rate limiter, budget alert, or circuit breaker prevents unbounded cloud spend on the LLM backend?

&#x20;     Why this matters for SRS: The Technical Lead defined the ledger as the SSOT for revocation, but the SRS must also specify the infrastructure guarantee that makes that claim true. If we can only restore the ledger to a 1-hour-old backup, we lose an hour of mandate revocations — meaning a revoked mandate could be executed post-recovery. Additionally, if staging does not enforce the same consistency model as prod, we cannot safely test mandate revocation flows. The cost guardrail is a business continuity requirement: a single bug in the negotiation loop could exhaust the cloud budget before the Policy Engine's round limit even triggers.

&#x20;     

]



# ***ANSWERS***



\*\*DevOps Engineer responses\*\* (answers framed for direct inclusion in the SRS Non-Functional Requirements, Deployment Topology, Security Controls, Observability, and CI/CD sections). All answers are scoped first to the \*\*MVP / buildathon demo\*\* (single-host or lightweight cloud, Razorpay test-mode, public GitHub repo) with explicit notes on the production-grade path.



\### Answers to AI / LLM Engineer



\*\*1. Hardware Enclave Isolation (Mandate Vault / Ed25519 or ECDSA signing keys)\*\*  

\*\*MVP decision:\*\* No hardware enclaves. The Mandate Vault runs as a separate container (or process) that holds signing keys only in memory after injection from a secrets manager / environment (never written to disk inside the container). Keys are loaded at startup via a short-lived volume or Kubernetes/Docker secret mount that is tmpfs-backed where possible. LLM execution environments run in completely separate containers with no shared memory, no shared volumes, and no network path to the Vault except through a narrow, authenticated gRPC/HTTP signing API that accepts only the payload-to-sign and returns the signature.  



\*\*Production path (post-MVP):\*\* Move the Vault to AWS Nitro Enclaves (or Azure Confidential Computing / GCP Confidential VMs) so the private key never leaves the enclave; the host only sees a signing handle. This will be recorded in the SRS as a planned isolation upgrade with the corresponding threat-model residual risk for the MVP.



\*\*2. Zero-Trust Network Egress\*\*  

\*\*MVP decision:\*\* Docker network isolation + explicit egress allow-list.  

\- LLM reasoning sub-agents (and the probabilistic core) are placed on a dedicated Docker network that has \*\*no\*\* route to the payment-adapter or Razorpay endpoints.  

\- Egress from the LLM network is restricted to the external LLM provider API only (via a fixed set of IPs/domains).  

\- The payment adapter and Mandate Vault sit on a separate network; only the deterministic guardrail shell may call them.  

\- For local demo we enforce this with Docker Compose `networks` + `internal: true` where possible, plus a simple iptables / ufw rule set documented in the repo.  



\*\*Production path:\*\* Cilium/eBPF network policies (or Istio/Linkerd mTLS + authorization policies) that deny all egress from LLM pods except the approved LLM provider and the internal guardrail service. Prompt-injection therefore cannot reach payment gateways even if the LLM is fully compromised.



\*\*3. CI/CD Benchmarking \& Tracing\*\*  

\*\*MVP pipeline (GitHub Actions):\*\*  

\- On every PR/commit: lint → unit tests → Pydantic/schema validation of all structured LLM outputs → prompt-injection red-team suite (a small, versioned set of known-bad Agent Cards and malicious listings) → integration tests against Razorpay test-mode.  

\- Gates are hard: any schema breakage or red-team failure blocks merge.  



\*\*OpenTelemetry:\*\* W3C `traceparent` / `tracestate` propagation is mandatory. Every request carries a `transaction\_id` (or `mandate\_id`) that is injected as a baggage item and appears as a span attribute on every span (Python FastAPI, Node.js, LLM call wrapper, payment adapter, ledger write). The LLM round-trip is instrumented so the outgoing HTTP call to the model provider and the subsequent guardrail evaluation share the same trace.  



\*\*Retention:\*\* 7 days for MVP demo traces (Jaeger all-in-one). PII/redaction policy: LLM reasoning strings and natural-language user intent are tagged and redacted (or truncated) before long-term storage.



\### Answers to Technical Lead + Backend Engineer



\*\*1. Containerization and Local Orchestration\*\*  

Single `docker-compose.yml` (plus `docker-compose.override.yml` for local secrets) that brings up:  

\- `guardrail` (Python/FastAPI)  

\- `payment-adapter` (Python or Node)  

\- `ledger` (PostgreSQL)  

\- `redis` (cart locks / short-lived state)  

\- `vault` (or a thin signing service)  

\- `jaeger` / `otel-collector` (optional for demo)  



Service dependencies use `depends\_on` with `condition: service\_healthy`. Health checks are HTTP `/healthz` (or TCP for Postgres/Redis).  



\*\*Secrets:\*\* Never baked into images or the compose file. Locally we use a `.env` file that is git-ignored + Docker Compose `env\_file`, or better, Docker secrets / a simple `sops` + age encrypted file. In CI we use GitHub Actions secrets / OIDC. Signing keys and Razorpay test keys are injected only at runtime.



\*\*2. CI/CD and Automated Testing\*\*  

One repository is sufficient for the MVP (fork of the AP2 samples + our adapter/guardrail/ledger code in a monorepo layout).  



GitHub Actions workflow:  

\- `pull\_request` \& `push` to main → lint (ruff/black/eslint) → unit tests → schema/contract tests → integration tests (Razorpay test-mode credentials injected via GitHub Secrets, masked in logs).  

\- Secrets are exposed only to the specific job that needs them via `env:` and are never echoed.  



\*\*3. Observability Stack in a Resource-Constrained Demo\*\*  

Minimal Compose overlay:  

\- Jaeger all-in-one (or Grafana Tempo + Grafana)  

\- OpenTelemetry Collector (receives OTLP from Python `opentelemetry-instrumentation-fastapi` and the Node.js equivalent)  

\- Optional Prometheus + Grafana only if the laptop can handle it; otherwise disable long-term storage and rely on Jaeger UI for the demo.  



All services propagate `transaction\_id` / `mandate\_id` as a span attribute and baggage. A single Jaeger trace will show the full path: incoming request → guardrail checks → LLM call → grounding/policy decision → payment-adapter → ledger write. Overhead is kept low by sampling (100 % for demo, parent-based later).



\### Answers to QA Engineer



\*\*Observability (GenAI-specific)\*\*  

Mandatory exported metrics/traces:  

\- token usage (prompt + completion) per LLM call  

\- prompt-injection detection flag / score  

\- grounding-mismatch count  

\- confidence-score distribution  

\- guardrail rejection reasons (enum)  



Alerting thresholds (MVP): any prompt-injection flag > 0 in a session, grounding mismatch rate > 5 % over 5 min, or confidence-gate escalations > N per hour → alert to the demo dashboard / Slack.



\*\*Secrets \& Keys\*\*  

AP2 signing keys and Razorpay keys live in the secrets manager (GitHub Secrets for CI, Docker secrets / env for local, later Vault/KMS). Injection is runtime-only; the application never logs secret values (structured logging redacts anything matching key patterns).



\*\*Cost \& Abuse Guardrails\*\*  

Infrastructure-level:  

\- per-process / per-container rate limit on LLM calls (e.g., token bucket via Redis or an Envoy/Cilium rate-limit)  

\- daily spend circuit-breaker (simple counter + kill switch that the guardrail shell also respects)  

\- max concurrent agent sessions  



\*\*State Persistence\*\*  

Redis: AOF enabled + RDB snapshots every 5 minutes for the MVP (survives container restart).  

PostgreSQL ledger: synchronous commit for mandate state changes; WAL archiving enabled even in the demo Compose file so we can demonstrate point-in-time recovery.



\### Answers to Cryptography / Security Engineer



\*\*Q1 — Deployment \& trust isolation\*\*  

Runtime topology (MVP):  

\- Separate containers/services: `llm-core`, `guardrail-shell`, `mandate-vault`, `payment-adapter`, `audit-ledger`.  

\- Network segmentation: LLM network has no route to payment or Vault; only guardrail may talk to Vault and payment-adapter.  

\- Service-to-service: mTLS (or at minimum mutual TLS via sidecars / service mesh in later stages; for MVP we use network policies + API tokens / JWT with short lifetime). Vault exposes only a signing endpoint.



\*\*Q2 — Secrets, CI/CD \& supply chain\*\*  

\- Secrets never in images or source.  

\- CI: OIDC → cloud secret store or GitHub Environments with protection rules; dependency scanning (Dependabot + Trivy/Grype) blocks known-vulnerable base images.  

\- Image signing (cosign) and SBOM generation are recommended for the MVP and will be required for any post-buildathon production path.  

\- Key rotation: support dual-key verification window so old mandates remain verifiable while new ones use the rotated key; rotation does not require full fleet restart if the Vault is designed with hot-reload of public keys.



\*\*Q3 — Observability, recovery \& incident response\*\*  

Security events that must be alerted: Vault signing failures, repeated policy violations, prompt-injection detections, anomalous egress attempts, ledger write failures, secret-access anomalies.  

Audit logs: append-only, retained ≥ 90 days (MVP can be 14–30 days).  

Fail-closed: if Vault, policy engine, or payment-adapter is unavailable, no new payment mandates are accepted.  

Rollback: immutable container images + database migrations that are backward-compatible; ledger restore procedures must preserve the append-only / consumed-nonce invariant (documented RPO ≤ 1 min for MVP with synchronous replica or frequent WAL).



\### Answers to System Architect / Protocol Engineer



\*\*Q1 — Observability Contract Across the Deterministic Sandwich\*\*  

Mandatory OpenTelemetry contract:  

\- W3C `traceparent` + baggage item `mandate\_id` / `transaction\_id` must be propagated on every hop, including the Python → external LLM API → Python round-trip (custom instrumentor or explicit header injection).  

\- Required span attributes: `constraint\_hash`, `llm\_invocation\_id`, `payment\_mandate\_nonce`, `guardrail\_decision`, `grounding\_status`.  

\- All of the above must be queryable in a single trace.  

\- Retention: 7–14 days for MVP; LLM reasoning text treated as sensitive and redacted or stored under a shorter TTL / separate encrypted store.  



This is a hard NFR: “Any mandate decision (accept/reject/escalate) must be fully reconstructible from traces in < 30 s.”



\*\*Q2 — Secret Lifecycle \& Cryptographic Key Management\*\*  

MVP: software keys injected at runtime from secrets manager into the Vault process only (tmpfs). No keys in images, build cache, or core dumps (Python `faulthandler` disabled or core dumps directed to a secure location that is wiped).  

Rotation playbook: dual-key verification window; public keys distributed via the same config channel the guardrail already uses.  

Production: HSM/KMS-backed keys with enclave or PKCS#11; application sees only handles.



\*\*Q3 — Ledger Infrastructure, Disaster Recovery \& Environment Parity\*\*  

\- RPO ≤ 1 minute, RTO ≤ 5 minutes for MVP (Postgres with synchronous replica or frequent WAL shipping). Append-only ordering and `consumed\_nonces` set must survive failover.  

\- Staging: hermetic as possible (Razorpay test-mode + recorded/mocked merchant responses) so revocation and consistency tests are deterministic; topology mirrors prod services even if scaled down.  

\- Cost guardrail: infrastructure rate-limiter + budget circuit-breaker on the LLM path (independent of the application-level 10-round limit). Hard kill switch that the guardrail shell also respects.



\---





