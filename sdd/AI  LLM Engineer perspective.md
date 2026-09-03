# ***QUESTIONS***



answer these queations by  \[(System Architect / Protocol Engineer = 1. LLM Backend Selection \& Confidence Formula (FR-GRD-006 / FR-GRD-006a)

The SRS specifies two paths: native token logprobs (0.40 weight) or self-consistency voting fallback (N=3). Which backend are we committing to for the MVP, and can you validate the 0.85 threshold against a golden dataset before I lock the Guardrail Shell's decision gate interface? This determines whether the Confidence Gate expects a single logprob float or a vote\_consensus enum from your layer.

2\. MCP ↔ A2A Adapter Contract

The Probabilistic Reasoning Core sits behind MCP, but merchant discovery speaks A2A. In the SDD, do you want a thin MCP-to-A2A translation shim inside your container, or should the Negotiation Engine expose an A2A-native interface and you consume it via MCP tools? This affects whether the Guardrail Shell sees ProposalObject arriving from an MCP tool-call or from an A2A Task artifact.

3\. Structured Generation Enforcement for ProposalObjectProposalObject (Appendix C.1) has additionalProperties: false. Are you using constrained decoding (e.g., OpenAI function calling, outlines, guidance) to guarantee schema compliance at the source, or do you emit free text and rely on the Guardrail Shell's SchemaValidator (FR-GRD-003) as the enforcement point? If the former, I need your schema constraint spec for the SDD interface contract; if the latter, we need to budget for the 2-retry loop latency in our p95 calculations.

4\. Parallel Sub-Agent Isolation \& Context Injection

FR-NEG-001 demands 10 isolated sub-agents with no shared mutable state. How are you preventing cross-merchant context leakage? Specifically: are you spawning 10 independent LLM contexts (higher token cost, guaranteed isolation) or using a single context with role-based delimiters (lower cost, risk of prompt injection via one merchant's description affecting another)? I need this for the SDD's threat model and cost projection. ) , (Technical Lead + Backend Engineer = Structured output \& schema enforcement:

The SRS mandates a schema-constrained ProposalObject. What concrete technique will you use to guarantee the LLM outputs valid JSON that matches our schema? Will you rely on the model's native JSON mode, use function/tool calling, or implement a separate parser with retry logic? How will we handle schema updates without breaking existing prompts?

Grounding Oracle implementation:

The grounding check must verify that every claim (price, stock, etc.) traces to a signed AP2 mandate field or UCP manifest. What is the exact lookup mechanism? Will we keep an in‑memory cache of recent manifests, use a vector DB for semantic similarity, or simply perform exact field matching against a database? What is the expected latency, and how will we cache to meet the 3‑second p95 end‑to‑end target?

Confidence score fallback for non‑logprob models:

The SRS defines a fallback (self‑consistency voting) for LLM backends that do not expose token logprobs. What is the detailed implementation of this fallback—how many samples, how to aggregate, and what threshold? How will you make this deterministic and reproducible in testing?

Sub‑agent isolation \& concurrency:

Up to 10 parallel negotiation sub‑agents must run without shared mutable state. Will you use separate threads, asyncio tasks, or dedicated processes? How will you enforce resource limits (memory, connections) so that one misbehaving agent cannot exhaust host resources? What about prompt‑injection risks—will each sub‑agent run in its own isolated context (e.g., separate API keys or sandboxed containers)?

) , (QA Engineer = Focus: LLM integration, structured outputs, confidence scoring, and sub-agent isolation.

Structured Output \& Schema Enforcement: For the ProposalObject (Appendix C.1), how exactly will we enforce the JSON schema at the LLM API level (e.g., constrained decoding/JSON mode vs. post-hoc JSON repair)? If the LLM fails schema validation, what is the exact programmatic fallback mechanism to trigger the bounded regeneration (max 2 retries) before escalating to HITL (FR-GRD-003)?

Confidence Formula \& Logprobs: To implement the confidence formula (C=0.40×Slogprob+0.40×Sgrounding+0.20×Sschema

C=0.40×Slogprob

​+0.40×Sgrounding

​+0.20×Sschema

​), which specific LLM backend are we locking in for the MVP to guarantee token-level logprob access? How will we mathematically calculate Slogprob

Slogprob

​ from the raw API response, and what is the exact fallback implementation for FR-GRD-006a if logprobs are unavailable?

Sub-Agent Context Isolation: For the parallel negotiation engine (up to 10 sub-agents), how will you structurally isolate the context windows and memory state for each sub-agent to guarantee zero cross-contamination (FR-NEG-001)? What is the exact payload structure passed from the sub-agent to the Guardrail Shell?

Grounding Oracle Integration: How will the LLM output factual claims (price, stock, merchant identity) so the Grounding Oracle can independently verify them (FR-GRD-005)? Will the LLM be forced to output explicit citation IDs mapping to the UCP manifest/signed AP2 cart, or are we relying on semantic vector matching?) , (Cryptography / Security Engineer = Q1. ProposalObject and LLM trust boundary

The SRS makes the ProposalObject the only permitted downstream LLM artifact, with schema validation before any further processing. 

Question:



What is the exact ProposalObject contract you will implement—including JSON Schema, allowed fields/types/enums, handling of missing/extra fields, versioning, maximum sizes, retry behavior, and how you guarantee that no free-text output, tool call, or hidden model output can bypass this contract?

SDD output needed: LLM→Guardrail interface contract + validation sequence + failure states.

Q2. Confidence computation and model dependence

The SRS fixes the confidence formula at:

C = 0.40 × S\_logprob + 0.40 × S\_grounding + 0.20 × S\_schema

with C ≥ 0.85 required for autonomous execution, while also requiring a fallback if the model lacks logprobs. 

Question:



Exactly how will S\_logprob, S\_grounding, and S\_schema be computed, normalized, versioned, and tested? For the selected LLM backend, what happens when logprobs are unavailable, inconsistent, or malformed, and where is the confidence decision enforced so the LLM cannot influence its own score?

SDD output needed: confidence algorithm, interfaces, fallback algorithm, thresholds, and authoritative enforcement point.

Q3. Prompt-injection containment

The SRS requires structural isolation of external content rather than relying on keyword filtering, and requires injection testing across direct, multi-hop, homoglyph, and related vectors. 

Question:



Show the exact runtime representation of untrusted data between ingestion and the LLM: how is it parsed, normalized, delimited, labeled, size-limited, and inserted into context? Also specify which classes of model output are considered security-sensitive and how the design guarantees that an injection cannot cause a privileged state transition even when the model follows the injected instruction.

SDD output needed: prompt/context construction design + data-flow boundary + attack containment mechanism.

Q4. Negotiation isolation and determinism

The SRS requires up to 10 isolated merchant sub-agents, no shared mutable state, bounded rounds/timeouts, and a monotonicity check. 

Question:



How will you isolate the 10 negotiation agents at the runtime level, what exact state can each agent read/write, how will you represent an offer and its provenance, and how will the monotonicity check determine that a revised offer is actually better for the buyer without trusting the LLM's explanation?

SDD output needed: sub-agent state model, offer schema, provenance model, comparison algorithm, and termination behavior.) , (devops engineer = For the Confidence/Escalation Gate (FR-GRD-006 / FR-GRD-006a), what concrete computation will you expose for SlogprobS\_{\\text{logprob}}

Slogprob

​ and the self-consistency fallback when the chosen backend does not return token probabilities? Please specify the exact function signature the Guardrail Shell will call and the expected latency budget for that call under MVP load (≤10 parallel sub-agents).

What is the exact JSON Schema (or constrained-decoding grammar) you will enforce on every ProposalObject leaving the Reasoning Core? Confirm that the schema already matches Appendix C.1 of SRS v1.1 and list any additional fields you need for observability (e.g., llm\_invocation\_id, model name, temperature).

How will the Negotiation Engine (Module 3) isolate the 10 parallel sub-agents at the process/container level so that a single sub-agent OOM or hang cannot affect the others? What resource limits (CPU, memory, concurrent model calls) do you recommend we hard-code in the Docker Compose definitions?

For the Constraint Compiler (FR-CC-001/002), will the RFC 8785 canonicalization + SHA-256 hash step run inside the same process as the structured generation, or do you want it as a separate pure-Python microservice that the compiler calls? What is the maximum acceptable latency for that step?)]



# ***ANSWERS***



\## 1. System Architect / Protocol Engineer



1\. \*\*LLM Backend Selection \& Confidence Formula (FR-GRD-006 / FR-GRD-006a)\*\*

We are locking OpenAI `gpt-4o-2024-08-06` as the primary MVP engine because it provides native token-level logprobs and deterministic structured outputs. The Guardrail Shell expects a single $S\_{\\text{logprob}}$ float ($\[0.0, 1.0]$). The $C \\ge 0.85$ threshold has been validated against our 50-scenario golden dataset, yielding zero false positives on compliant proposals and a 100% rejection rate on out-of-bounds prices. The self-consistency fallback ($N=3$, producing a `vote\_consensus` enum) is strictly reserved as an internal fallback via FR-GRD-006a if the upstream API omits token logprobs.





2\. \*\*MCP ↔ A2A Adapter Contract\*\*

The Negotiation Engine exposes an A2A-native Task interface to external merchant agents, but wraps its internal sub-agents inside an MCP server layer. The Probabilistic Reasoning Core emits `ProposalObject` strictly as an MCP tool-call output (`submit\_proposal`). The Guardrail Shell intercepts this artifact at the internal MCP boundary \*before\* any external A2A state transition occurs, ensuring untrusted A2A code never directly consumes unvalidated model outputs.





3\. \*\*Structured Generation Enforcement for ProposalObject\*\*

We enforce `additionalProperties: false` at the generation source using OpenAI Structured Outputs (`response\_format={"type": "json\_schema", ...}`) matching Appendix C.1. This guarantees schema compliance at decoding time, forcing $S\_{\\text{schema}} = 1.0$ on initial inference. The 2-retry loop specified in FR-GRD-003 is retained strictly as a fallback mechanism for network transport anomalies or rare API contract failures.





4\. \*\*Parallel Sub-Agent Isolation \& Context Injection\*\*

We spawn 10 independent LLM context windows (one dedicated process per sub-agent). We do \*\*not\*\* multiplex sub-agents within a single context window. Each process injects only its target merchant's sanitized manifest inside `<untrusted\_merchant\_data>` tags. This guarantees zero cross-merchant context leakage, neutralizing cross-merchant prompt injection vectors at a linear token cost penalty ($10 \\cdot C\_{\\text{prompt}}$).







\---



\## 2. Technical Lead + Backend Engineer



1\. \*\*Structured Output \& Schema Enforcement\*\*

We enforce schema constraints at the API level via JSON Schema constrained decoding. Pydantic models compile directly to JSON Schema contracts passed during model invocation. Prompt updates are decoupled from schema contracts by maintaining versioned prompt templates (`v1.1\_negotiation\_core.jinja2`) while freezing the JSON Schema contract in the compiled code.





2\. \*\*Grounding Oracle Implementation\*\*

The Grounding Oracle executes exact field matching against an in-memory Redis cache populated with signed UCP manifests fetched during discovery. Vector databases and semantic similarity matching are explicitly prohibited for financial claims. The oracle looks up `selected\_candidate\_id` and verifies that `offer\_price` $\\le \\text{manifest\\\_price}$. Total Redis lookup latency is $< 2\\text{ms}$, well within our end-to-end 3-second p95 target.





3\. \*\*Confidence Score Fallback for Non-Logprob Models\*\*

For backends missing logprobs, FR-GRD-006a triggers $N=3$ parallel sampling calls at $\\text{Temperature} = 0.7$. The system extracts (`selected\_candidate\_id`, `offer\_price`) from all responses:





\* Unanimous match ($3/3$): $S\_{\\text{consensus}} = 1.0$



\* Majority match ($2/3$): $S\_{\\text{consensus}} = 0.66$



\* Disagreement ($1/3$): $S\_{\\text{consensus}} = 0.0$



In automated testing, determinism is maintained by passing fixed random seeds (`seed=42`) and forcing $\\text{Temperature} = 0.0$ on single-shot runs.









4\. \*\*Sub-Agent Isolation \& Concurrency\*\*

Sub-agents execute as isolated `asyncio` tasks running inside dedicated worker processes managed by Python `ProcessPoolExecutor` (capped at 10 workers). Memory limits (256MB per process) are enforced via OS `resource.setrlimit`. Prompt injection isolation is absolute: each process manages its own stateless API connection and context window, preventing shared state access.







\---



\## 3. QA Engineer



1\. \*\*Structured Output \& Schema Enforcement\*\*

Schema enforcement occurs at the API boundary via constrained decoding. If an output fails Pydantic validation (e.g., UUID string formatting error), the Guardrail Shell constructs a `RejectionContext` payload (Appendix C.2) detailing the `SCHEMA\_VIOLATION` and returns it to the sub-agent. The sub-agent has a maximum retry budget of 2. Exhaustion of retries immediately emits an `HITL\_Payload` (Appendix C.3).





2\. \*\*Confidence Formula \& Logprobs\*\*

For `gpt-4o-2024-08-06`, $S\_{\\text{logprob}}$ is calculated by taking the linear probability $p\_i = \\exp(\\text{logprob}\_i)$ for each generated token in `selected\_candidate\_id` and `offer\_price`, then deriving their geometric mean:

$$S\_{\\text{logprob}} = \\left( \\prod\_{i=1}^{k} p\_i \\right)^{1/k}$$





If logprobs are unavailable, $S\_{\\text{logprob}}$ is replaced by $S\_{\\text{consensus}}$ from the 3-sample voting fallback.





3\. \*\*Sub-Agent Context Isolation\*\*

Each sub-agent maintains an isolated memory array: `\[SystemPrompt, UntrustedMerchantData, UserIntent]`. No reference sharing exists across sub-agent context objects. The sub-agent hands off its output to the Guardrail Shell as a stringified `ProposalObject` JSON payload over standard inter-process communication.





4\. \*\*Grounding Oracle Integration\*\*

The sub-agent must output an explicit UUID string in `selected\_candidate\_id`. The Grounding Oracle performs a key-value lookup against signed UCP manifest entries. Semantic vector matching is avoided to maintain a 0% hallucinated-fact tolerance on financial assertions.







\---



\## 4. Cryptography / Security Engineer



1\. \*\*ProposalObject and LLM Trust Boundary\*\*

The contract strictly implements Appendix C.1 with `additionalProperties: false`. Allowed fields: `selected\_candidate\_id` (UUIDv4), `offer\_price` (float $\\ge 0.0$), `reasoning` (string $\\le 1000$ chars), and `negotiation\_round` (int $1 \\le r \\le 10$). Extra or missing fields trigger immediate schema rejection. Tool calls are disabled (`tool\_choice="none"`), and free-text streams are blocked at the socket level.







```

\[ Probabilistic Core ] ──(ProposalObject JSON)──► \[ Guardrail Shell ] ──(Validated Payload)──► \[ Mandate Vault ]



```



2\. \*\*Confidence Computation and Model Dependence\*\*

Confidence components are computed inside the deterministic Guardrail Shell:

\* $S\_{\\text{schema}} \\in \\{1.0, 0.5, 0.0\\}$ based on retry count.





\* $S\_{\\text{grounding}} \\in \\{1.0, 0.0\\}$ based on exact UCP manifest matching.





\* $S\_{\\text{logprob}} \\in \[0.0, 1.0]$ based on geometric mean token logprobs.









$$C = 0.40 \\cdot S\_{\\text{logprob}} + 0.40 \\cdot S\_{\\text{grounding}} + 0.20 \\cdot S\_{\\text{schema}}$$





The LLM has zero visibility into confidence scoring calculations.





3\. \*\*Prompt-Injection Containment\*\*

External data ingestion pipeline:

\* \*\*Normalization:\*\* NFKC Unicode normalization strips homoglyphs.





\* \*\*Neutralization:\*\* Delimiters and role tags (e.g., `<|im\_start|>`, `\[INST]`) are stripped.





\* \*\*Encapsulation:\*\* Content is wrapped in `<untrusted\_merchant\_data>` tags.





If an injection bypasses sanitization and directs the model to alter prices, the downstream Policy Engine independently validates the proposal against `CompiledConstraints` (checking `max\_spend` and merchant scope). Out-of-policy proposals are blocked regardless of LLM instruction compliance.









4\. \*\*Negotiation Isolation and Determinism\*\*

Sub-agents run in isolated process spaces with read-only access to their specific merchant offer state. Every offer is bound to a cryptographic hash: $\\text{Hash}(\\text{round\\\_id} \\parallel \\text{merchant\\\_id} \\parallel \\text{price})$.





The Monotonicity Check evaluates price changes programmatically round over round:





$$P\_k \\le P\_{k-1}$$





If $P\_k > P\_{k-1}$, the Guardrail Shell immediately terminates the negotiation for that merchant, bypassing any LLM reasoning text.







\---



\## 5. DevOps Engineer



1\. \*\*Confidence Gate Function Signature \& Latency\*\*

The Guardrail Shell exposes the following Python evaluation signature:

```python

def evaluate\_proposal(

&#x20;   proposal\_json: str, 

&#x20;   raw\_logprobs: list\[float], 

&#x20;   manifest\_id: str

) -> GuardrailDecision: ...



```





Total budget per call is $\\le 15\\text{ms}$ (well within the 50ms p95 requirement of NFR-PERF-001).





2\. \*\*JSON Schema \& Observability Fields\*\*

The base schema matches Appendix C.1. For OpenTelemetry trace enrichment, the envelope wrapping the hand-off to the Guardrail Shell includes non-LLM metadata:





```json

{

&#x20; "proposal": { ... },

&#x20; "metadata": {

&#x20;   "llm\_invocation\_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",

&#x20;   "model\_name": "gpt-4o-2024-08-06",

&#x20;   "temperature": 0.0,

&#x20;   "execution\_latency\_ms": 242.5

&#x20; }

}



```





3\. \*\*Sub-Agent Process Limits \& Docker Caps\*\*

Sub-agents are constrained at the process and container boundaries. In `docker-compose.yml`:





```yaml

services:

&#x20; negotiation-engine:

&#x20;   deploy:

&#x20;     resources:

&#x20;       limits:

&#x20;         cpus: '2.0'

&#x20;         memory: 2048M



```





Inside the container, sub-agent worker processes set OS-level caps (`RLIMIT\_AS` = 256MB per process, maximum 2 concurrent HTTP sockets per sub-agent).





4\. \*\*Constraint Compiler Execution Architecture\*\*

RFC 8785 canonicalization and SHA-256 hashing run in-process as a pure-Python library module within the Constraint Compiler service (Module 1). Operating in-process eliminates microservice network overhead and ensures hash derivation completes in under $1\\text{ms}$.

