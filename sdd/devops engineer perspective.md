# ***QUESTIONS***



answer these queations by \[(AI / LLM Engineer = W3C Traceparent Propagation: How will OpenTelemetry traceparent headers be passed across the Node.js, Python, and PostgreSQL service boundaries to satisfy the <30s trace reconstruction requirement (NFR-OBS-003)?

\* Container Resource Caps: In the MVP docker-compose.yml, what exact CPU and memory resource limits will be assigned per sub-agent container to prevent host memory exhaustion during 10-parallel-agent execution bursts?

\* Environment Secret Injection: How will Razorpay Test Mode credentials and Mandate Vault signing keys be securely injected at runtime without being exposed to environment variables inside the LLM Reasoning Core container?

\* Jaeger Logprob Span Attributes: What custom OpenTelemetry span attributes are configured in Jaeger to record token logprobs, Pydantic validation latency (<50ms p95), and confidence gate decisions in real time?) , (system Architect / Protocol Engineer = 1. Docker Compose Topology for Trust Zone Segmentation (§3.2 / SEC-NET-001) The SRS requires network segmentation: Reasoning Core has no route to Mandate Vault or Razorpay adapter. In Docker Compose, are you implementing this with separate Compose networks (untrusted, guardrail, settlement, ledger) and internal: true flags, or with a single bridge network + iptables rules inside containers? The SDD's deployment diagram depends on this — separate networks are clearer for the demo narrative.

&#x20; 2. OpenTelemetry Instrumentation \& Trace Propagation (NFR-OBS-001 / NFR-OBS-002) The SRS mandates W3C traceparent carrying mandate\_id and transaction\_id end-to-end. Are you using automatic instrumentation (OpenTelemetry Python/Node SDK auto-instrumentors for Flask/FastAPI/Express) or manual span creation in each component? For the SDD, I need to know where the root span originates — Human Delegation layer (L8) or the first A2A discovery call?

&#x20; 3. PostgreSQL Append-Only Ledger Permissions (DR-002 / DR-006) The audit table must have no UPDATE/DELETE grants for any application role. In the SDD, are you enforcing this via PostgreSQL row-level security (RLS), dedicated DB user with INSERT-only grants, or application-level convention? Given INV-006 (no single component can suppress another's log), I strongly recommend separate DB users per component — do you agree, and can we provision that in the Docker Compose init script?

&#x20; 4. CI/CD Pipeline Stages \& Secret Injection (NFR-CI-001 / NFR-CI-002) The SRS gates on lint → unit → contract → integration → E2E, with secrets injected via CI. For the SDD: are we using GitHub Actions with OIDC to a cloud secrets manager, or repository secrets for the MVP? And since NFR-TEST-001 forbids live Razorpay/Shopify calls in unit/contract/integration tiers, how are you handling WireMock / VCR.py fixtures for external API mocks in CI? I need the mock strategy to define the contract test boundaries.) , ( Technical Lead + Backend Engineer  = Docker Compose networking for MVP:

The system includes Python and Node.js services. How will you structure the docker-compose.yml to ensure they can communicate (e.g., via internal service names) without exposing unnecessary ports? How will you handle environment variables (Razorpay keys, signing keys) in development vs. test modes?

\* Secret injection in CI and local dev:

The SRS says secrets must be injected via the CI provider (e.g., GitHub Actions secrets/OIDC) and never committed. For local development, how will developers obtain test credentials securely? Will we provide a script to fetch from a vault (like HashiCorp Vault) or use environment files that are .gitignored with a template?

\* Observability stack for decision tracing:

The requirement to reconstruct the full decision path in under 30 seconds is critical for debugging and the demo. What exact tools (Jaeger, Grafana Tempo, ELK, etc.) will you deploy in the MVP stack? How will you correlate logs and traces via the W3C traceparent header, and what dashboards will we provide to visualize the guardrail decisions?

\* Network segmentation and fail‑closed verification:

We must ensure that the Reasoning Core cannot reach the Mandate Vault or Razorpay directly. How will you enforce egress allowlisting in Docker Compose? Will you use network aliases or firewall rules? Also, how will you test that the system fails closed when a dependency is unreachable—will you include a chaos test in the CI pipeline that injects network failures?) , ( QA Engineer  = Focus: Docker Compose topology, CI/CD pipeline, observability, and chaos engineering for the demo.

&#x20; 1. Docker Compose Topology \& Resource Limits: For the single-repo Docker Compose MVP, what is the exact docker-compose.yml service topology? Specifically, what are the resource limits (memory/CPU) configured for the 10 parallel LLM sub-agents to ensure they don't exhaust host resources (NFR-SCALE-002), and what are the healthcheck configurations to ensure the system fails closed if a dependency drops?

&#x20; 2. CI/CD \& Test Pyramid Enforcement: To enforce the strict test pyramid (NFR-CI-001, §6.1), how will you configure the CI pipeline to strictly block live Razorpay/Shopify calls at the unit/contract/integration tiers? What specific mocking framework (e.g., WireMock, Mountebank) will be containerized and exposed for the integration tier?

&#x20; 3. Observability \& Polyglot Trace Propagation: For the OpenTelemetry implementation (NFR-OBS-001 to NFR-OBS-003), how will we ensure the mandate\_id and transaction\_id are automatically injected into the W3C traceparent baggage across the Python/Node.js polyglot boundary? What specific Jaeger all-in-one configuration will we use for the demo UI?

&#x20; 4. Chaos Engineering \& Graceful Failure Demo: To support the "graceful failure" judging bar (§6.5) and weekly chaos tests, what specific fault injection tool (e.g., Toxiproxy, Chaos Mesh) will you integrate into the Docker Compose environment? I need to know how I can programmatically trigger Razorpay timeouts, network partitions, and Shopify webhook delays on demand during the pitch video.

&#x20; 

) , (Cryptography / Security Engineer = The SRS requires network segmentation, allow-listed egress, secrets isolation, boundary mTLS for the MVP, and fail-closed behavior.

&#x20; Q1. Runtime trust-zone enforcement

&#x20; Question:

Exactly how will the Docker/host networking enforce the trust zones: which services can connect to which ports/endpoints, which connections are impossible by network policy, and how will you demonstrate that the Reasoning Core has no route to the Vault or Razorpay adapter?

&#x20; SDD output needed: deployable network topology + firewall/network-policy rules.

&#x20; Q2. Secret and key isolation

&#x20; The SRS requires secrets to be injected rather than committed/logged, and explicitly prohibits the Reasoning Core from accessing payment or signing secrets.

&#x20; Question:

Where exactly will each secret/key live at runtime, how is it injected, which Unix/container identity can read it, how is access audited, and how do you technically prevent an LLM-serving process from retrieving Vault signing keys or Razorpay credentials even if that process is compromised?

&#x20; SDD output needed: secret/key placement matrix + filesystem/process/container isolation design.

&#x20; Q3. Internal service authentication

&#x20; Question:

How will the Guardrail Shell authenticate to the Mandate Vault and how will the Vault authenticate the caller? Define the MVP boundary-mTLS design: certificate issuance, identity mapping, trust roots, certificate rotation/revocation, and what happens when authentication fails.

&#x20; SDD output needed: service-authentication architecture + certificate lifecycle.

&#x20; Q4. Fail-closed deployment behavior

&#x20; The SRS requires dependency failure to result in rejection/escalation rather than bypass.

&#x20; Question:

What infrastructure-level mechanisms guarantee fail-closed behavior during container restart, DNS failure, network partition, stale configuration, Vault outage, database outage, and Razorpay timeout—and how will these conditions be reproduced in the MVP test environment?

&#x20; SDD output needed: failure-mode matrix + health/readiness behavior + chaos/fault-injection procedure.)]

# 

# ***ANSWERS***



\*\*Role: DevOps Engineer\*\*  

Answers below are concrete, implementable decisions for the MVP Docker Compose environment. They respect every locked constraint in SRS v1.1 (trust zones, fail-closed, no live credentials in Reasoning Core, single-host, Test Mode only, Jaeger all-in-one, etc.). These answers are ready to be transcribed into the SDD deployment, observability, secrets, and CI sections.



\---



\### Answers to AI / LLM Engineer



\*\*1. W3C Traceparent Propagation across Node.js / Python / PostgreSQL\*\*  

We will use the official OpenTelemetry SDKs with automatic context propagation:

\- Node.js (Negotiation Engine): `@opentelemetry/sdk-node` + `@opentelemetry/auto-instrumentations-node` (propagates via HTTP headers and gRPC metadata).

\- Python (Guardrail, Vault, Adapter, Ledger writer, Constraint Compiler): `opentelemetry-sdk` + `opentelemetry-instrumentation-fastapi` / `opentelemetry-instrumentation-requests` / `opentelemetry-instrumentation-psycopg2`.

\- PostgreSQL: the Ledger writer service injects `mandate\_id` and `transaction\_id` into the `traceparent` baggage \*\*and\*\* into a dedicated `trace\_id` / `span\_id` column on every audit insert.  

Root span is created at the first inbound A2A Task or Human Delegation entry point. All subsequent calls carry the W3C `traceparent` + baggage. This guarantees full decision-path reconstruction in <30 s via the Jaeger UI (NFR-OBS-003).



\*\*2. Container Resource Caps for 10 parallel sub-agents\*\*  

In `docker-compose.yml` each Negotiation sub-agent container receives:

```yaml

deploy:

&#x20; resources:

&#x20;   limits:

&#x20;     cpus: '0.5'

&#x20;     memory: 768M

&#x20;   reservations:

&#x20;     cpus: '0.25'

&#x20;     memory: 512M

```

Hard limit of 10 replicas (or 10 explicitly named services). Total host memory reservation stays under 8 GB, leaving headroom for the rest of the stack on a typical laptop.



\*\*3. Environment Secret Injection (Razorpay + Mandate Vault keys)\*\*  

\- Razorpay Test Mode credentials and all four purpose-partitioned signing keys live \*\*only\*\* in Docker secrets (or a local Vault container in dev mode).

\- They are mounted as files into the \*\*Settlement Zone\*\* and \*\*Signing Zone\*\* containers only (`/run/secrets/...`).

\- The LLM Reasoning Core / Negotiation Engine containers receive \*\*zero\*\* secret mounts and have no environment variables containing credentials.  

A compromised Reasoning Core process therefore has no filesystem or env path to the secrets (SEC-SEC-004, INV-001).



\*\*4. Jaeger Logprob / Validation / Confidence Span Attributes\*\*  

Custom attributes recorded on every Guardrail decision span:

\- `llm.logprob\_score` (float)

\- `llm.self\_consistency\_votes` (int, when fallback path used)

\- `guardrail.pydantic\_validation\_latency\_ms` (float, target <50 ms p95)

\- `guardrail.confidence\_score` (float)

\- `guardrail.decision` (`APPROVE` | `REJECT` | `ESCALATE`)

\- `guardrail.grounding\_status` (`GROUNDED` | `UNGROUNDED`)

\- plus the mandatory `mandate\_id`, `transaction\_id`, `constraint\_hash`, `llm\_invocation\_id`.



These appear in real time in the Jaeger all-in-one UI shipped with the Compose stack.



\---



\### Answers to System Architect / Protocol Engineer



\*\*1. Docker Compose Topology for Trust Zone Segmentation\*\*  

\*\*Separate Compose networks\*\* (preferred for demo clarity):

\- `net-untrusted` (A2A ingestion, UCA)

\- `net-llm` (Reasoning Core + Negotiation Engine)

\- `net-guardrail` (Guardrail Shell)

\- `net-signing` (Mandate Vault)

\- `net-settlement` (UPI Payment Adapter)

\- `net-ledger` (Postgres + Ledger writer)



Only the explicitly allowed inter-network links exist (e.g., `net-llm` ↔ `net-guardrail`, `net-guardrail` ↔ `net-signing`, `net-signing` ↔ `net-settlement`). No container on `net-llm` has a route to `net-signing` or `net-settlement`. This is enforced by Compose network definitions + `internal: true` on the sensitive networks.



\*\*2. OpenTelemetry Instrumentation \& Trace Propagation\*\*  

Automatic instrumentation via the official SDKs (see answer to AI/LLM Engineer #1).  

Root span originates at the \*\*first A2A discovery / Task acceptance\*\* call (or the Human Delegation entry point if the flow is started that way). Manual span creation is used only for the pure business events (mandate signed, debit attempted, etc.).



\*\*3. PostgreSQL Append-Only Ledger Permissions\*\*  

Yes — separate database users per component, provisioned in the Postgres init script:

\- `ledger\_writer` → INSERT only on audit + mandate tables

\- `guardrail\_reader`, `adapter\_reader`, etc. → SELECT only

\- No application role has UPDATE or DELETE.  

Row-level security is \*\*not\*\* required for MVP; the permission model alone satisfies DR-002 and INV-006.



\*\*4. CI/CD Pipeline Stages \& Secret Injection\*\*  

GitHub Actions with repository secrets for the MVP (OIDC + cloud secrets manager is Production).  

Stages (strict order, any failure blocks):  

`lint → unit → schema/contract → integration → (nightly) e2e`.  

Unit / contract / integration tiers use \*\*WireMock\*\* (Java) and \*\*pytest-vcr / respx\*\* (Python) containers that are started by the Compose test profile. Live Razorpay/Shopify calls are impossible because the real hostnames are not resolvable inside those tiers (NFR-TEST-001).



\---



\### Answers to Technical Lead + Backend Engineer



\*\*1. Docker Compose networking for MVP\*\*  

All services communicate exclusively via Docker Compose service names on the internal networks listed above. Only the Jaeger UI and the minimal audit dashboard expose host ports.  

Environment variables for non-secret config use `.env` files that are `.gitignore`d; secrets use Docker secrets (see below).



\*\*2. Secret injection in CI and local dev\*\*  

\- CI: GitHub Actions repository secrets → injected as Docker secrets at `docker compose up` time.

\- Local dev: `scripts/fetch-dev-secrets.sh` that pulls from a local HashiCorp Vault (dev mode) or from a password-manager-backed `.env.secrets` file that is explicitly `.gitignore`d. A `.env.secrets.example` template is committed.



\*\*3. Observability stack for decision tracing\*\*  

MVP stack ships:

\- Jaeger all-in-one (UI on port 16686)

\- OpenTelemetry Collector (optional, for buffering)

\- Structured JSON logs to stdout (collected by Docker)  

Correlation is automatic via W3C `traceparent`. A single pre-built Grafana dashboard (or Jaeger’s own search) shows “Guardrail Decisions” filtered by `mandate\_id`. Reconstruction target <30 s is met by searching on `mandate\_id` or `transaction\_id`.



\*\*4. Network segmentation and fail-closed verification\*\*  

Egress allow-listing is enforced by the separate Compose networks (no default route from `net-llm` to the outside or to settlement).  

Fail-closed is verified by a small chaos script (using `docker network disconnect` + Toxiproxy) that is runnable both locally and in CI. Expected behaviour: any unreachable Guardrail / Vault / Adapter dependency → immediate REJECT or HITL escalation, never a pass-through.



\---



\### Answers to QA Engineer



\*\*1. Docker Compose Topology \& Resource Limits\*\*  

Topology = the six networks listed above + one container (or replica set) per module.  

Sub-agent limits: 0.5 CPU / 768 MB as stated earlier.  

Healthchecks:

```yaml

healthcheck:

&#x20; test: \["CMD", "curl", "-f", "http://localhost:8000/healthz"]

&#x20; interval: 5s

&#x20; timeout: 3s

&#x20; retries: 3

&#x20; start\_period: 10s

```

Unhealthy dependency → Compose restarts the dependent service; the Guardrail fails closed on connection refused.



\*\*2. CI/CD \& Test Pyramid Enforcement\*\*  

Pipeline blocks live calls by:

\- Starting WireMock / Mountebank containers that bind the Razorpay and Shopify hostnames

\- Setting `RAZORPAY\_BASE\_URL=http://wiremock:8080` only in the test profile

\- Network isolation so the real `api.razorpay.com` is unreachable from unit/contract/integration jobs.



\*\*3. Observability \& Polyglot Trace Propagation\*\*  

Automatic baggage propagation of `mandate\_id` and `transaction\_id` via the OpenTelemetry SDKs (see earlier answers).  

Jaeger all-in-one is started with:

```yaml

command: \["--memory.max-traces=10000"]

```

and the UI is exposed on localhost:16686 for the demo.



\*\*4. Chaos Engineering \& Graceful Failure Demo\*\*  

Toxiproxy is included in the Compose stack.  

Pre-defined toxics:

\- `razorpay\_timeout` (latency + timeout)

\- `network\_partition\_guardrail`

\- `shopify\_webhook\_delay`  

A simple CLI (`make chaos-razorpay-timeout`) or HTTP endpoint on the Toxiproxy admin interface lets us trigger any of these live during the pitch recording. Expected evidence matches SRS §6.5 exactly.



\---



\### Answers to Cryptography / Security Engineer



\*\*1. Runtime trust-zone enforcement\*\*  

Deployable topology = the six named Compose networks with explicit `links` / network attachments only for the permitted paths.  

Demonstration: from inside the Reasoning Core container, `curl` or `nc` to Mandate Vault or Razorpay Adapter ports times out / “No route to host”. This is part of the automated smoke test.



\*\*2. Secret and key isolation\*\*  

Placement matrix (MVP):

| Secret / Key              | Location                          | Readable by                  | Injection method      |

|---------------------------|-----------------------------------|------------------------------|-----------------------|

| Razorpay Test credentials | Docker secret                     | UPI Payment Adapter only     | file mount            |

| AP2 mandate signing key   | Docker secret                     | Mandate Vault only           | file mount            |

| Agent identity key        | Docker secret                     | Mandate Vault only           | file mount            |

| Ledger integrity key      | Docker secret                     | Ledger writer only           | file mount            |

| Internal service mTLS certs | Docker secret                   | Guardrail + Vault            | file mount            |



Reasoning Core container has \*\*no\*\* secret mounts and runs as a non-root user with an empty supplementary group list. Even a full container escape cannot read the secrets of other containers (user namespaces + secret mounts).



\*\*3. Internal service authentication (boundary mTLS)\*\*  

MVP design:

\- Self-signed CA generated at Compose startup (or committed test CA).

\- Each service receives a short-lived client certificate whose CN = service name.

\- Mandate Vault verifies the client certificate and maps CN → allowed operations.

\- Failed authentication → 401 + audit event; no fallback to plaintext.  

Certificate rotation is a manual `docker compose up --force-recreate` for MVP; automated rotation is Production.



\*\*4. Fail-closed deployment behavior\*\*  

Infrastructure mechanisms:

\- Health/readiness probes on every service.

\- Guardrail Shell treats connection refused / timeout to Vault or Adapter as hard failure → REJECT or HITL.

\- No circuit-breaker that defaults to “allow”.

\- Chaos procedure (Toxiproxy + `docker stop`) is documented and runnable in <30 s for the pitch.  

All of the listed failure modes (restart, DNS, partition, Vault outage, DB outage, Razorpay timeout) are covered by the same Toxiproxy + healthcheck combination.



\---



These answers are now locked for the SDD.  

I am ready to produce the \*\*System/Software Design Document\*\* outline and then the full document, incorporating every decision above.  



Shall I begin writing the SDD?

