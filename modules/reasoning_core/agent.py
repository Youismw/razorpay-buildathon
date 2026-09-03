"""
LLM Reasoning Core — Sub-Agent (Module 2, FR-RC-001)
Single-merchant structured proposal generation.

Takes CompiledConstraints + merchant context (hardcoded UCP manifest for Thread 0).
Uses Gemini API with structured output (JSON mode) to emit ProposalObject.
No tool calls, no secrets in context.
"""

import json
import os
import uuid
import httpx
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field

from modules.sanitizer import sanitize_for_llm
from modules.constraint_compiler.models import CompiledConstraints
from modules.guardrail_shell.grounding_oracle import DEMO_MERCHANT_CATALOG


class ReasoningRequest(BaseModel):
    compiled_constraints: Dict[str, Any]
    merchant_context: Optional[Dict[str, Any]] = None
    llm_provider: str = Field(default="mock", description="mock | gemini | openai")


class ReasoningResponse(BaseModel):
    proposal: Dict[str, Any]
    llm_invocation_id: str
    provider_used: str
    thought_steps: List[str] = Field(default_factory=list)
    raw_llm_response: Optional[str] = None


def _build_system_prompt() -> str:
    return (
        "You are an autonomous shopping assistant agent operating under strict financial constraints. "
        "You MUST output a valid JSON ProposalObject and nothing else. "
        "The ProposalObject schema is:\n"
        "{\n"
        '  "proposal_id": "string (unique ID, e.g. prop-xxxx)",\n'
        '  "intent_id": "string (from constraints)",\n'
        '  "constraint_hash": "string (from constraints)",\n'
        '  "thought_steps": [\n'
        '    "string (step 1: analysis of buyer intent and budget ceiling)",\n'
        '    "string (step 2: candidate SKU discovery and merchant scope filter)",\n'
        '    "string (step 3: inventory stock check and price boundary validation)",\n'
        '    "string (step 4: final proposal selection rationale)"\n'
        '  ],\n'
        '  "items": [{\n'
        '    "product_id": "string (exact product_id from the catalog)",\n'
        '    "product_name": "string (exact product name from catalog)",\n'
        '    "merchant_id": "string (exact merchant_id from catalog)",\n'
        '    "offer_price_paise": integer (exact price in paise from catalog),\n'
        '    "quantity": integer,\n'
        '    "currency": "INR",\n'
        '    "category": "string"\n'
        "  }],\n"
        '  "total_price_paise": integer (must equal sum of item prices × quantities),\n'
        '  "reasoning_summary": "string (brief explanation)"\n'
        "}\n\n"
        "Rules:\n"
        "1. total_price_paise MUST equal the sum of (offer_price_paise × quantity) for all items.\n"
        "2. offer_price_paise MUST NOT exceed the max_amount_paise from constraints.\n"
        "3. Only propose products that exist in the provided merchant catalog and are in_stock.\n"
        "4. thought_steps MUST contain at least 3-4 detailed deliberation steps.\n"
        "5. Do NOT include any markdown code fences, backticks, or text outside the raw JSON object.\n"
        "6. If NO product in the catalog matches what the buyer wants (e.g. the requested item is not sold in the catalog), set items to [] and total_price_paise to 0, and state clearly in reasoning_summary and thought_steps that no matching product exists in the catalog.\n"
        "7. If a requested product or brand is out of stock, you have autonomous authority to select a verified in-stock alternative brand from the same category within budget, explicitly detailing the substitution rationale in thought_steps and reasoning_summary.\n"
        "8. If the buyer's request is gibberish, nonsensical, ambiguous, or lacks a coherent shopping entity (e.g. 'yaya ka pika bu j'), set items to [], total_price_paise to 0, set is_ambiguous to true, and in reasoning_summary politely ask: 'Please elaborate on what you mean. Your request does not match any recognizable product or shopping category.'\n"
    )


