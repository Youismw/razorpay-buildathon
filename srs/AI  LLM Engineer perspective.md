# ***QUESTIONS***



&#x20;\[by system Architect / Protocol Engineer = 1. Constraint Compiler: Structured Generation vs. Multi-Step Reasoning

The Constraint Compiler translates natural language intent into canonical, hashed constraint objects. For the SRS, do we implement this as a single-shot structured generation call (e.g., OpenAI function calling, constrained decoding with Pydantic/Grammar) or as a multi-step reasoning chain with intermediate validation? What is the target LLM backend for the MVP (OpenAI GPT-4, Claude, local Llama), and what is the deterministic output guarantee — same prompt, same temperature, same seed yields identical constraints?

2\. HITL Gate: Confidence Quantification \& Async Fallback

The HITL Gate triggers when LLM confidence < 0.9, risk > threshold, or ambiguity is detected. For the SRS, how do we quantify "confidence" — via token probability distributions, self-consistency voting (N samples + majority), or an explicit uncertainty estimation layer? When the user is not present for a human-not-present flow, what is the fallback UX — async push notification with timeout, synchronous block with retry, or automatic escalation to a pre-authorized secondary constraint set?

3\. Parallel Negotiation: Context Isolation \& Sub-Agent Model

For parallel multi-merchant negotiation (max 10 offers), the LLM must generate and evaluate competing proposals simultaneously. For the SRS, do we use a single LLM instance with batched tool calls via MCP, or spawn isolated sub-agents per merchant? How do we prevent context pollution (e.g., Seller A's discount terms leaking into the evaluation of Seller B) — via hierarchical A2A Task digests, explicit context windows per merchant, or sandboxed MCP server instances?

] , \[by  Technical Lead + Backend Engineer = What is the exact output contract for the LLM’s proposed actions (e.g., JSON schema with fields like merchant, amount, item list) and how do we enforce that the LLM never emits actions that bypass the guardrail shell?

Why this matters: The guardrail shell relies on parsing LLM output. The SRS must define the LLM's output format precisely, including required fields, allowed types, and validation rules. It must also specify that the LLM cannot directly call payment APIs; all actions must pass through the guardrail.

How do we handle low-confidence or ambiguous situations where the LLM cannot determine if a purchase is within policy, and what escalation mechanism (e.g., return to user, request clarification) should the SRS define?

Why this matters: The confidence gate is a key component. The SRS needs objective thresholds (e.g., confidence score < 0.8 triggers escalation) and a defined user interaction flow. Without this, the gate is undefined and untestable.

What are the failure modes of the grounding check when the LLM hallucinates merchant attributes or item details, and how should the system respond (reject, retry, or ask for user confirmation) according to the SRS?

Why this matters: The grounding check ensures claims trace to signed mandates. The SRS must specify behavior when a claim cannot be grounded: does the guardrail block the transaction, or does it allow the LLM to correct itself? This impacts user experience and safety requirements.

] , \[by  QA Engineer = Measurable Thresholds for the Grounding Oracle \& HITL: The architecture mandates a HITL (Human-in-the-Loop) gate when AI confidence drops. What are the exact, mathematically definable thresholds (e.g., confidence score < 0.9, grounding source mismatch > X%) that trigger this gate? I need these exact numbers to write the acceptance criteria for the AI validation layer (Module 6).

Context Limits \& Sanitization Pipeline: For the Prompt Injection Guard and Context Compression, what is the strict maximum token limit for the hierarchical digests fed to the LLM? Furthermore, what is the exact sanitization pipeline (e.g., specific regex, LLM-based filtering, or sandboxing technique) applied to untrusted third-party text (like product reviews) before it enters the context window?

Monotonicity \& Hallucination Handling: How is the "Monotonicity Check" technically enforced to ensure negotiation offers strictly converge? If the LLM hallucinates an offer that violates the hardcoded round limits or breaks the monotonicity rule, what is the exact system response (e.g., immediate task failure, rollback to last valid state)? I need to define the business logic validation rules for the negotiation engine.] , \[by Cryptography / Security Engineer = Q7 — Exact boundary between probabilistic output and executable authority

What is the maximum authority the LLM has, and what exact structured output must it produce before the deterministic shell will consider an action?

Define things such as:





allowed fields;



data types;



whether free-form text can affect payment;



whether the model can select merchant/amount directly;



whether it can request policy exceptions;



what happens when output is malformed.

Why I am asking:



This becomes the SRS interface between the LLM and deterministic system.

The key architectural rule is that malformed or unconstrained LLM output must never directly reach a payment call. 

Q8 — Prompt injection and untrusted counterparty content

How will the agent distinguish protocol data from instructions, particularly when a merchant's Agent Card, product listing, negotiated message, or other external content contains text designed to manipulate the model?

Require a concrete answer about:





what content enters the model context;



what is treated as data;



whether content is tagged/structured;



sanitization;



isolation;



tool-call restrictions;



what happens when injection is detected or suspected.

Why I am asking:



This is directly tied to the architecture's untrusted-content isolation requirement and Google's documented A2A warning. 

The SRS should not merely say "prevent prompt injection." It should specify an enforceable boundary.

Q9 — Confidence, uncertainty, and escalation semantics

What does "low confidence" technically mean in this system, what signals are used to determine it, and which classes of uncertainty MUST force human approval rather than autonomous execution?

For example:





conflicting merchant information;



missing mandate field;



ambiguous user intent;



recommendation outside known constraints;



unverifiable claim;



unexpected protocol response.

Why I am asking:



The architecture already contains a confidence/escalation gate. 

The SRS needs to turn that conceptual statement into an observable requirement:



Given condition X, autonomous execution MUST be disabled and the transaction MUST enter state Y.

It should not rely on "the model usually knows when it is uncertain."]



