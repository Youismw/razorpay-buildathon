"""
Guardrail Shell — Grounding Oracle (FR-GRD-004)
Verifies that LLM-proposed prices/products are grounded in a verified merchant catalog.

Thread 0 MVP: Mock implementation with a hardcoded demo merchant manifest.
Production: Compares against injected UCP manifest with cryptographic hashes.
"""

import os
import json
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
from modules.guardrail_shell.schema_validator import ProposalItem


class GroundingCheckResult(BaseModel):
    verified: bool
    manifest_hash: Optional[str] = None
    unverified_items: List[str] = Field(default_factory=list)
    details: Dict[str, Any] = Field(default_factory=dict)


# --- Thread 0 Verified Merchant Catalog (Expanded Multicategory Inventory) ---
DEMO_MERCHANT_CATALOG: Dict[str, Dict[str, Any]] = {
    "demo-merchant.myshopify.com": {
        "manifest_hash": "sha256:demo_manifest_v2_2026",
        "products": {
            # Electronics
            "PROD-WH-CH520": {
                "name": "Sony WH-CH520 Wireless Headphones",
                "price_paise": 499900,
                "category": "electronics",
                "in_stock": True,
            },
            "PROD-BUDS-XM5": {
                "name": "Sony WF-1000XM5 Noise Canceling Earbuds",
                "price_paise": 1999900,
                "category": "electronics",
                "in_stock": True,
            },
            "PROD-WATCH-GT4": {
                "name": "Huawei Watch GT 4 (46mm Amoled)",
                "price_paise": 1699900,
                "category": "electronics",
                "in_stock": True,
            },
            "PROD-KB-MECH": {
                "name": "Keychron K2 Wireless Mechanical Keyboard",
                "price_paise": 749900,
                "category": "electronics",
                "in_stock": True,
            },
            "PROD-LOGI-MX3S": {
                "name": "Logitech MX Master 3S Wireless Mouse",
                "price_paise": 899500,
                "category": "electronics",
                "in_stock": True,
            },
            # Audio
            "PROD-SPK-MINI3": {
                "name": "Anker Soundcore Mini 3 Bluetooth Speaker",
                "price_paise": 99900,
                "category": "audio",
                "in_stock": True,
            },
            "PROD-AIR-350": {
                "name": "JBL Tune 350BT On-Ear Wireless Headphones",
                "price_paise": 299900,
                "category": "audio",
                "in_stock": True,
            },
            "PROD-BOSE-QC45": {
                "name": "Bose QuietComfort 45 Bluetooth Headphones",
                "price_paise": 2499000,
                "category": "audio",
                "in_stock": True,
            },
            "PROD-MARSHALL-EMB": {
                "name": "Marshall Emberton II Portable Speaker",
                "price_paise": 1499900,
                "category": "audio",
                "in_stock": True,
            },
            # Fashion & Apparel
            "PROD-SNK-550": {
                "name": "New Balance 550 Classic Sneakers (White/Brown)",
                "price_paise": 1099900,
                "category": "fashion",
                "in_stock": True,
            },
            "PROD-BAG-ROLL": {
                "name": "Samsonite Rolltop Commuter Backpack 22L",
                "price_paise": 399900,
                "category": "fashion",
                "in_stock": True,
            },
            "PROD-SUN-AVIO": {
                "name": "Ray-Ban Aviator Classic Gradient Sunglasses",
                "price_paise": 1199000,
                "category": "fashion",
                "in_stock": True,
            },
            "PROD-HOODIE-COSY": {
                "name": "Heavyweight Organic Cotton Oversized Hoodie",
                "price_paise": 249900,
                "category": "fashion",
                "in_stock": True,
            },
            "PROD-WATCH-TIMEX": {
                "name": "Timex Marlin Automatic Leather Watch",
                "price_paise": 1449500,
                "category": "fashion",
                "in_stock": True,
            },
            # Home & Kitchen
            "PROD-COF-V60": {
                "name": "Hario V60 Ceramic Pour Over Coffee Dripper Set",
                "price_paise": 189900,
                "category": "home",
                "in_stock": True,
            },
            "PROD-LAMP-LED": {
                "name": "BenQ ScreenBar e-Reading Monitor Desk Lamp",
                "price_paise": 899900,
                "category": "home",
                "in_stock": True,
            },
            "PROD-AIR-PUR": {
                "name": "Mi Smart Air Purifier 4 Lite (HEPA Filter)",
                "price_paise": 849900,
                "category": "home",
                "in_stock": True,
            },
            "PROD-KETTLE-GOOS": {
                "name": "Fellow Stagg EKG Electric Gooseneck Kettle",
                "price_paise": 1599900,
                "category": "home",
                "in_stock": True,
            },
            "PROD-DIFFUSER-ARO": {
                "name": "Muji Ultrasonic Aroma Diffuser (Large)",
                "price_paise": 429000,
                "category": "home",
                "in_stock": True,
            },
            # Books & Publications
            "PROD-BOOK-DDIA": {
                "name": "Designing Data-Intensive Applications by Martin Kleppmann",
                "price_paise": 349900,
                "category": "books",
                "in_stock": True,
            },
            "PROD-BOOK-RUST": {
                "name": "The Rust Programming Language by Steve Klabnik",
                "price_paise": 289900,
                "category": "books",
                "in_stock": True,
            },
            "PROD-BOOK-CLEAN": {
                "name": "Clean Architecture by Robert C. Martin",
                "price_paise": 199900,
                "category": "books",
                "in_stock": True,
            },
            "PROD-BOOK-PSYCH": {
                "name": "The Psychology of Money by Morgan Housel",
                "price_paise": 39900,
                "category": "books",
                "in_stock": True,
            },
            # Fitness & Wellness
            "PROD-MAT-YOGA": {
                "name": "Manduka PRO 6mm High-Density Yoga Mat",
                "price_paise": 799900,
                "category": "fitness",
                "in_stock": True,
            },
            "PROD-BAND-RES": {
                "name": "Theraband Professional Resistance Bands Set",
                "price_paise": 129900,
                "category": "fitness",
                "in_stock": True,
            },
            # Daily Groceries & Essentials (Multi-Brand)
            "PROD-MILK-AMUL": {
                "name": "Amul Taaza Homogenised Toned Milk (1L)",
                "price_paise": 7200,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-MILK-CD": {
                "name": "Country Delight Pure Cow Milk (1L)",
                "price_paise": 8500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-MILK-NANDINI": {
                "name": "Nandini Special Pasteurized Milk (1L)",
                "price_paise": 5600,
                "category": "groceries",
                "in_stock": False,  # Simulated Out of Stock for brand alternative test
            },
            "PROD-MILK-EPI": {
                "name": "Epigamia Almond Milk Unsweetened (1L)",
                "price_paise": 24000,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-COF-NES": {
                "name": "Nescafé Classic Instant Coffee Glass Jar (100g)",
                "price_paise": 36000,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-COF-BT": {
                "name": "Blue Tokai Attikan Estate Dark Roast Coffee (250g)",
                "price_paise": 47000,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-ATTA-AASH": {
                "name": "Aashirvaad Superior MP Shudh Chakki Atta (5kg)",
                "price_paise": 27500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-ATTA-FORT": {
                "name": "Fortune Chakki Fresh Whole Wheat Atta (5kg)",
                "price_paise": 24500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-BRD-BRIT": {
                "name": "Britannia 100% Whole Wheat Bread (400g)",
                "price_paise": 5500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-BRD-TBD": {
                "name": "The Baker's Dozen Country Sourdough Loaf (350g)",
                "price_paise": 14000,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-BTR-AMUL": {
                "name": "Amul Pasteurized Salted Table Butter (500g)",
                "price_paise": 28500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-BTR-PRES": {
                "name": "Président Salted Gourmet Butter (200g)",
                "price_paise": 32000,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-EGG-EGGOZ": {
                "name": "Eggoz Nutra-Plus Farm Fresh Herbal Eggs (Box of 6)",
                "price_paise": 9500,
                "category": "groceries",
                "in_stock": True,
            },
            "PROD-EGG-REG": {
                "name": "Farm Fresh White Eggs (Pack of 6)",
                "price_paise": 4800,
                "category": "groceries",
                "in_stock": True,
            },
        },
    }
}