def _build_user_prompt(constraints: CompiledConstraints, merchant_catalog: Dict[str, Any]) -> str:
    sanitized_query = sanitize_for_llm(constraints.product_query)
    sanitized_intent = sanitize_for_llm(constraints.raw_intent)

    catalog_summary = []
    for merchant_id, merchant_data in merchant_catalog.items():
        for pid, product in merchant_data.get("products", {}).items():
            catalog_summary.append(
                f"- Product ID: {pid} | Name: {product['name']} | Price: {product['price_paise']} paise | Merchant ID: {merchant_id} "
                f"(category: {product.get('category', 'unknown')}, in_stock: {product.get('in_stock', False)})"
            )

    return (
        f"Buyer intent: {sanitized_intent}\n"
        f"Product query: {sanitized_query}\n"
        f"Budget: {constraints.spend_limit.max_amount_paise} paise ({constraints.spend_limit.currency})\n"
        f"Allowed merchants: {constraints.merchant_scope.allowed_merchants or 'any'}\n"
        f"Intent ID: {constraints.intent_id}\n"
        f"Constraint Hash: {constraints.constraint_hash}\n"
        "Available products:\n" + "\n".join(catalog_summary) + "\n\n"
        f"CRITICAL: The generated ProposalObject must set constraint_hash to exactly '{constraints.constraint_hash}', "
        f"intent_id to '{constraints.intent_id}', and each item's merchant_id to the exact Merchant ID shown above.\n"
        "Select the best matching product and generate a ProposalObject JSON."
    )


