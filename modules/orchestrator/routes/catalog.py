"""
Catalog and Inventory Sub-Router for AP2 Orchestrator.
Exposes endpoints for fetching global & merchant-scoped catalogs, real-time stock updates, and item importing.
"""

import time
import uuid
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from modules.guardrail_shell.grounding_oracle import (
    DEMO_MERCHANT_CATALOG,
    add_or_update_product,
    save_catalog_to_disk,
)
from modules.universal_commerce_adapter.seller_manager import (
    get_seller_profile,
    register_merchant_product,
    is_product_sold_by_merchant,
)
from modules.orchestrator.state import touch_catalog_version
import modules.orchestrator.state as state

router = APIRouter(tags=["Catalog"])


class AddProductRequest(BaseModel):
    name: str
    price_inr: float
    category: str = "general"
    stock: int = 25
    supplier_cost_inr: Optional[float] = None
    merchant_id: str = "demo-merchant.myshopify.com"


class UpdateProductRequest(BaseModel):
    product_id: str
    merchant_id: str = "demo-merchant.myshopify.com"
    business_type: Optional[str] = None
    stock: Optional[int] = None
    price_inr: Optional[float] = None


class ImportProductRequest(BaseModel):
    product_id: str
    merchant_id: str = "demo-merchant.myshopify.com"
    stock: Optional[int] = 25
    price_inr: Optional[float] = None


@router.get("/api/catalog")
def get_catalog():
    """Return available merchant catalogs for the frontend demo picker with real-time stock levels."""
    return {"merchants": DEMO_MERCHANT_CATALOG, **DEMO_MERCHANT_CATALOG}


@router.get("/api/catalog/version")
def get_catalog_version():
    """Return latest timestamp version of the global catalog for instant client cache validation."""
    return {"version": state.get_catalog_version()}


@router.post("/api/seller/catalog/add")
def add_product_to_catalog(req: AddProductRequest):
    """Add a new product to the unified AP2 merchant catalog for buyers and sellers."""
    pid = f"PROD-{uuid.uuid4().hex[:6].upper()}"
    cost_paise = int((req.supplier_cost_inr or (req.price_inr * 0.72)) * 100)
    price_paise = int(req.price_inr * 100)

    created_prod = add_or_update_product(
        merchant_id=req.merchant_id,
        product_id=pid,
        product_data={
            "name": req.name,
            "price_paise": price_paise,
            "category": req.category,
            "in_stock": req.stock > 0,
            "stock": req.stock,
            "supplier_cost_paise": cost_paise,
        },
    )
    register_merchant_product(req.merchant_id, pid)
    new_version = touch_catalog_version()
    return {"status": "SUCCESS", "product_id": pid, "product": created_prod, "version": new_version}


@router.post("/api/seller/catalog/update")
def update_product_in_catalog(req: UpdateProductRequest):
    """
    Update stock or price of an existing product in the catalog.
    Enforces strict ownership: merchants can ONLY edit products they sell.
    """
    m_data = DEMO_MERCHANT_CATALOG.get(req.merchant_id, {})
    prods = m_data.get("products", {})
    if req.product_id not in prods:
        raise HTTPException(status_code=404, detail=f"Product '{req.product_id}' not found in catalog")

    p = prods[req.product_id]
    prod_cat = p.get("category", "")
    if not is_product_sold_by_merchant(
        product_id=req.product_id,
        merchant_id=req.merchant_id,
        business_type=req.business_type,
        product_category=prod_cat,
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Permission Denied: Product '{p.get('name', req.product_id)}' (Category: {prod_cat}) "
                f"is part of the universal common market and is NOT sold by store '{req.merchant_id}' "
                f"(Business classification: {req.business_type or 'unspecified'}). You cannot modify "
                f"inventory or pricing for products outside your store."
            ),
        )

    if req.stock is not None:
        p["stock"] = req.stock
        p["in_stock"] = req.stock > 0
    if req.price_inr is not None:
        p["price_paise"] = int(req.price_inr * 100)
    save_catalog_to_disk()
    new_version = touch_catalog_version()
    return {"status": "SUCCESS", "product_id": req.product_id, "product": p, "version": new_version}