def verify_grounding(
    items: List[ProposalItem],
    catalog: Optional[Dict[str, Dict[str, Any]]] = None,
) -> GroundingCheckResult:
    """
    Verify each proposed item against the merchant catalog manifest.
    For Thread 0: uses DEMO_MERCHANT_CATALOG.
    Returns verified=True only if ALL items are grounded.
    """
    if catalog is None:
        catalog = DEMO_MERCHANT_CATALOG

    unverified: List[str] = []
    details: Dict[str, Any] = {}
    manifest_hash = None

    for item in items:
        merchant_data = catalog.get(item.merchant_id)

        if merchant_data is None:
            unverified.append(f"{item.product_id}: merchant '{item.merchant_id}' not in catalog")
            details[item.product_id] = {"status": "MERCHANT_NOT_FOUND"}
            continue

        manifest_hash = merchant_data.get("manifest_hash")
        products = merchant_data.get("products", {})
        product_data = products.get(item.product_id)

        if product_data is None:
            unverified.append(f"{item.product_id}: product not found in merchant catalog")
            details[item.product_id] = {"status": "PRODUCT_NOT_FOUND"}
            continue

        # Price grounding: proposed price must match or be below catalog price
        if item.offer_price_paise > product_data["price_paise"]:
            unverified.append(
                f"{item.product_id}: proposed price {item.offer_price_paise} exceeds "
                f"catalog price {product_data['price_paise']}"
            )
            details[item.product_id] = {
                "status": "PRICE_MISMATCH",
                "proposed": item.offer_price_paise,
                "catalog": product_data["price_paise"],
            }
            continue

        # Stock check
        if not product_data.get("in_stock", False):
            unverified.append(f"{item.product_id}: product is out of stock")
            details[item.product_id] = {"status": "OUT_OF_STOCK"}
            continue

        details[item.product_id] = {
            "status": "VERIFIED",
            "catalog_price": product_data["price_paise"],
            "proposed_price": item.offer_price_paise,
        }

    return GroundingCheckResult(
        verified=len(unverified) == 0,
        manifest_hash=manifest_hash,
        unverified_items=unverified,
        details=details,
    )