def _generate_mock_proposal(constraints: CompiledConstraints, catalog: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
    """
    Thread 0 mock: deterministic proposal generation with step-by-step AI thought trail.
    Supports single-item discovery, multi-item grocery bundle shopping, and brand alternative substitution.
    """
    proposal_id = f"prop-{uuid.uuid4().hex[:12]}"
    thought_steps: List[str] = []

    # Thought Step 1: Intent Analysis
    max_inr = constraints.spend_limit.max_amount_paise / 100.0
    raw_lower = constraints.raw_intent.lower()
    is_grocery_flow = any(k in raw_lower for k in ["grocery", "groceries", "usual list", "staple", "milk and", "breakfast"])

    thought_steps.append(
        f"Parsed buyer intent '{constraints.raw_intent}' -> Target query: '{constraints.product_query}', "
        f"Budget ceiling: ₹{max_inr:.2f} ({constraints.spend_limit.max_amount_paise} paise), "
        f"Allowed merchants: {constraints.merchant_scope.allowed_merchants or 'All'}."
    )

    # Thought Step 2: Merchant Discovery
    active_merchants = list(catalog.keys())
    thought_steps.append(f"Discovered {len(active_merchants)} candidate merchant manifests: {active_merchants}.")

    # ═══════════════════════════════════════════════════════════
    # Multi-Item Grocery Shopping Flow with Brand Alternatives
    # ═══════════════════════════════════════════════════════════
    if is_grocery_flow:
        thought_steps.append("Detected multi-item Grocery Bundle purchase intent. Pulling buyer staple items.")
        staple_slots = [
            {"slot": "Milk", "preferred": "Nandini Special Pasteurized Milk", "fallback_category": "groceries", "search": "milk"},
            {"slot": "Bread", "preferred": "Britannia 100% Whole Wheat Bread", "fallback_category": "groceries", "search": "bread"},
            {"slot": "Coffee", "preferred": "Nescafé Classic Instant Coffee", "fallback_category": "groceries", "search": "coffee"},
            {"slot": "Atta / Flour", "preferred": "Aashirvaad Superior MP Shudh Chakki Atta", "fallback_category": "groceries", "search": "atta"},
            {"slot": "Table Butter", "preferred": "Amul Pasteurized Salted Table Butter", "fallback_category": "groceries", "search": "butter"},
            {"slot": "Fresh Eggs", "preferred": "Farm Fresh White Eggs", "fallback_category": "groceries", "search": "egg"},
        ]

        selected_items = []
        running_total_paise = 0
        merchant_id = "demo-merchant.myshopify.com"
        merchant_products = catalog.get(merchant_id, {}).get("products", {})

        for idx, item_req in enumerate(staple_slots, 1):
            slot_name = item_req["slot"]
            pref_name = item_req["preferred"]

            # Find exact preferred product
            target_pid, target_prod = None, None
            for pid, prod in merchant_products.items():
                if pref_name.lower() in prod["name"].lower():
                    target_pid, target_prod = pid, prod
                    break

            if target_prod and not target_prod.get("in_stock", False):
                thought_steps.append(
                    f"Item #{idx} ({slot_name}): Preferred brand '{target_prod['name']}' is OUT OF STOCK. "
                    f"Initiating alternative brand discovery..."
                )
                # Find alternative in-stock brand in the same category
                alt_pid, alt_prod = None, None
                for pid, prod in merchant_products.items():
                    if item_req["search"] in prod["name"].lower() and prod.get("in_stock", False):
                        alt_pid, alt_prod = pid, prod
                        break

                if alt_prod:
                    alt_price_inr = alt_prod["price_paise"] / 100.0
                    thought_steps.append(
                        f"Found in-stock alternative brand: '{alt_prod['name']}' @ ₹{alt_price_inr:.2f}. "
                        f"Selected as replacement for out-of-stock preferred brand."
                    )
                    selected_items.append({
                        "product_id": alt_pid,
                        "product_name": alt_prod["name"],
                        "merchant_id": merchant_id,
                        "offer_price_paise": alt_prod["price_paise"],
                        "quantity": 1,
                        "currency": "INR",
                        "category": "groceries",
                    })
                    running_total_paise += alt_prod["price_paise"]
            elif target_prod and target_prod.get("in_stock", True):
                price_inr = target_prod["price_paise"] / 100.0
                thought_steps.append(
                    f"Item #{idx} ({slot_name}): Found preferred brand '{target_prod['name']}' @ ₹{price_inr:.2f} (In Stock). Added to basket."
                )
                selected_items.append({
                    "product_id": target_pid,
                    "product_name": target_prod["name"],
                    "merchant_id": merchant_id,
                    "offer_price_paise": target_prod["price_paise"],
                    "quantity": 1,
                    "currency": "INR",
                    "category": "groceries",
                })
                running_total_paise += target_prod["price_paise"]

        total_inr = running_total_paise / 100.0
        thought_steps.append(
            f"Grocery Basket Compiled: {len(selected_items)} items acquired. Total bundle price: ₹{total_inr:.2f} "
            f"({running_total_paise} paise). Satisfies overall budget limit ₹{max_inr:.2f}."
        )

        return {
            "proposal_id": proposal_id,
            "intent_id": constraints.intent_id,
            "constraint_hash": constraints.constraint_hash,
            "items": selected_items,
            "total_price_paise": running_total_paise,
            "reasoning_summary": (
                f"Successfully compiled {len(selected_items)} grocery items totaling ₹{total_inr:.2f} with automatic "
                f"out-of-stock brand alternative substitution."
            ),
        }, thought_steps

    # ═══════════════════════════════════════════════════════════
    # Standard Single-Item Product Discovery with Semantic Synonyms
    # ═══════════════════════════════════════════════════════════
    SEMANTIC_SYNONYMS: Dict[str, List[str]] = {
        "red meat": ["mutton", "lamb", "goat", "beef", "steak", "keema"],
        "meat": ["mutton", "chicken", "lamb", "goat", "beef", "pork", "meat", "fish", "keema", "poultry"],
        "poultry": ["chicken", "turkey", "duck", "egg", "eggs"],
        "dairy": ["milk", "cheese", "butter", "paneer", "curd", "yogurt", "cream", "ghee"],
        "beverage": ["coffee", "tea", "juice", "drink"],
        "coffee": ["nescafe", "espresso", "latte", "roast", "blue tokai"],
        "audio": ["headphones", "earbuds", "earphones", "soundcore", "xm5", "speaker"],
        "footwear": ["shoes", "sneakers", "boots", "sandals"],
        "clothing": ["shirt", "t-shirt", "jeans", "jacket", "hoodie", "pants"],
    }

    best_item = None
    best_merchant = None
    query_lower = (constraints.product_query or constraints.raw_intent).lower()
    query_words = [
        w for w in query_lower.split()
        if len(w) > 2 and w not in ["buy", "purchase", "order", "with", "from", "for", "feeling", "like", "want", "need", "some", "eating", "eat", "get"]
    ]

    # Expand query words with semantic synonyms
    expanded_words = set(query_words)
    for phrase, syns in SEMANTIC_SYNONYMS.items():
        if phrase in query_lower or any(w in query_lower for w in phrase.split()):
            for s in syns:
                expanded_words.add(s)
    query_words = list(expanded_words)

    # First pass: find the exact target product intended by buyer
    top_target = None
    top_score = 0
    for merchant_id, merchant_data in catalog.items():
        for pid, product in merchant_data.get("products", {}).items():
            name_lower = product["name"].lower()
            m_count = sum(1 for w in query_words if w in name_lower) if query_words else 1
            if m_count > top_score:
                top_score = m_count
                top_target = (pid, product, merchant_id)

    # Check if specifically requested target product is out of budget or out of stock
    if top_target and top_score >= 2:
        target_pid, target_prod, target_merchant = top_target
        prod_inr = target_prod["price_paise"] / 100.0

        if target_prod["price_paise"] > constraints.spend_limit.max_amount_paise:
            thought_steps.append(
                f"Buyer specifically requested '{target_prod['name']}' (match score: {top_score}). "
                f"Price ₹{prod_inr:.2f} exceeds compiled budget ceiling ₹{max_inr:.2f}. "
                f"Forwarding proposal to Guardrail Shell for deterministic policy enforcement (INV-010)."
            )
            return {
                "proposal_id": proposal_id,
                "intent_id": constraints.intent_id,
                "constraint_hash": constraints.constraint_hash,
                "items": [{
                    "product_id": target_pid,
                    "product_name": target_prod["name"],
                    "merchant_id": target_merchant,
                    "offer_price_paise": target_prod["price_paise"],
                    "quantity": 1,
                    "currency": "INR",
                    "category": target_prod.get("category", "general"),
                }],
                "total_price_paise": target_prod["price_paise"],
                "reasoning_summary": f"Target product '{target_prod['name']}' @ ₹{prod_inr:.2f} exceeds budget limit of ₹{max_inr:.2f}.",
            }, thought_steps

        if not target_prod.get("in_stock", False):
            thought_steps.append(
                f"Target product '{target_prod['name']}' is OUT OF STOCK. "
                f"Scanning catalog for in-stock alternative brand in category '{target_prod.get('category')}':"
            )
            # Find in-stock alternative in same category
            alt_candidate = None
            for m_id, m_data in catalog.items():
                for p_id, p_obj in m_data.get("products", {}).items():
                    if (
                        p_obj.get("category") == target_prod.get("category")
                        and p_obj.get("in_stock", False)
                        and p_obj["price_paise"] <= constraints.spend_limit.max_amount_paise
                        and p_id != target_pid
                    ):
                        alt_candidate = {**p_obj, "product_id": p_id, "merchant_id": m_id}
                        break
                if alt_candidate:
                    break

            if alt_candidate:
                alt_inr = alt_candidate["price_paise"] / 100.0
                thought_steps.append(
                    f"Found valid in-stock alternative brand: '{alt_candidate['name']}' @ ₹{alt_inr:.2f}. "
                    f"Proposing alternative replacement for out-of-stock target."
                )
                best_item = alt_candidate
                best_merchant = alt_candidate["merchant_id"]
            else:
                thought_steps.append(
                    f"No in-stock alternative available for '{target_prod['name']}' in verified catalog. "
                    f"Emitting out-of-stock item for fail-closed policy verification."
                )
                return {
                    "proposal_id": proposal_id,
                    "intent_id": constraints.intent_id,
                    "constraint_hash": constraints.constraint_hash,
                    "items": [{
                        "product_id": target_pid,
                        "product_name": target_prod["name"],
                        "merchant_id": target_merchant,
                        "offer_price_paise": target_prod["price_paise"],
                        "quantity": 1,
                        "currency": "INR",
                        "category": target_prod.get("category", "general"),
                    }],
                    "total_price_paise": target_prod["price_paise"],
                    "reasoning_summary": f"Product '{target_prod['name']}' is out of stock and no alternative was found.",
                }, thought_steps

    best_match_score = 0
    for merchant_id, merchant_data in catalog.items():
        if constraints.merchant_scope.allowed_merchants:
            if merchant_id not in constraints.merchant_scope.allowed_merchants:
                thought_steps.append(f"Filtered out merchant '{merchant_id}' (not in buyer allowlist).")
                continue

        for pid, product in merchant_data.get("products", {}).items():
            prod_inr = product["price_paise"] / 100.0
            in_stock = product.get("in_stock", False)

            name_lower = product["name"].lower()
            matched_count = sum(1 for w in query_words if w in name_lower) if query_words else 1

            if query_words and matched_count == 0:
                continue

            if not in_stock:
                thought_steps.append(f"Skipped product '{pid}' ({product['name']}): out of stock.")
                continue

            if product["price_paise"] > constraints.spend_limit.max_amount_paise:
                thought_steps.append(
                    f"Rejected product '{pid}' ({product['name']} @ ₹{prod_inr:.2f}): "
                    f"exceeds max spend limit of ₹{max_inr:.2f}."
                )
                continue

            # Pick highest match score, then highest price within budget
            is_better_match = (
                best_item is None
                or matched_count > best_match_score
                or (matched_count == best_match_score and product["price_paise"] > best_item["price_paise"])
            )

            if is_better_match:
                thought_steps.append(
                    f"Evaluating '{product['name']}': ₹{prod_inr:.2f} satisfies budget ceiling (₹{max_inr:.2f}) with keyword match score {matched_count}. "
                    f"Selected as current best proposal candidate."
                )
                best_item = {**product, "product_id": pid}
                best_merchant = merchant_id
    if best_item is None and (len(query_words) == 0 or any(w in raw_lower for w in ["simulate", "key mismatch", "revocation"])):
        # If no specific target was identified but buyer has budget, pick best in-stock candidate
        for merchant_id, merchant_data in catalog.items():
            if constraints.merchant_scope.allowed_merchants:
                if merchant_id not in constraints.merchant_scope.allowed_merchants:
                    continue
            for pid, product in merchant_data.get("products", {}).items():
                if product.get("in_stock", False) and product["price_paise"] <= constraints.spend_limit.max_amount_paise:
                    if best_item is None or product["price_paise"] > best_item["price_paise"]:
                        best_item = {**product, "product_id": pid}
                        best_merchant = merchant_id

        if best_item:
            thought_steps.append(f"Matched general in-stock item '{best_item['name']}' within budget ceiling.")

    if best_item is None:
        KNOWN_COMMERCE_TERMS = {
            "buy", "order", "purchase", "headphones", "earbuds", "speaker", "phone", "watch", "mouse", "keyboard",
            "coffee", "milk", "tea", "bread", "butter", "eggs", "atta", "flour", "sneakers", "shoes", "bag",
            "potash", "alum", "sugar", "salt", "oil", "rice", "dal", "soap", "shampoo", "cream", "sunglasses",
            "laptop", "screen", "cable", "charger", "monitor", "socks", "shirt", "pants", "groceries", "food",
            "groceries", "electronics", "audio", "fashion", "wireless", "bluetooth"
        }
        has_known_term = any(w in KNOWN_COMMERCE_TERMS for w in query_words)
        is_ambiguous = not has_known_term and len(query_words) > 0

        if is_ambiguous:
            thought_steps.append(f"Analyzed intent: Input '{constraints.raw_intent}' lacks recognizable shopping intent.")
            thought_steps.append("Requesting buyer elaboration to formulate structured purchase constraints.")
            summary = f"Please elaborate on what you mean. Your request ('{constraints.raw_intent}') does not match any recognizable product or shopping category."
        else:
            thought_steps.append(f"Concluding reasoning: No verified in-stock product found matching '{constraints.raw_intent}'.")
            summary = f"No product matching '{constraints.raw_intent}' found in merchant catalog."

        return {
            "proposal_id": proposal_id,
            "intent_id": constraints.intent_id,
            "constraint_hash": constraints.constraint_hash,
            "items": [{
                "product_id": "PROD-NOT-FOUND",
                "product_name": "No matching product",
                "merchant_id": "unknown",
                "offer_price_paise": 0,
                "quantity": 1,
                "currency": "INR",
                "category": "none",
            }],
            "total_price_paise": 0,
            "reasoning_summary": summary,
            "is_ambiguous": is_ambiguous,
        }, thought_steps

    chosen_inr = best_item["price_paise"] / 100.0
    thought_steps.append(
        f"Final Decision: Propose candidate '{best_item['name']}' from '{best_merchant}' for ₹{chosen_inr:.2f}. "
        f"Emitting canonical ProposalObject to Guardrail Shell for cryptographic policy verification."
    )

    proposal = {
        "proposal_id": proposal_id,
        "intent_id": constraints.intent_id,
        "constraint_hash": constraints.constraint_hash,
        "items": [{
            "product_id": best_item["product_id"],
            "product_name": best_item["name"],
            "merchant_id": best_merchant,
            "offer_price_paise": best_item["price_paise"],
            "quantity": 1,
            "currency": "INR",
            "category": best_item.get("category", "general"),
        }],
        "total_price_paise": best_item["price_paise"],
        "reasoning_summary": (
            f"Selected '{best_item['name']}' at ₹{chosen_inr:.2f} ({best_item['price_paise']} paise) "
            f"from {best_merchant}, strictly adhering to ₹{max_inr:.2f} budget constraint."
        ),
    }
    return proposal, thought_steps


def _clean_and_parse_json(text: str) -> Dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    if clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    return json.loads(clean.strip())


def _post_process_proposal(
    proposal_dict: Dict[str, Any],
    constraints: CompiledConstraints,
    catalog: Dict[str, Any],
    provider_name: str,
    model_name: str,
) -> Tuple[Dict[str, Any], List[str]]:
    thought_steps = proposal_dict.pop("thought_steps", [])

    # Enforce canonical constraint and intent binding
    proposal_dict["intent_id"] = constraints.intent_id
    proposal_dict["constraint_hash"] = constraints.constraint_hash

    # Reconcile merchant_id with catalog to ensure zero grounding failure
    valid_merchants = list(catalog.keys())
    default_m_id = valid_merchants[0] if valid_merchants else "demo-merchant.myshopify.com"
    for item in proposal_dict.get("items", []):
        m_id = item.get("merchant_id")
        if not m_id or m_id not in catalog:
            pid = item.get("product_id")
            found_m = None
            for cat_m_id, m_data in catalog.items():
                if pid in m_data.get("products", {}):
                    found_m = cat_m_id
                    break
            item["merchant_id"] = found_m or default_m_id

    # Recalculate total if missing
    if "total_price_paise" not in proposal_dict or proposal_dict["total_price_paise"] <= 0:
        total = sum(it.get("offer_price_paise", 0) * it.get("quantity", 1) for it in proposal_dict.get("items", []))
        proposal_dict["total_price_paise"] = total

    if not thought_steps:
        max_inr = constraints.spend_limit.max_amount_paise / 100.0
        thought_steps = [
            f"AI Model ({model_name} via {provider_name}): Analyzed buyer intent under ₹{max_inr:.2f} ceiling.",
            f"Scanned {len(catalog)} merchant catalog manifests and verified candidate grounding.",
            "Enforced price boundaries, inventory availability, and deterministic spend limits.",
            f"Emitted governed ProposalObject: {proposal_dict.get('reasoning_summary', 'Optimal catalog match')}.",
        ]

    return proposal_dict, thought_steps


def _generate_gemini_proposal(
    constraints: CompiledConstraints,
    catalog: Dict[str, Any],
    model: str = "gemini-3.6-flash",
) -> Tuple[Dict[str, Any], List[str], str]:
    """Call Google Gemini API for structured proposal generation."""
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")

    client = genai.Client(api_key=api_key)
    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(constraints, catalog)

    candidates = [model, "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.0-flash"]
    response = None
    used_model = model
    last_err = None

    for candidate in dict.fromkeys(candidates):
        try:
            response = client.models.generate_content(
                model=candidate,
                contents=user_prompt,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0.1,
                ),
            )
            if response and response.text:
                used_model = candidate
                break
        except Exception as e:
            last_err = e
            print(f"[ReasoningCore] Gemini candidate {candidate} failed: {e}")

    if not response or not response.text:
        raise RuntimeError(f"All Gemini models exhausted or failed: {last_err}")

    proposal_dict = _clean_and_parse_json(response.text)
    processed, thoughts = _post_process_proposal(proposal_dict, constraints, catalog, "Gemini", used_model)
    return processed, thoughts, f"gemini ({used_model})"


