"""
SSE Streaming Sub-Router for AP2 Orchestrator.
Exposes POST /buy/stream for real-time visual telemetry of the Deterministic Sandwich pipeline.
"""

import os
import uuid
import datetime
import json
import asyncio
import time
from typing import Any, Dict, List, Optional
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from modules.orchestrator.models import BuyRequest
from modules.orchestrator.state import (
    _current_buyer_profile,
    _razorpay_client,
    _get_credentials,
    revocation_engine,
    LIVE_MANDATES,
    _orchestrator_idempotency_store,
    touch_catalog_version,
)
from modules.constraint_compiler.compiler import compile_intent
from modules.constraint_compiler.models import CompileRequest
from modules.reasoning_core.agent import generate_proposal_sync
from modules.guardrail_shell.schema_validator import validate_proposal_schema
from modules.guardrail_shell.policy_engine import enforce_policy
from modules.guardrail_shell.grounding_oracle import (
    verify_grounding,
    DEMO_MERCHANT_CATALOG,
    decrement_inventory,
)
from modules.guardrail_shell.confidence_gate import compute_confidence
from modules.mandate_vault.crypto import sign_canonical_payload
from modules.ledger.audit_exporter import write_transaction_audit_files
from modules.universal_commerce_adapter.models import SellerOrder
from modules.universal_commerce_adapter.seller_manager import record_seller_order
from modules.upi_payment_adapter.razorpay_client import RazorpayOrder

router = APIRouter(tags=["Streaming"])


