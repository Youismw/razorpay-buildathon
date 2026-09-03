"use client";

import React, { useState, useRef } from "react";
import { ArrowRight, Search, AlertTriangle, Sparkles, X } from "lucide-react";
import { MerchantCatalog } from "@/lib/types";
import { useCardGlow } from "@/hooks/useCardGlow";

interface CatalogViewProps {
  catalogs: Record<string, MerchantCatalog>;
  onBuyItem: (productName: string, priceInr: number, merchantId: string) => void;
}

interface ProductItem {
  merchantId: string;
  productId: string;
  name: string;
  price_paise: number;
  category: string;
  in_stock: boolean;
}

const CATEGORY_FILTERS = ["All", "groceries", "electronics", "audio", "fashion", "home", "books", "fitness"];

export const CatalogView: React.FC<CatalogViewProps> = ({ catalogs, onBuyItem }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [outOfStockItem, setOutOfStockItem] = useState<ProductItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  const allProducts: ProductItem[] = [];
  Object.entries(catalogs).forEach(([merchantId, catalog]) => {
    Object.entries(catalog.products).forEach(([productId, product]) => {
      allProducts.push({ merchantId, productId, ...product });
    });
  });

  const filtered = allProducts.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleProductClick = (product: ProductItem) => {
    const priceInr = product.price_paise / 100;
    if (!product.in_stock) {
      setOutOfStockItem(product);
    } else {
      onBuyItem(product.name, priceInr, product.merchantId);
    }
  };

  const handleFindAlternative = () => {
    if (!outOfStockItem) return;
    const priceInr = outOfStockItem.price_paise / 100;
    const targetItem = outOfStockItem;
    setOutOfStockItem(null);
    onBuyItem(`Buy in-stock alternative for ${targetItem.name}`, priceInr, targetItem.merchantId);
  };

  const handleForcePurchase = () => {
    if (!outOfStockItem) return;
    const priceInr = outOfStockItem.price_paise / 100;
    const targetItem = outOfStockItem;
    setOutOfStockItem(null);
    onBuyItem(targetItem.name, priceInr, targetItem.merchantId);
  };

  return (
    <div ref={containerRef} className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-32">
        {/* Header */}
        <div>
          <h2 className="display-heading text-2xl mb-1">Verified Merchant Catalog</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Products from UCP-connected merchants. Every price and inventory grounded against signed manifests.
          </p>
        </div>

        {/* Search + Category Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="input pl-10 text-sm py-2.5"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {CATEGORY_FILTERS.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[var(--brown)] text-white"
                    : "text-[var(--text-muted)] hover:bg-[var(--brown-faint)] hover:text-[var(--brown)]"
                }`}
              >
                {cat === "All" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((product) => {
            const priceInr = product.price_paise / 100;
            return (
              <div
                key={product.productId}
                className="card p-4 sm:p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md border border-[rgba(92,61,46,0.12)] bg-white"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-mono text-[var(--text-faint)] uppercase tracking-wider">
                      {product.category}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                      product.in_stock
                        ? "bg-emerald-50 text-[var(--stage-green)] border border-emerald-200/60"
                        : "bg-red-50 text-[var(--stage-red)] border border-red-200/60"
                    }`}>
                      {product.in_stock ? "● In Stock" : "● Out of Stock"}
                    </span>
                  </div>
                  <h4 className="text-sm font-semibold text-[var(--text-primary)] leading-snug mb-1">
                    {product.name}
                  </h4>
                  <p className="text-[11px] font-mono text-[var(--text-faint)]">
                    {product.merchantId}
                  </p>
                </div>

                {/* Price & Action Button Row */}
                <div className="pt-3 border-t border-[rgba(92,61,46,0.1)] flex items-center justify-between gap-3">
                  <div className="shrink-0">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[var(--text-faint)] block">
                      Verified Offer
                    </span>
                    <span className="text-base sm:text-lg font-bold text-[var(--brown-dark)] tabular-nums">
                      ₹{priceInr.toLocaleString("en-IN", { minimumFractionDigits: 0 })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleProductClick(product);
                    }}
                    className={`py-2 px-3.5 sm:px-4 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer active:scale-95 shrink-0 ${
                      product.in_stock
                        ? "bg-[var(--brown)] hover:bg-[var(--brown-dark)] text-white shadow-xs border border-[var(--gold)]/40 hover:shadow-md"
                        : "bg-red-50 text-red-700 border border-red-200 hover:bg-red-100"
                    }`}
                  >
                    {product.in_stock && <Sparkles className="w-3.5 h-3.5 text-[var(--gold-light)]" />}
                    <span>{product.in_stock ? "Buy with AI" : "Out of Stock"}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-white/80" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-[var(--text-faint)]">
            No products match your search.
          </div>
        )}
      </div>

      {/* Out of Stock Notice & Alternative Brand Discovery Modal */}
      {outOfStockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="card w-full max-w-md p-6 bg-white border border-[rgba(92,61,46,0.18)] rounded-2xl shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[var(--stage-red)]">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Product Out of Stock
                  </h3>
                  <span className="text-[10px] font-mono text-[var(--text-faint)]">
                    Merchant Inventory Gate
                  </span>
                </div>
              </div>
              <button
                onClick={() => setOutOfStockItem(null)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--brown-faint)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-1">
              <span className="text-xs font-semibold text-[var(--text-primary)] block">
                {outOfStockItem.name}
              </span>
              <p className="text-[11px] text-[var(--text-muted)]">
                This product is currently unavailable in the verified UCP catalog for <span className="font-mono">{outOfStockItem.merchantId}</span>.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={handleFindAlternative}
                className="btn-primary w-full py-2.5 px-4 text-xs inline-flex items-center justify-center gap-2 shadow-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Find In-Stock Alternative with AI</span>
              </button>
              <button
                onClick={handleForcePurchase}
                className="btn-secondary w-full py-2 px-4 text-xs"
              >
                <span>Simulate Direct Purchase (Test Guardrail Block)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