@router.post("/api/seller/catalog/import")
def import_product_to_catalog(req: ImportProductRequest):
    """Import an existing common market product into the merchant's store so they can sell and edit it."""
    m_data = DEMO_MERCHANT_CATALOG.get(req.merchant_id, {})
    prods = m_data.get("products", {})
    if req.product_id not in prods:
        raise HTTPException(status_code=404, detail=f"Product '{req.product_id}' not found in catalog")

    register_merchant_product(req.merchant_id, req.product_id)
    p = prods[req.product_id]
    if req.stock is not None:
        p["stock"] = req.stock
        p["in_stock"] = req.stock > 0
    if req.price_inr is not None:
        p["price_paise"] = int(req.price_inr * 100)

    save_catalog_to_disk()
    new_version = touch_catalog_version()
    return {
        "status": "SUCCESS",
        "message": f"Product '{p.get('name')}' successfully added to your store inventory.",
        "product_id": req.product_id,
        "product": p,
        "version": new_version,
    }


@router.get("/api/seller/catalog")
def get_seller_catalog(
    merchant_id: str = "demo-merchant.myshopify.com",
    business_type: Optional[str] = None,
    scope: Optional[str] = None,
):
    """
    Return live inventory catalog for the seller portal, scoped to store-owned items or universal market.
    - If scope == 'store' (or business_type is provided and scope != 'market'):
        Returns ONLY items sold by this merchant.
    - If scope == 'market' or 'all' (or general request without query params):
        Returns all market items, with 'can_edit' and 'is_owned' authority flags.
    """
    effective_scope = scope
    if effective_scope is None:
        effective_scope = "store" if business_type else "all"

    profile = get_seller_profile()
    effective_business_type = business_type or profile.business_type

    m_data = DEMO_MERCHANT_CATALOG.get(merchant_id, {})
    prods = m_data.get("products", {})
    items = []

    for pid, p in prods.items():
        cat = p.get("category", "general")
        is_owned = is_product_sold_by_merchant(
            product_id=pid,
            merchant_id=merchant_id,
            business_type=effective_business_type,
            product_category=cat,
        )

        if effective_scope == "store" and not is_owned:
            continue

        price_inr = p["price_paise"] / 100.0
        cost_inr = p.get("supplier_cost_paise", int(p["price_paise"] * 0.72)) / 100.0
        margin_pct = round(((price_inr - cost_inr) / price_inr) * 100.0, 1) if price_inr > 0 else 25.0
        stock_cnt = p.get("stock", 25 if p.get("in_stock", True) else 0)

        items.append({
            "id": pid,
            "name": p["name"],
            "title": p["name"],
            "category": cat,
            "stock": stock_cnt,
            "inventoryStock": stock_cnt,
            "supplierCost": cost_inr,
            "supplierCostInr": cost_inr,
            "sellingPrice": price_inr,
            "sellingPriceInr": price_inr,
            "marginPct": margin_pct,
            "inStock": p.get("in_stock", stock_cnt > 0),
            "marketplaces": ["AP2 Gateway", "Amazon", "Flipkart"],
            "channels": ["AP2 Gateway", "Amazon", "Flipkart"],
            "daysIdle": 5,
            "daysInInventory": 5,
            "discountPct": 0,
            "autoClearanceDiscountPct": 0,
            "is_owned": is_owned,
            "can_edit": is_owned,
            "store_status": "In Your Store" if is_owned else "Universal Common Market",
        })

    return {
        "items": items,
        "version": state.get_catalog_version(),
        "total_count": len(items),
        "scope": effective_scope,
        "business_type": effective_business_type,
    }