\[ devops engineer What are the exact interfaces and data contracts between the probabilistic reasoning core and the deterministic guardrail shell (structured output schema that the LLM must emit, maximum token budget, temperature / sampling constraints, and the precise format of the grounding evidence that must accompany every claim)?

What confidence / escalation policy must be enforced before any payment-related action is allowed (threshold values, signals that contribute to the confidence score, and the human-in-the-loop hand-off contract including required context package)?

What runtime isolation and resource limits are required for the LLM inference path (separate process/container, maximum concurrent sessions, timeout and circuit-breaker behaviour, and whether the model weights or prompt templates are considered configuration that DevOps must version and roll back independently)?]



# ***ANSWER***



\## System Architect / Protocol Engineer



\### 1. Constraint Compiler: Generation vs. Reasoning \& Determinism



\* \*\*Implementation Strategy:\*\* Structured single-shot generation via constrained decoding (Grammar/Pydantic via Outlines or Instructor) rather than multi-step reasoning chains. Multi-step reasoning introduces non-deterministic latency and state drift.

\* \*\*MVP Target Backend:\*\* OpenAI `gpt-4o` / Claude 3.5 Sonnet via strict JSON Schema mode for remote APIs; Llama-3.1-70B-Instruct with Outlines for local deployments.

\* \*\*Deterministic Output Guarantee:\*\* Determinism is enforced post-generation. The emitted JSON is canonicalized (alphabetic key ordering, key whitespace stripped) and hashed via SHA-256 (`ConstraintHash`). If seed/temperature=0 fails to yield matching string tokens, the deterministic schema validator rejects any output whose cryptographic hash or structural invariants deviate from canonical rules.



\### 2. HITL Gate: Confidence Quantification \& Async Fallback



\* \*\*Confidence Quantification:\*\* Calculated as an aggregate metric:



$$\\text{Score} = w\_1 \\cdot \\bar{P}\_{\\text{log}} + w\_2 \\cdot S\_{\\text{grounding}} + w\_3 \\cdot S\_{\\text{schema}}$$







Where $\\bar{P}\_{\\text{log}}$ is average token log-probability ($\\ge 0.85$), $S\_{\\text{grounding}}$ is 1.0/0.0 match against feed values, and $S\_{\\text{schema}}$ is strict Pydantic validity.

\* \*\*Human-Not-Present UX:\*\* Asynchronous push notification via webhook/FCM with a strict Time-To-Live (TTL) timer (e.g., 15 minutes). If the timer expires without a signed user confirmation key, the system transitions to `STATE\_EXPIRED\_CANCELLED`. Automatic escalation to secondary spending limits is explicitly prohibited.



\### 3. Parallel Negotiation: Context Isolation \& Sub-Agent Model



\* \*\*Architecture:\*\* Isolated sub-agent tasks instantiated per merchant (max 10 parallel threads via `asyncio`).

\* \*\*Context Isolation:\*\* Sub-agents execute within sandboxed context windows containing \*only\* the user's compiled `ConstraintSchema` and that specific seller's sanitized catalog feed. Sub-agents emit a isolated offer payload (`NegotiationState`).

\* \*\*Cross-Pollination Prevention:\*\* Merchant feeds never co-exist in the same context window. Cross-merchant terms are aggregated solely by the deterministic orchestrator layer into a structured comparison matrix for final utility ranking.



\---



\## Technical Lead + Backend Engineer



\### 1. LLM Output Contract \& Guardrail Sandbox



\* \*\*Output Contract:\*\* Strictly typed `ProposedAction` schema:



```json

{

&#x20; "merchant\_id": "str (UUIDv4)",

&#x20; "sku": "str",

&#x20; "offered\_price\_minor\_units": "int",

&#x20; "currency": "str (ISO 4217)",

&#x20; "utility\_score": "float (0.00 to 1.00)",

&#x20; "merchant\_signature": "str (Ed25519 hex)"

}



```



\* \*\*Guardrail Isolation:\*\* The LLM operating environment has \*\*zero network access\*\* and \*\*no payment API credentials\*\*. The LLM writes its JSON string to standard output. The guardrail shell intercepts, validates via Pydantic, checks hard price bounds, and only then forwards the payload to the isolated Mandate Vault.



\### 2. Low-Confidence \& Ambiguity Escalation Mechanics



\* \*\*Trigger Threshold:\*\* System triggers escalation when overall confidence metric $< 0.85$ or when required intent fields are missing.

\* \*\*Escalation Flow:\*\* The state machine pauses execution and returns a structured `ClarificationRequest` object to the client:



```json

{

&#x20; "state": "HITL\_REQUIRED",

&#x20; "reason": "AMBIGUOUS\_CONSTRAINT",

&#x20; "field": "max\_delivery\_days",

&#x20; "options": \[1, 3, 7]

}



```



\### 3. Grounding Check Failure Modes \& Remediation



\* \*\*Failure Modes:\*\* Hallucinated discount codes, false spec assertions (e.g., claiming 16GB RAM on an 8GB SKU), or fabricated delivery guarantees.

\* \*\*System Response:\*\* Instant automatic retry (max 1 attempt) feeding back the exact validation error (e.g., `Field 'ram' value '16GB' does not match merchant payload value '8GB'`). If the second attempt fails, the merchant item is assigned a utility score of `0.0` and dropped (`REJECT\_CANDIDATE`).



\---



\## QA Engineer



\### 1. Quantitative Acceptance Criteria



| Metric | Threshold | Action on Breach |

| --- | --- | --- |

| \*\*Grounding Precision\*\* | 100% attribute match | Block item, retry candidate |

| \*\*Log-prob Confidence\*\* | $\\ge 0.85$ | Divert to HITL state |

| \*\*Hard Bound Delta\*\* | Price $\\le \\text{Ceiling}$ | Hard reject (No HITL) |

| \*\*Monotonicity Check\*\* | $P\_k \\le P\_{k-1}$ | Rollback negotiation round |



\### 2. Context Limits \& Sanitization Pipeline



\* \*\*Token Hard Cap:\*\* Max 2,048 tokens per merchant context window.

\* \*\*Sanitization Pipeline:\*\*

1\. \*Regex Filter:\* Strip instructions, XML/Markdown tags, control tokens (`system:`, `\[INST]`, `{{...}}`).

2\. \*HTML Entity Scrubbing:\* Convert raw text to unformatted string literals.

3\. \*Encapsulation:\* Wrap text inside `<untrusted\_merchant\_data>` block tags with system prompt instruction boundaries.







\### 3. Monotonicity Enforcement \& Fallback



\* \*\*Rules Engine Validation:\*\* Evaluates buyer agent offer $P\_k$ against prior offer $P\_{k-1}$. Must satisfy $P\_k \\le P\_{k-1}$ and $P\_k \\ge \\text{Merchant Minimum}$.

\* \*\*Violation Handling:\*\* If the LLM generates an invalid or non-monotonic offer, the wrapper aborts the step, ignores the LLM response, rolls back state to $k-1$, and re-prompts with error context. If a sub-agent fails twice consecutively, the negotiation session for that seller transitions to `NEGOTIATION\_FAILED`.



\---



\## Cryptography / Security Engineer



\### 1. Probabilistic vs. Executable Boundary (Q7)



\* \*\*Maximum LLM Authority:\*\* Advisory calculation of `utility\_score` and candidate ranking. \*\*Zero payment execution authority.\*\*

\* \*\*Free-Form Text:\*\* Completely stripped; ignored by the execution engine.

\* \*\*Malformed Output Behavior:\*\* Any JSON validation exception or unknown field instantly aborts token generation, setting transaction state to `SECURITY\_VIOLATION\_INVALID\_PAYLOAD`.



\### 2. Untrusted Content \& Injection Guard (Q8)



\* \*\*Boundary Rules:\*\* Merchant feeds (Agent Cards, listings, review strings) enter the context exclusively as key-value pairs inside passive string fields within `<untrusted\_merchant\_data>` XML blocks.

\* \*\*Tool-Call Restrictions:\*\* Negotiator LLM sub-agents have zero executable tools or API bindings; output is constrained strictly to text matching the `ProposalSchema`.