@router.post("/buy/stream")
async def buy_stream(req: BuyRequest):
    """
    SSE Streaming endpoint for real-time visualization of the Deterministic Sandwich.
    Emits events as each stage processes so the frontend lights up in real time.
    """
    async def event_generator():
        trace_id = f"trace-{uuid.uuid4().hex[:12]}"
        audit_trail = []
        ts = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat()

        # 0. PIN Authorization Check (INV-001, Bug 16)
        configured_pin = str(_current_buyer_profile.get("userPin") or _current_buyer_profile.get("pin") or "1234")
        autonomy_mode = _current_buyer_profile.get("autonomyMode", "ask_above_limit")
        max_tx_limit = float(_current_buyer_profile.get("maxTransactionAmountInr", _current_buyer_profile.get("maxTransactionLimitInr", 15000.0)))
        requires_pin = (autonomy_mode == "pin_required")
        if req.pin and str(req.pin).strip() != configured_pin.strip():
            err_msg = "INVALID_PIN: Provided security PIN does not match configured user PIN."
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'AUTHORIZATION_GATE', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'UNAUTHORIZED', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return
        if requires_pin and not req.simulate_failure_stage:
            if not req.pin:
                err_msg = "PIN_REQUIRED: This transaction requires buyer PIN authorization."
                yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'AUTHORIZATION_GATE', 'error': err_msg, 'timestamp': ts()})}\n\n"
                yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'ESCALATED', 'decision': 'PIN_REQUIRED', 'error': err_msg, 'timestamp': ts()})}\n\n"
                return
        
        # 0. Initializing
        yield f"data: {json.dumps({'event': 'INIT', 'trace_id': trace_id, 'raw_intent': req.raw_intent, 'timestamp': ts()})}\n\n"
        await asyncio.sleep(0.35)

        # 1. Constraint Compilation
        if req.simulate_failure_stage == 1 or len(req.raw_intent.strip()) < 3:
            err_msg = "Compiler Rejection: Intent string too short (< 3 chars) or invalid constraint schema (RFC 8785)"
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'CONSTRAINT_COMPILATION', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'COMPILATION_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return

        try:
            compile_req = CompileRequest(
                raw_intent=req.raw_intent,
                buyer_did=req.buyer_did,
                max_spend_inr=req.max_spend_inr,
                allowed_merchants=req.allowed_merchants,
                validity_hours=req.validity_hours,
            )
            compiled, constraint_hash, canonical_json = compile_intent(compile_req)
            audit_trail.append({
                "stage": "CONSTRAINT_COMPILATION",
                "timestamp": ts(),
                "intent_id": compiled.intent_id,
                "constraint_hash": constraint_hash,
                "max_amount_paise": compiled.spend_limit.max_amount_paise,
                "product_query": compiled.product_query,
            })
            yield f"data: {json.dumps({'event': 'STAGE_COMPLETE', 'stage': 'CONSTRAINT_COMPILATION', 'data': {'intent_id': compiled.intent_id, 'constraint_hash': constraint_hash, 'max_amount_paise': compiled.spend_limit.max_amount_paise, 'product_query': compiled.product_query, 'canonical_json': canonical_json}, 'timestamp': ts()})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'CONSTRAINT_COMPILATION', 'error': str(e), 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'COMPILATION_ERROR', 'error': str(e), 'timestamp': ts()})}\n\n"
            return

        await asyncio.sleep(0.4)

        # 2. AI Reasoning
        if req.simulate_failure_stage == 2 or req.llm_provider == "fail-reasoning":
            err_msg = "Reasoning Failure: No matching product found in merchant catalog for ungrounded query schema."
            thought_text = f"Parsed buyer intent -> Query '{req.raw_intent}' not indexed in merchant UCP catalog."
            yield f"data: {json.dumps({'event': 'AI_THOUGHT', 'step_index': 1, 'text': thought_text, 'timestamp': ts()})}\n\n"
            await asyncio.sleep(0.2)
            yield f"data: {json.dumps({'event': 'AI_THOUGHT', 'step_index': 2, 'text': 'Zero candidate SKUs satisfy grounding constraints.', 'timestamp': ts()})}\n\n"
            await asyncio.sleep(0.2)
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'LLM_REASONING', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'REASONING_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return

        try:
            reasoning_result = generate_proposal_sync(
                constraints=compiled,
                provider=req.llm_provider,
                mode=req.mode,
            )
            proposal_dict = reasoning_result.proposal
            ai_thought_steps = reasoning_result.thought_steps

            # Stream each thought step with a micro delay for live effect
            for idx, step in enumerate(ai_thought_steps):
                yield f"data: {json.dumps({'event': 'AI_THOUGHT', 'step_index': idx + 1, 'text': step, 'timestamp': ts()})}\n\n"
                await asyncio.sleep(0.2)

            # Check if reasoning agent could not find a valid matching product
            is_empty_or_not_found = (
                proposal_dict.get("is_not_found")
                or proposal_dict.get("total_price_paise", 0) <= 0
                or any(item.get("product_id") == "PROD-NOT-FOUND" for item in proposal_dict.get("items", []))
            )
            if is_empty_or_not_found:
                ai_summary = proposal_dict.get("reasoning_summary") or f"No product matching '{req.raw_intent}' found in merchant catalog."
                is_ambiguous = (
                    proposal_dict.get("is_ambiguous")
                    or "elaborate" in ai_summary.lower()
                    or "clarify" in ai_summary.lower()
                    or "unintelligible" in ai_summary.lower()
                    or "gibberish" in ai_summary.lower()
                )
                err_msg = f"Ambiguous Request: {ai_summary}" if is_ambiguous else f"Product Not Found: {ai_summary}"
                yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'LLM_REASONING', 'error': err_msg, 'timestamp': ts()})}\n\n"
                yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'REASONING_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
                return

            audit_trail.append({
                "stage": "LLM_REASONING",
                "timestamp": ts(),
                "llm_invocation_id": reasoning_result.llm_invocation_id,
                "provider": reasoning_result.provider_used,
                "proposal_id": proposal_dict.get("proposal_id"),
                "total_price_paise": proposal_dict.get("total_price_paise"),
                "thought_steps": ai_thought_steps,
            })
            yield f"data: {json.dumps({'event': 'STAGE_COMPLETE', 'stage': 'LLM_REASONING', 'data': {'proposal': proposal_dict, 'provider': reasoning_result.provider_used, 'thought_steps': ai_thought_steps}, 'timestamp': ts()})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'LLM_REASONING', 'error': str(e), 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'REASONING_ERROR', 'error': str(e), 'timestamp': ts()})}\n\n"
            return

        await asyncio.sleep(0.35)

        # 3. Guardrail Shell
        schema_result = validate_proposal_schema(proposal_dict)
        if not schema_result.valid:
            err_msg = f"Schema validation failed: {schema_result.errors}"
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'GUARDRAIL_SHELL', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'ESCALATED', 'decision': 'SCHEMA_REJECTED', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return
        proposal = schema_result.proposal

        policy_result = enforce_policy(proposal, compiled)
        grounding_result = verify_grounding(proposal.items)
        confidence = compute_confidence(
            schema_valid=True,
            grounding_verified=grounding_result.verified,
            policy_passed=policy_result.passed,
            proposal_summary={"proposal_id": proposal.proposal_id, "total": proposal.total_price_paise},
            constraint_summary={"max_amount_paise": compiled.spend_limit.max_amount_paise},
            grounding_details=grounding_result.details,
        )

        guardrail_data = {
            "decision": confidence.decision,
            "confidence_score": confidence.confidence_score,
            "schema_valid": True,
            "policy_passed": policy_result.passed,
            "grounding_verified": grounding_result.verified,
            "violations": [v.model_dump() for v in policy_result.violations],
            "manifest_hash": grounding_result.manifest_hash,
            "scores": confidence.scores.model_dump(),
        }

        if req.simulate_failure_stage == 3 or confidence.decision != "APPROVED":
            violations_text = "; ".join([v.message for v in policy_result.violations]) if policy_result.violations else "Budget ceiling breached (INV-010)"
            fail_msg = f"Guardrail Policy Block: Policy limits exceeded ({violations_text})"
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'GUARDRAIL_SHELL', 'decision': confidence.decision, 'error': fail_msg, 'data': guardrail_data, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'ESCALATED', 'decision': confidence.decision, 'error': fail_msg, 'timestamp': ts()})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'STAGE_COMPLETE', 'stage': 'GUARDRAIL_SHELL', 'data': guardrail_data, 'timestamp': ts()})}\n\n"

        await asyncio.sleep(0.35)

        # 4. Mandate Vault Signing
        if req.simulate_failure_stage == 4:
            err_msg = "Vault Signing Error: Cryptographic integrity failure: ES256 key mismatch / adversarial security gate block (INV-009 / INV-008)"
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'VAULT_SIGNING', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'VAULT_SIGNING_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return

        try:
            vault_payload = {
                "proposal_id": proposal.proposal_id,
                "intent_id": proposal.intent_id,
                "constraint_hash": constraint_hash,
                "total_price_paise": proposal.total_price_paise,
                "items": [item.model_dump() for item in proposal.items],
                "grounding_manifest_hash": grounding_result.manifest_hash,
                "confidence_score": confidence.confidence_score,
            }
            compact_jws, canonical_sha = sign_canonical_payload(vault_payload)
            mandate_id = f"mandate-{uuid.uuid4().hex[:12]}"
            
            vault_data = {
                "mandate_id": mandate_id,
                "compact_jws": compact_jws,
                "canonical_sha256": canonical_sha,
                "algorithm": "ES256 (ECDSA P-256)",
                "key_id": "2026-08-ap2-1",
            }
            yield f"data: {json.dumps({'event': 'STAGE_COMPLETE', 'stage': 'VAULT_SIGNING', 'data': vault_data, 'timestamp': ts()})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'VAULT_SIGNING', 'error': f'Vault signing failed: {e}', 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'VAULT_SIGNING_ERROR', 'error': str(e), 'timestamp': ts()})}\n\n"
            return

        await asyncio.sleep(0.35)

        # 5. Settlement
        if req.simulate_failure_stage == 5:
            err_msg = "Settlement Block: 403 MANDATE_REVOKED: Mandate was revoked prior to settlement (Atomic Lock INV-004) / Merchant Scope Unauthorized."
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'SETTLEMENT', 'error': err_msg, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'SETTLEMENT_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
            return

        try:
            # Stage 5: Create Real Razorpay Order if credentials configured
            rzp_order_id = None
            key_id, _ = _get_credentials()
            try:
                rzp_res = _razorpay_client.create_order(
                    RazorpayOrder(
                        amount_paise=proposal.total_price_paise,
                        currency="INR",
                        receipt=f"rcpt_{trace_id[:12]}",
                        notes={
                            "trace_id": trace_id,
                            "mandate_id": mandate_id,
                            "constraint_hash": constraint_hash,
                        }
                    )
                )
                if rzp_res.success:
                    rzp_order_id = rzp_res.razorpay_order_id
                else:
                    rzp_order_id = None
            except Exception as e:
                print(f"[Orchestrator Stream] Warning: Razorpay order creation failed: {e}")
                rzp_order_id = None

            # Bug 4 Protection: If Razorpay order creation failed, abort settlement immediately
            if not rzp_order_id:
                err_msg = "Payment gateway order creation failed"
                audit_trail.append({
                    "stage": "SETTLEMENT",
                    "mandate_id": mandate_id,
                    "status": "FAILED",
                    "total_price_paise": proposal.total_price_paise,
                    "error": err_msg,
                })
                yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'SETTLEMENT', 'error': err_msg, 'timestamp': ts()})}\n\n"
                yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'SETTLEMENT_ERROR', 'error': err_msg, 'timestamp': ts()})}\n\n"
                return

            audit_trail.append({
                "stage": "SETTLEMENT",
                "mandate_id": mandate_id,
                "status": "SETTLED",
                "total_price_paise": proposal.total_price_paise,
                "razorpay_order_id": rzp_order_id,
            })
            
            # Register mandate into live mandates ledger & revocation engine (INV-004)
            revocation_engine.register_mandate(mandate_id, proposal.total_price_paise)
            LIVE_MANDATES.insert(0, {
                "id": mandate_id,
                "merchant_id": proposal.items[0].merchant_id if proposal.items else "demo-merchant.myshopify.com",
                "max_amount_inr": round(proposal.total_price_paise / 100.0, 2),
                "state": "PAYMENT_ACTIVE",
                "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "trace_id": trace_id,
            })

            # Record idempotency record (INV-003)
            if req.idempotency_key:
                try:
                    _orchestrator_idempotency_store.check_and_insert(
                        mandate_id="global",
                        idempotency_key=req.idempotency_key,
                        amount_paise=proposal.total_price_paise,
                    )
                    _orchestrator_idempotency_store.update_status(
                        mandate_id="global",
                        idempotency_key=req.idempotency_key,
                        status="SUCCESS",
                        razorpay_order_id=rzp_order_id,
                    )
                except Exception as e:
                    print(f"[Orchestrator Stream] Idempotency record warning: {e}")

            # Synchronize unified commerce database
            for it in proposal.items:
                pid = it.product_id
                m_id = it.merchant_id or "demo-merchant.myshopify.com"
                qty = it.quantity
                price_inr = it.offer_price_paise / 100.0
                m_catalog = DEMO_MERCHANT_CATALOG.get(m_id, {}).get("products", {})
                p_data = m_catalog.get(pid)
                if not p_data:
                    for m in DEMO_MERCHANT_CATALOG.values():
                        if pid in m.get("products", {}):
                            p_data = m["products"][pid]
                            break

                if p_data and "supplier_cost_paise" in p_data:
                    cost_inr = round(p_data["supplier_cost_paise"] / 100.0, 2)
                else:
                    cost_inr = round(price_inr * 0.72, 2)
                profit_inr = round(price_inr - cost_inr, 2)

                decrement_inventory(merchant_id=m_id, product_id=pid, quantity=qty)
                record_seller_order(
                    SellerOrder(
                        order_id=f"ORD-{uuid.uuid4().hex[:6].upper()}",
                        trace_id=trace_id,
                        timestamp=datetime.datetime.now().isoformat(),
                        product_id=pid,
                        product_name=it.product_name,
                        category=it.category,
                        quantity=qty,
                        supplier_cost_inr=cost_inr,
                        selling_price_inr=price_inr,
                        net_profit_inr=profit_inr,
                        profit_margin_pct=round((profit_inr / price_inr) * 100.0, 1) if price_inr > 0 else 25.0,
                        channel="ap2_gateway",
                        buyer_type="ai_purchasing_agent",
                        buyer_identifier=req.buyer_did or "buyer-default",
                        order_status="CONFIRMED",
                        manifest_hash=constraint_hash,
                        jws_token_preview=compact_jws[:60] + "..." if compact_jws else "N/A",
                        razorpay_order_id=rzp_order_id,
                        ai_deliberation_steps=ai_thought_steps,
                    )
                )

            touch_catalog_version()

            paths = write_transaction_audit_files(
                trace_id=trace_id,
                status="SUCCESS",
                decision="APPROVED",
                raw_intent=req.raw_intent,
                constraint_hash=constraint_hash,
                total_price_paise=proposal.total_price_paise,
                confidence_score=confidence.confidence_score,
                reasoning_summary=proposal.reasoning_summary,
                ai_thought_steps=ai_thought_steps,
                mandate_id=mandate_id,
                compact_jws=compact_jws,
                audit_trail=audit_trail,
            )

            settlement_data = {
                "status": "SETTLED",
                "mandate_id": mandate_id,
                "total_price_paise": proposal.total_price_paise,
                "total_inr": proposal.total_price_paise / 100.0,
                "razorpay_order_id": rzp_order_id,
                "razorpay_key_id": key_id,
                "audit_json_path": paths["json_path"],
                "audit_md_path": paths["md_path"],
                "audit_jsonl_path": paths["jsonl_path"],
            }
            yield f"data: {json.dumps({'event': 'STAGE_COMPLETE', 'stage': 'SETTLEMENT', 'data': settlement_data, 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'SUCCESS', 'trace_id': trace_id, 'mandate_id': mandate_id, 'compact_jws': compact_jws, 'total_price_paise': proposal.total_price_paise, 'razorpay_order_id': rzp_order_id, 'razorpay_key_id': key_id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'event': 'STAGE_FAILED', 'stage': 'SETTLEMENT', 'error': f'Settlement failed: {e}', 'timestamp': ts()})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_STATUS', 'status': 'FAILED', 'decision': 'SETTLEMENT_ERROR', 'error': str(e), 'timestamp': ts()})}\n\n"
            return

    return StreamingResponse(event_generator(), media_type="text/event-stream")