CATALOG_FILE_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "global_catalog.json")


def save_catalog_to_disk() -> None:
    """Persist global catalog to disk so changes are permanent across all sessions."""
    try:
        os.makedirs(os.path.dirname(CATALOG_FILE_PATH), exist_ok=True)
        with open(CATALOG_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(DEMO_MERCHANT_CATALOG, f, indent=2)
    except Exception as e:
        print(f"[CATALOG PERSISTENCE] Warning: failed to save catalog: {e}")


def load_catalog_from_disk() -> None:
    """Load persisted catalog from disk on server startup."""
    global DEMO_MERCHANT_CATALOG
    try:
        if os.path.exists(CATALOG_FILE_PATH):
            with open(CATALOG_FILE_PATH, "r", encoding="utf-8") as f:
                saved = json.load(f)
                if isinstance(saved, dict) and "demo-merchant.myshopify.com" in saved:
                    DEMO_MERCHANT_CATALOG.clear()
                    DEMO_MERCHANT_CATALOG.update(saved)
    except Exception as e:
        print(f"[CATALOG PERSISTENCE] Warning: failed to load catalog: {e}")


# Initialize from disk if persistent file exists
load_catalog_from_disk()


def add_or_update_product(
    merchant_id: str,
    product_id: str,
    product_data: Dict[str, Any],
) -> Dict[str, Any]:
    """Dynamically add or update a product in the unified AP2 merchant catalog."""
    if merchant_id not in DEMO_MERCHANT_CATALOG:
        DEMO_MERCHANT_CATALOG[merchant_id] = {
            "merchant_name": "Apex Goods & Electronics",
            "manifest_hash": "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
            "products": {},
        }

    DEMO_MERCHANT_CATALOG[merchant_id]["products"][product_id] = {
        "name": product_data["name"],
        "price_paise": product_data["price_paise"],
        "category": product_data.get("category", "general"),
        "in_stock": product_data.get("in_stock", True),
        "stock": product_data.get("stock", 25),
        "supplier_cost_paise": product_data.get("supplier_cost_paise", int(product_data["price_paise"] * 0.75)),
    }
    save_catalog_to_disk()
    return DEMO_MERCHANT_CATALOG[merchant_id]["products"][product_id]


def decrement_inventory(
    merchant_id: str,
    product_id: str,
    quantity: int = 1,
) -> Dict[str, Any]:
    """Reduce product stock upon successful settlement, updating stock quantity and in_stock flag."""
    merchant_data = DEMO_MERCHANT_CATALOG.get(merchant_id)
    if not merchant_data:
        return {"status": "MERCHANT_NOT_FOUND"}

    products = merchant_data.get("products", {})
    product = products.get(product_id)
    if not product:
        return {"status": "PRODUCT_NOT_FOUND"}

    current_stock = product.get("stock", 20)
    new_stock = max(0, current_stock - quantity)
    product["stock"] = new_stock
    if new_stock == 0:
        product["in_stock"] = False

    save_catalog_to_disk()

    return {
        "status": "DECREMENTED",
        "product_id": product_id,
        "previous_stock": current_stock,
        "remaining_stock": new_stock,
        "in_stock": product["in_stock"],
    }