\* \*\*Injection Detection:\*\* If an LLM output contains control keywords (e.g., `override\_price`, `ignore\_constraints`), the schema validation layer drops the response, logs a `PROMPT\_INJECTION\_ATTEMPT` audit event, and terminates the merchant interaction.



\### 3. Hard Escalation Triggers (Q9)



Autonomous execution is \*\*strictly disabled\*\*, and the system \*\*must\*\* shift to `STATE\_HITL\_REQUIRED` under the following deterministic conditions:



\* Merchant public key mismatch or unverified KYA Ed25519 signature.

\* Discrepancy between LLM extracted price and signed merchant API payload price.

\* Context confidence metric $< 0.85$.

\* User constraint ambiguity (variance across candidate specifications exceeds user budget/time limits).

\* Physical Oracle attestation type (e.g., courier tracking API) missing cryptographic signing anchor***.***



\*\*1. Interfaces \& Data Contracts (Probabilistic Core $\\rightarrow$ Guardrail Shell)\*\*



\* \*\*Output JSON Schema (`ProposedAction`):\*\* The LLM inference stream is parsed against a strict structure. Any output failing schema validation is discarded immediately.

```json

{

&#x20; "action\_type": "PROPOSE\_OFFER",

&#x20; "merchant\_id": "uuid-v4-string",

&#x20; "sku": "string",

&#x20; "offered\_price\_minor\_units": 450000,

&#x20; "currency": "INR",

&#x20; "utility\_score": 0.92,

&#x20; "grounding\_evidence": \[

&#x20;   {

&#x20;     "attribute": "price",

&#x20;     "claimed\_value": "450000",

&#x20;     "source\_feed\_hash": "sha256:a8f5f167...",

&#x20;     "feed\_field": "catalog.skus\[0].price\_minor"

&#x20;   }

&#x20; ]

}



```





\* \*\*Sampling Constraints:\*\* `temperature = 0.0`, `top\_p = 1.0`, `seed = 42`. Token budget hard cap: $2,048$ output tokens per sub-agent step.

\* \*\*Grounding Evidence Format:\*\* Direct key-path mapping linking LLM claims to cryptographic SHA-256 hashes of raw, sanitized merchant feed inputs. Ungrounded assertions are stripped automatically.



\*\*2. Confidence \& Escalation Policy (Pre-Payment Gate)\*\*



\* \*\*Confidence Score Formula:\*\*



$$C = 0.40 \\cdot S\_{\\text{logprob}} + 0.40 \\cdot S\_{\\text{grounding}} + 0.20 \\cdot S\_{\\text{schema}}$$





\* \*\*Thresholds \& System Actions:\*\*

\* $C \\ge 0.85$: Pass to Mandate Vault for Ed25519 single-use spend token generation.

\* $C < 0.85$ or Hard Constraint Delta $> 0$: Autonomous execution disabled; transition state to `STATE\_HITL\_REQUIRED`.





\* \*\*HITL Hand-Off Context Package:\*\* Immutable payload dispatched via WebSocket/FCM to the user interface:

```json

{

&#x20; "transaction\_id": "tx\_987654321",

&#x20; "compiled\_constraints\_hash": "sha256:7f8a9b...",

&#x20; "proposed\_action": { ... },

&#x20; "confidence\_breakdown": { "logprob": 0.82, "grounding": 0.70, "schema": 1.0 },

&#x20; "grounding\_discrepancies": \["Delivery time mismatch: claimed 2 days, feed states 5 days"],

&#x20; "permitted\_user\_actions": \["APPROVE", "REJECT", "UPDATE\_CONSTRAINTS"]

}



```







\*\*3. Runtime Isolation, Resource Limits \& Configuration\*\*



\* \*\*Container Isolation \& Egress:\*\* Sub-agent inference runtimes operate inside gVisor sandbox containers. Network egress is blocked at the host level via eBPF/Cilium network policies, permitting communication \*only\* over local Unix Domain Sockets (UDS) to the orchestrator.

\* \*\*Resource Caps \& Breakers:\*\*

\* \*Limits:\* Hard limit of 4 vCPUs and 8GB RAM per worker process. Max 10 concurrent sub-agent sessions per orchestration execution.

\* \*Timeout:\* 5.0-second execution window per inference turn.

\* \*Circuit Breaker:\* 3 consecutive schema failures or timeouts trip the breaker (30s cool-off), terminating that specific merchant sub-agent and setting state to `NEGOTIATION\_FAILED`.





\* \*\*Version Control \& Rollbacks:\*\* Prompt templates, Pydantic schemas, and model pin versions are packaged together into single, immutable OCI container images (`engine-core:vX.Y.Z`). Prompt updates follow standard git-ops pipeline deployments, allowing atomic zero-downtime rollbacks.