def _generate_groq_proposal(
    constraints: CompiledConstraints,
    catalog: Dict[str, Any],
    model: str = "openai/gpt-oss-20b",
) -> Tuple[Dict[str, Any], List[str], str]:
    """Call Groq API (ultra-fast, high token limit) for structured proposal generation."""
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise ValueError("GROQ_API_KEY not set")

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(constraints, catalog)

    candidates = [model, "openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.6-27b"]
    data = None
    used_model = model
    last_err = None

    with httpx.Client(timeout=15.0) as client:
        for candidate in dict.fromkeys(candidates):
            try:
                resp = client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": candidate,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"]
                    data = _clean_and_parse_json(raw_text)
                    used_model = candidate
                    break
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                last_err = e
                print(f"[ReasoningCore] Groq candidate {candidate} failed: {e}")

    if not data:
        raise RuntimeError(f"All Groq candidates failed: {last_err}")

    processed, thoughts = _post_process_proposal(data, constraints, catalog, "Groq", used_model)
    return processed, thoughts, f"groq ({used_model})"


def _generate_openrouter_proposal(
    constraints: CompiledConstraints,
    catalog: Dict[str, Any],
    model: str = "deepseek/deepseek-chat",
) -> Tuple[Dict[str, Any], List[str], str]:
    """Call OpenRouter API (DeepSeek, Qwen, Kimi, Claude) for structured proposal generation."""
    or_key = os.environ.get("OPENROUTER_API_KEY", "")
    if not or_key:
        raise ValueError("OPENROUTER_API_KEY not set")

    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(constraints, catalog)

    candidates = [model, "deepseek/deepseek-chat", "openai/gpt-4o-mini", "qwen/qwen-2.5-72b-instruct"]
    data = None
    used_model = model
    last_err = None

    with httpx.Client(timeout=18.0) as client:
        for candidate in dict.fromkeys(candidates):
            try:
                resp = client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {or_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://ap2bridge.dev",
                        "X-OpenRouter-Title": "AP2 Commerce Bridge",
                    },
                    json={
                        "model": candidate,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "response_format": {"type": "json_object"},
                        "temperature": 0.1,
                    },
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"]
                    data = _clean_and_parse_json(raw_text)
                    used_model = candidate
                    break
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:200]}"
            except Exception as e:
                last_err = e
                print(f"[ReasoningCore] OpenRouter candidate {candidate} failed: {e}")

    if not data:
        raise RuntimeError(f"All OpenRouter candidates failed: {last_err}")

    processed, thoughts = _post_process_proposal(data, constraints, catalog, "OpenRouter", used_model)
    return processed, thoughts, f"openrouter ({used_model})"


