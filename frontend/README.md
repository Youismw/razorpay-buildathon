# 💻 Frontend Executive UI: Agentic UPI Commerce Bridge

> **Next.js 16 (Turbopack) & React 19 Executive Dashboard for Autonomous Multi-Agent Commerce**  
> Tailored for the **Razorpay Buildathon 2026** (AI Growth & Agentic Commerce Track).

---

## 🌟 Executive Overview

The frontend is a production-grade, highly responsive dashboard designed for merchants, buyers, and security auditors. It provides real-time visibility into the **5-Stage Deterministic Sandwich Architecture**, visualizes multi-step LLM reasoning chains via **Server-Sent Events (SSE)**, and allows merchants to monitor competitor pricing and dynamic margins across multiple sales channels.

---

## 📱 Core Highlights & Interactions

- **7 Specialized Views**: Dedicated workspaces for merchants, buyers, catalog browsing, mandate management, invariant audits, profile security, and forensic developer tools.
- **Cross-Platform Pinch-to-Zoom (0.5x – 2.0x)**: Built with `useTouchZoom.ts` to allow mobile evaluators on iOS and Android to scale dense financial dashboards smoothly.
- **Real-Time SSE Streaming**: Live progress indicators display reasoning step-by-step (`CONSTRAINT_COMPILATION` ➔ `REASONING_CORE` ➔ `GUARDRAIL_SHELL` ➔ `MANDATE_VAULT` ➔ `SETTLEMENT`).
- **Cryptographic PIN Governance**: Server-side verified PIN modal gate preventing unauthorized overrides of spending limits and mandate parameters.
- **Ambient Micro-Interactions**: Dynamic card lighting and hover states (`useCardGlow.ts`) that follow cursor and touch coordinates.
- **1-Click High-Throughput Benchmark**: In-browser latency profiler that fires real-time stress tests against the Deterministic Guardrail Gate.

---

## 🗂️ 7 Specialized Executive Views

| View | Component | Purpose & Capabilities |
|---|---|---|
| **🏬 Seller Co-Pilot** | `SellerOrdersLogisticsView.tsx` | AI-assisted store intelligence: real-time competitor scans (Amazon/ONDC), automated dynamic markdown rules for dead-stock liquidation, SKU inventory provisioning, and 1-click Delhivery/Bluedart logistics AWB dispatch. |
| **🛒 Buyer Co-Pilot** | `BuyerChatView.tsx` | Natural language purchasing assistant: parses informal queries, displays multi-step reasoning steps in real-time, and renders cryptographic audit badges upon settlement. |
| **📦 Universal Catalog** | `CatalogBrowserView.tsx` | Machine-readable multi-channel catalog (Groceries, Electronics, Audio, Fashion): live stock counters, supplier cost bindings, and 1-click "Buy with AI" intent pre-fills. |
| **📜 Mandates Manager** | `MandatesManagerView.tsx` | UPI Autopay lifecycle hub: displays active mandates, Unique Mandate Numbers (UMN), "Tokenize via UPI Autopay" registration modal, per-ID isolated atomic revocation (`INV-004`), multi-state badges (`Active Autopay`, `Revoked`, `Pending Auth`), live tab count indicators (`All`, `Active`, `Revoked`), and instant NPCI webhook callback simulation. |
| **🛡️ Invariants & Security** | `InvariantsView.tsx` | Real-time security matrix verifying all 10 security invariants (INV-001 through INV-010) with interactive audit proofs. |
| **👤 Profile & Security** | `ProfileSecurityView.tsx` | User governance center: pre-approved spending ceilings (INR), linked UPI VPAs, auto-pay threshold sliders, and passkey/PIN gate configuration. |
| **⚙️ Advanced Tools** | `AdvancedToolsView.tsx` | Developer & forensic toolbelt: Turbopack-resilient API inspector (`String(BACKEND_URL)` proxy safe), Live Webhook Simulator (Razorpay capture, failure, and NPCI `mandate.authenticated` callbacks), 1-Click 2,000 Decisions Stress Benchmark, raw JSONL audit explorer, and RFC 7517 JWKS cryptographic inspector. |

---

## 📂 Source Code Hierarchy

```
frontend/src/
├── app/
│   ├── globals.css            # Curated HSL color palette, dark mode tokens, micro-animations
│   ├── layout.tsx             # Root layout with responsive viewport & font configuration
│   └── page.tsx               # Top-level view switcher, SSE listener, and state orchestrator
├── components/
│   ├── advanced/              # Webhook simulator, latency profiler, and audit log viewer
│   ├── buyer/                 # Buyer chat interface and real-time reasoning visualizer
│   ├── catalog/               # Multi-category catalog browser with "Buy with AI" intent generator
│   ├── mandates/              # UPI Autopay mandate table, tokenization modal, and revocation controls
│   ├── profile/               # Spend ceiling controls, UPI handle binding, and PIN setup
│   ├── security/              # 10 Invariants compliance monitor with audit badges
│   ├── seller/                # Merchant Co-Pilot, competitor price intelligence, and logistics dispatch
│   └── shared/                # TouchZoomContainer (0.5x-2.0x), PinPromptModal, and common UI elements
├── hooks/
│   ├── useCardGlow.ts         # Mouse-following ambient lighting effect
│   └── useTouchZoom.ts        # Mobile multi-touch pinch-to-zoom gesture hook
└── lib/
    ├── api.ts                 # Type-safe API client for FastAPI backend endpoints
    └── profileStore.ts        # LocalStorage-backed client state and session management
```

---

## 🚀 Running Locally

### Development Server (with Turbopack)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser or mobile device emulator.

### Production Build Verification
```bash
npm run build
```
Compiled with **Next.js 16 (Turbopack)** in under 4 seconds with zero TypeScript or linting errors.