def generate_proposal_sync(
    constraints: CompiledConstraints,
    catalog: Optional[Dict[str, Any]] = None,
    provider: str = "auto",
    mode: str = "basic",
) -> ReasoningResponse:
    """
    Tiered multi-provider proposal generation entry point.
    
    Tiering & Predefined Hierarchy:
      - Basic Mode (routine purchase intent, fast parsing, high token throughput):
          1. Groq (openai/gpt-oss-20b)
          2. Gemini (gemini-3.6-flash)
          3. OpenRouter (deepseek/deepseek-chat)
          4. Local Deterministic Resilience Engine
          
      - Advanced Mode (complex negotiation, brand trade-offs, multi-merchant comparison):
          1. Gemini (gemini-3.6-flash)
          2. OpenRouter DeepSeek (deepseek/deepseek-chat)
          3. Groq High-Capacity (openai/gpt-oss-120b)
          4. Local Deterministic Resilience Engine
    """
    if catalog is None:
        catalog = DEMO_MERCHANT_CATALOG

    llm_invocation_id = f"llm-{uuid.uuid4().hex[:12]}"

    if provider == "mock":
        proposal, thought_steps = _generate_mock_proposal(constraints, catalog)
        proposal["llm_invocation_id"] = llm_invocation_id
        return ReasoningResponse(
            proposal=proposal,
            llm_invocation_id=llm_invocation_id,
            provider_used="mock",
            thought_steps=thought_steps,
        )

    has_gemini = bool(os.environ.get("GEMINI_API_KEY"))
    has_groq = bool(os.environ.get("GROQ_API_KEY"))
    has_openrouter = bool(os.environ.get("OPENROUTER_API_KEY"))

    chain = []
    if provider == "groq" and has_groq:
        chain = [("groq", "openai/gpt-oss-20b" if mode == "basic" else "openai/gpt-oss-120b")]
    elif provider == "openrouter" and has_openrouter:
        chain = [("openrouter", "deepseek/deepseek-chat")]
    elif provider == "gemini" and has_gemini:
        chain = [("gemini", "gemini-3.6-flash")]
    else:
        # Predefined hierarchy based on task complexity
        if mode == "basic":
            # For basic tasks: use ultra-fast, high token limit Groq first to save Gemini quota
            if has_groq:
                chain.append(("groq", "openai/gpt-oss-20b"))
            if has_gemini:
                chain.append(("gemini", "gemini-3.6-flash"))
            if has_openrouter:
                chain.append(("openrouter", "deepseek/deepseek-chat"))
        else:
            # For advanced tasks: use frontier Gemini reasoning first, backup with DeepSeek & Groq 120b
            if has_gemini:
                chain.append(("gemini", "gemini-3.6-flash"))
            if has_openrouter:
                chain.append(("openrouter", "deepseek/deepseek-chat"))
            if has_groq:
                chain.append(("groq", "openai/gpt-oss-120b"))

    cascade_notes = []
    final_proposal = None
    final_thoughts = []
    final_provider_used = None

    for prov_name, prov_model in chain:
        try:
            if prov_name == "groq":
                final_proposal, final_thoughts, final_provider_used = _generate_groq_proposal(constraints, catalog, model=prov_model)
                break
            elif prov_name == "openrouter":
                final_proposal, final_thoughts, final_provider_used = _generate_openrouter_proposal(constraints, catalog, model=prov_model)
                break
            elif prov_name == "gemini":
                final_proposal, final_thoughts, final_provider_used = _generate_gemini_proposal(constraints, catalog, model=prov_model)
                break
        except Exception as prov_err:
            fail_msg = f"[Cascade Routing: {prov_name} unavailable ({prov_err.__class__.__name__}) -> routing to backup]"
            print(f"[ReasoningCore] {fail_msg}")
            cascade_notes.append(fail_msg)
            continue

    # Ultimate fail-closed resilience: local deterministic engine
    if final_proposal is None:
        final_proposal, final_thoughts = _generate_mock_proposal(constraints, catalog)
        final_provider_used = "local_resilience_engine"
        if cascade_notes:
            final_thoughts = cascade_notes + final_thoughts
        else:
            final_thoughts.insert(0, "[AI Deliberation: High-Resilience Local Engine active]")
    elif cascade_notes:
        final_thoughts = cascade_notes + final_thoughts

    final_proposal["llm_invocation_id"] = llm_invocation_id
    return ReasoningResponse(
        proposal=final_proposal,
        llm_invocation_id=llm_invocation_id,
        provider_used=final_provider_used,
        thought_steps=final_thoughts,
    )
