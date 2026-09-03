"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Package,
  Search,
  Tag,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Plus,
  ExternalLink,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  Mic,
  MicOff,
} from "lucide-react";
import { SellerProfile, RoutineRestockItem } from "@/lib/sellerStore";
import { BACKEND_URL } from "@/lib/api";

interface SellerCatalogViewProps {
  profile: SellerProfile;
  sellerMode: "basic" | "advanced";
  onTriggerScan?: (productName: string) => void;
}

interface CatalogInventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  supplierCost: number;
  sellingPrice: number;
  marketplaces: string[];
  daysIdle: number;
  discountPct: number;
  inStock: boolean;
}

const SAMPLE_SELLER_CATALOG: CatalogInventoryItem[] = [
  {
    id: "PROD-WH-CH520",
    name: "Sony WH-CH520 Wireless Headphones",
    category: "electronics",
    stock: 42,
    supplierCost: 3600,
    sellingPrice: 4999,
    marketplaces: ["Amazon", "Flipkart", "AP2 Gateway"],
    daysIdle: 3,
    discountPct: 0,
    inStock: true,
  },
  {
    id: "PROD-BUDS-XM5",
    name: "Sony WF-1000XM5 Noise Canceling Earbuds",
    category: "electronics",
    stock: 18,
    supplierCost: 15200,
    sellingPrice: 19999,
    marketplaces: ["Amazon", "AP2 Gateway"],
    daysIdle: 5,
    discountPct: 0,
    inStock: true,
  },
  {
    id: "PROD-MILK-AMUL",
    name: "Amul Taaza Homogenised Toned Milk (1L)",
    category: "groceries",
    stock: 120,
    supplierCost: 58,
    sellingPrice: 72,
    marketplaces: ["AP2 Gateway", "ONDC Direct"],
    daysIdle: 1,
    discountPct: 0,
    inStock: true,
  },
  {
    id: "PROD-MILK-NANDINI",
    name: "Nandini Special Pasteurized Milk (1L)",
    category: "groceries",
    stock: 0,
    supplierCost: 44,
    sellingPrice: 56,
    marketplaces: ["AP2 Gateway", "ONDC Direct"],
    daysIdle: 12,
    discountPct: 0,
    inStock: false,
  },
  {
    id: "PROD-COFFEE-TOKAI",
    name: "Blue Tokai Attikan Dark Roast (250g)",
    category: "groceries",
    stock: 28,
    supplierCost: 330,
    sellingPrice: 470,
    marketplaces: ["Amazon", "AP2 Gateway"],
    daysIdle: 4,
    discountPct: 0,
    inStock: true,
  },
  {
    id: "PROD-SUN-AVIO",
    name: "Ray-Ban Aviator Gradient Sunglasses",
    category: "fashion",
    stock: 7,
    supplierCost: 8500,
    sellingPrice: 10199, // 15% clearance applied
    marketplaces: ["Flipkart", "AP2 Gateway"],
    daysIdle: 18,
    discountPct: 15,
    inStock: true,
  },
];

// ════════════════════════════════════════════════════════════════
// Proximity-Aware Delayed Hover Micro-Components (2s in, 1s fade)
// ════════════════════════════════════════════════════════════════

interface HoverRestockBadgeProps {
  itemId: string;
  itemName: string;
  onRestock: (id: string, qty: number) => void;
}

const HoverRestockBadge: React.FC<HoverRestockBadgeProps> = ({ itemId, itemName, onRestock }) => {
  const [visible, setVisible] = useState(false);
  const enterTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    enterTimer.current = setTimeout(() => {
      setVisible(true);
    }, 2000); // 2 seconds hover delay
  };

  const handleMouseLeave = () => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(() => {
      setVisible(false);
    }, 1000); // 1 second fade-out delay
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block py-1 -my-1 cursor-pointer select-none"
    >
      <span className="text-[10px] text-[var(--stage-red)] font-semibold bg-red-50 border border-red-200 px-1.5 py-0.5 rounded block">
        Stockout
      </span>

      {/* Floating Restock Option */}
      <div
        className={`absolute left-0 bottom-full mb-1.5 z-40 transition-all duration-1000 ease-out pointer-events-auto ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRestock(itemId, 50);
          }}
          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold shadow-xl whitespace-nowrap flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer border border-emerald-500"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Restock (+50 Units)</span>
        </button>
      </div>
    </div>
  );
};

interface HoverStockEditorProps {
  stock: number;
  itemId: string;
  itemName: string;
  onUpdateStock: (id: string, newStock: number) => void;
}

const HoverStockEditor: React.FC<HoverStockEditorProps> = ({ stock, itemId, itemName, onUpdateStock }) => {
  const [visible, setVisible] = useState(false);
  const enterTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    enterTimer.current = setTimeout(() => {
      setVisible(true);
    }, 2000); // 2 seconds hover delay
  };

  const handleMouseLeave = () => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(() => {
      setVisible(false);
    }, 1000); // 1 second fade-out delay
  };

  const handleClickChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = prompt(`Enter new inventory stock count for "${itemName}":`, String(stock));
    if (input !== null && input.trim() !== "") {
      const parsed = parseInt(input.trim(), 10);
      if (!isNaN(parsed) && parsed >= 0) {
        onUpdateStock(itemId, parsed);
        setVisible(false);
      }
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block py-1 -my-1 cursor-pointer select-none"
    >
      <div className="flex items-center gap-1.5">
        <span
          className={`w-2 h-2 rounded-full ${
            stock > 10
              ? "bg-[var(--stage-green)]"
              : stock > 0
              ? "bg-[var(--gold)]"
              : "bg-[var(--stage-red)]"
          }`}
        />
        <span className="font-bold tabular-nums text-sm text-[var(--text-primary)] hover:text-[var(--brown)] transition-colors">
          {stock} units
        </span>
      </div>

      {/* Floating Popup: Change stock number */}
      <div
        className={`absolute left-0 bottom-full mb-1.5 z-40 transition-all duration-1000 ease-out pointer-events-auto ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={handleClickChange}
          className="px-2.5 py-1 rounded-lg bg-[var(--brown-dark)] hover:bg-black text-white text-[11px] font-medium shadow-xl whitespace-nowrap flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer border border-[var(--gold)]/40"
        >
          <span>Change stock number</span>
        </button>
      </div>
    </div>
  );
};

interface HoverPriceEditorProps {
  sellingPrice: number;
  supplierCost: number;
  itemId: string;
  itemName: string;
  onUpdatePrice: (id: string, newPrice: number) => void;
}

const HoverPriceEditor: React.FC<HoverPriceEditorProps> = ({
  sellingPrice,
  supplierCost,
  itemId,
  itemName,
  onUpdatePrice,
}) => {
  const [visible, setVisible] = useState(false);
  const enterTimer = useRef<NodeJS.Timeout | null>(null);
  const leaveTimer = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (leaveTimer.current) {
      clearTimeout(leaveTimer.current);
      leaveTimer.current = null;
    }
    enterTimer.current = setTimeout(() => {
      setVisible(true);
    }, 2000); // 2 seconds hover delay
  };

  const handleMouseLeave = () => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
    leaveTimer.current = setTimeout(() => {
      setVisible(false);
    }, 1000); // 1 second fade-out delay
  };

  const handleClickChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    const input = prompt(`Enter new selling price (₹) for "${itemName}":`, String(sellingPrice));
    if (input !== null && input.trim() !== "") {
      const parsed = parseFloat(input.trim());
      if (!isNaN(parsed) && parsed > 0) {
        onUpdatePrice(itemId, parsed);
        setVisible(false);
      }
    }
  };

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="relative inline-block py-1 -my-1 cursor-pointer select-none"
    >
      <div className="space-y-0.5">
        <div className="font-bold text-[var(--brown-dark)] text-sm tabular-nums hover:text-[var(--brown)] transition-colors">
          ₹{sellingPrice.toLocaleString("en-IN")}
        </div>
        <div className="text-[10px] font-mono text-[var(--text-faint)]">
          Supplier: ₹{supplierCost.toLocaleString("en-IN")}
        </div>
      </div>

      {/* Floating Popup: Change price */}
      <div
        className={`absolute left-0 bottom-full mb-1.5 z-40 transition-all duration-1000 ease-out pointer-events-auto ${
          visible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-1 scale-95 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={handleClickChange}
          className="px-2.5 py-1 rounded-lg bg-[var(--brown-dark)] hover:bg-black text-white text-[11px] font-medium shadow-xl whitespace-nowrap flex items-center gap-1.5 transition-transform active:scale-95 cursor-pointer border border-[var(--gold)]/40"
        >
          <span>Change price</span>
        </button>
      </div>
    </div>
  );
};

export const SellerCatalogView: React.FC<SellerCatalogViewProps> = ({
  profile,
  sellerMode,
  onTriggerScan,
}) => {
  const [items, setItems] = useState<CatalogInventoryItem[]>(SAMPLE_SELLER_CATALOG);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Voice Search State
  const [isCatalogListening, setIsCatalogListening] = useState(false);
  const catalogRecognitionRef = useRef<any>(null);

  const handleCatalogVoiceSearch = () => {
    if (isCatalogListening) {
      catalogRecognitionRef.current?.stop();
      setIsCatalogListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice search is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-IN";
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsCatalogListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setSearch(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        setIsCatalogListening(false);
      };

      recognition.onend = () => {
        setIsCatalogListening(false);
      };

      catalogRecognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start voice recognition:", err);
      setIsCatalogListening(false);
    }
  };

  // Add Product Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("groceries");
  const [newProductCost, setNewProductCost] = useState<number>(280);
  const [newProductPrice, setNewProductPrice] = useState<number>(350);
  const [newProductStock, setNewProductStock] = useState<number>(30);
  const [newProductMargin, setNewProductMargin] = useState<number>(20);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addSuccessMsg, setAddSuccessMsg] = useState<string | null>(null);

  // Synchronize price when cost or margin changes
  const handleCostChange = (cost: number) => {
    setNewProductCost(cost);
    const calculatedPrice = Math.round(cost * (1 + newProductMargin / 100));
    setNewProductPrice(calculatedPrice);
  };

  const handleMarginChange = (margin: number) => {
    setNewProductMargin(margin);
    const calculatedPrice = Math.round(newProductCost * (1 + margin / 100));
    setNewProductPrice(calculatedPrice);
  };

  const handlePriceChange = (price: number) => {
    setNewProductPrice(price);
    if (price > newProductCost && newProductCost > 0) {
      const calculatedMargin = Math.round(((price - newProductCost) / price) * 100);
      setNewProductMargin(calculatedMargin);
    }
  };

  const handleAddProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProductName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/seller/catalog/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProductName.trim(),
          price_inr: Number(newProductPrice),
          category: newProductCategory,
          stock: Number(newProductStock),
          supplier_cost_inr: Number(newProductCost),
          merchant_id: "demo-merchant.myshopify.com",
        }),
      });

      const data = await res.json();
      if (data.status === "SUCCESS") {
        const newItem: CatalogInventoryItem = {
          id: data.product_id,
          name: newProductName.trim(),
          category: newProductCategory,
          stock: Number(newProductStock),
          supplierCost: Number(newProductCost),
          sellingPrice: Number(newProductPrice),
          marketplaces: ["AP2 Gateway", "Amazon", "Flipkart"],
          daysIdle: 0,
          discountPct: 0,
          inStock: Number(newProductStock) > 0,
        };
        setItems((prev) => [newItem, ...prev]);
        setAddSuccessMsg(
          `Successfully listed "${newProductName.trim()}" in AP2 Catalog at ₹${newProductPrice} (+${newProductMargin}% margin)!`
        );
        setIsAddModalOpen(false);
        setNewProductName("");
        setNewProductCost(280);
        setNewProductPrice(350);
        setNewProductStock(30);
        setNewProductMargin(20);
        setTimeout(() => setAddSuccessMsg(null), 4000);
      }
    } catch (err) {
      console.error("Failed to add product to catalog:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/seller/catalog`)
      .then((res) => res.json())
      .then((data) => {
        if (data.items && data.items.length > 0) {
          setItems(
            data.items.map((it: any) => ({
              id: it.id,
              name: it.title,
              category: it.category || "general",
              stock: it.inventoryStock ?? 0,
              supplierCost: it.supplierCostInr ?? 0,
              sellingPrice: it.sellingPriceInr ?? 0,
              marketplaces: it.channels || ["AP2 Gateway", "Amazon", "Flipkart"],
              daysIdle: it.daysInInventory || 4,
              discountPct: it.autoClearanceDiscountPct || 0,
              inStock: (it.inventoryStock ?? 0) > 0,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  const filtered = items.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["All", "electronics", "groceries", "fashion", "home", "beauty", "books"];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="display-heading text-2xl mb-1">Merchant Catalog & Inventory</h2>
          <p className="text-sm text-[var(--text-muted)]">
            Multi-marketplace syndication across Amazon, Flipkart, ONDC, and AP2 Agentic Gateway.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-lg bg-[var(--gold-faint)] border border-[var(--gold)] text-xs font-mono text-[var(--brown)] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Auto-Clearance Active (14d/30d)</span>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn-primary py-2 px-4 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {addSuccessMsg && (
        <div className="p-3.5 rounded-xl bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.25)] text-xs font-semibold text-[var(--stage-green)] flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{addSuccessMsg}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full sm:max-w-md flex items-center">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search inventory or use voice..."
            className="input pl-10 pr-10 text-sm py-2 w-full"
          />
          <button
            type="button"
            onClick={handleCatalogVoiceSearch}
            title={isCatalogListening ? "Listening... Click to stop" : "Voice search inventory"}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isCatalogListening
                ? "bg-red-500 text-white animate-pulse"
                : "text-[var(--text-muted)] hover:text-[var(--brown)] hover:bg-[var(--brown-faint)]"
            }`}
          >
            {isCatalogListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === cat
                  ? "bg-[var(--brown)] text-white"
                  : "bg-white border border-[rgba(92,61,46,0.1)] text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
              }`}
            >
              {cat === "All" ? "All Categories" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[var(--brown-faint)]/40 border-b border-[rgba(92,61,46,0.08)] text-[var(--text-faint)] font-mono uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Product / SKU</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Cost vs Selling Price</th>
                <th className="py-3 px-4">Gross Margin</th>
                <th className="py-3 px-4">Syndicated Channels</th>
                <th className="py-3 px-4">Clearance Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(92,61,46,0.06)]">
              {filtered.map((item) => {
                const sp = item.sellingPrice || 0;
                const sc = item.supplierCost || 0;
                const marginInr = sp - sc;
                const marginPct = sp > 0 ? ((marginInr / sp) * 100).toFixed(1) : "25.0";

                return (
                  <tr key={item.id} className="hover:bg-[var(--brown-faint)]/20 transition-colors">
                    <td className="py-3.5 px-4 font-medium text-[var(--text-primary)]">
                      <div className="font-semibold text-sm">{item.name}</div>
                      <span className="text-[10px] font-mono text-[var(--text-faint)]">{item.id}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[var(--brown-faint)] text-[var(--brown)]">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <HoverStockEditor
                          stock={item.stock || 0}
                          itemId={item.id}
                          itemName={item.name}
                          onUpdateStock={(id, newStock) => {
                            setItems((prev) =>
                              prev.map((it) => (it.id === id ? { ...it, stock: newStock, inStock: newStock > 0 } : it))
                            );
                            setAddSuccessMsg(`Stock for "${item.name}" updated to ${newStock} units`);
                            setTimeout(() => setAddSuccessMsg(null), 3000);
                            fetch(`${BACKEND_URL}/api/seller/catalog/update`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ product_id: id, stock: newStock }),
                            }).catch(() => {});
                          }}
                        />
                        {(item.stock || 0) === 0 && (
                          <HoverRestockBadge
                            itemId={item.id}
                            itemName={item.name}
                            onRestock={(id, qty) => {
                              setItems((prev) =>
                                prev.map((it) => (it.id === id ? { ...it, stock: qty, inStock: true } : it))
                              );
                              setAddSuccessMsg(`Successfully restocked "${item.name}" with +${qty} units!`);
                              setTimeout(() => setAddSuccessMsg(null), 4000);
                              fetch(`${BACKEND_URL}/api/seller/catalog/update`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ product_id: id, stock: qty }),
                              }).catch(() => {});
                            }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <HoverPriceEditor
                        sellingPrice={sp}
                        supplierCost={sc}
                        itemId={item.id}
                        itemName={item.name}
                        onUpdatePrice={(id, newPrice) => {
                          setItems((prev) =>
                            prev.map((it) => (it.id === id ? { ...it, sellingPrice: newPrice } : it))
                          );
                          setAddSuccessMsg(`Selling price for "${item.name}" updated to ₹${newPrice}`);
                          setTimeout(() => setAddSuccessMsg(null), 3000);
                          fetch(`${BACKEND_URL}/api/seller/catalog/update`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ product_id: id, price_inr: newPrice }),
                          }).catch(() => {});
                        }}
                      />
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-[rgba(34,197,94,0.1)] text-[var(--stage-green)] border border-[rgba(34,197,94,0.2)]">
                        +{marginPct}%
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                        +₹{marginInr.toLocaleString("en-IN")} net
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1">
                        {item.marketplaces.map((mp) => (
                          <span
                            key={mp}
                            className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-white border border-[rgba(92,61,46,0.12)] text-[var(--brown-dark)]"
                          >
                            {mp}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {item.discountPct > 0 ? (
                        <div className="space-y-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(239,68,68,0.1)] text-[var(--stage-red)] border border-[rgba(239,68,68,0.2)]">
                            {item.discountPct}% Markdown Applied
                          </span>
                          <span className="text-[10px] font-mono text-[var(--text-faint)] block">
                            {item.daysIdle}d idle
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[var(--text-muted)] text-[11px]">
                          <Clock className="w-3 h-3 text-[var(--text-faint)]" />
                          <span>{item.daysIdle}d on shelf</span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="card w-full max-w-lg bg-white border border-[rgba(92,61,46,0.18)] rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-4 border-b border-[rgba(92,61,46,0.08)] flex items-center justify-between bg-[var(--white-warm)]/60">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--gold-faint)] flex items-center justify-center">
                  <Package className="w-4 h-4 text-[var(--brown)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--brown-dark)]">
                    Add Product to Inventory
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Direct entry into AP2 Universal Commerce Catalog
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--brown-faint)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddProductSubmit} className="p-5 space-y-4">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Artisan Blue Cheese (200g) or Sony XM5..."
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl"
                />
              </div>

              {/* Category & Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Category
                  </label>
                  <select
                    value={newProductCategory}
                    onChange={(e) => setNewProductCategory(e.target.value)}
                    className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl"
                  >
                    <option value="groceries">Groceries & Gourmet</option>
                    <option value="electronics">Electronics & Audio</option>
                    <option value="fashion">Fashion & Apparel</option>
                    <option value="home">Home & Kitchen</option>
                    <option value="beauty">Beauty & Personal Care</option>
                    <option value="books">Books & Stationery</option>
                    <option value="general">General Merchandise</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-[var(--text-primary)]">
                    Initial Stock (Units)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newProductStock}
                    onChange={(e) => setNewProductStock(Number(e.target.value))}
                    className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl"
                  />
                </div>
              </div>

              {/* Pricing & Margin Synchronizer */}
              <div className="p-3.5 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.1)] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--brown-dark)]">
                    Pricing & Profit Margin Calculator
                  </span>
                  <span className="text-[10px] font-mono text-[var(--stage-green)] font-bold">
                    +{newProductMargin}% Margin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--text-muted)] font-medium">
                      Wholesale Cost (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newProductCost}
                      onChange={(e) => handleCostChange(Number(e.target.value))}
                      className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-[var(--text-muted)] font-medium">
                      Selling Price (₹)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={newProductPrice}
                      onChange={(e) => handlePriceChange(Number(e.target.value))}
                      className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl font-mono font-bold text-[var(--brown-dark)]"
                    />
                  </div>
                </div>

                {/* Margin Slider */}
                <div className="space-y-1 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[var(--text-muted)]">Target Profit Margin</span>
                    <span className="font-mono font-bold text-[var(--brown-dark)]">
                      Net Profit: ₹{(newProductPrice - newProductCost).toLocaleString("en-IN")} / unit
                    </span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="1"
                    value={newProductMargin}
                    onChange={(e) => handleMarginChange(Number(e.target.value))}
                    className="w-full accent-[var(--brown)] cursor-pointer"
                  />
                </div>
              </div>

              {/* Multi-Channel Syndication Notice */}
              <div className="text-[11px] font-mono text-[var(--text-muted)] bg-white p-2.5 rounded-xl border border-[rgba(92,61,46,0.08)] flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--stage-green)] shrink-0" />
                <span>Automatically syndicates to AP2 Agentic Gateway, Amazon, and Flipkart</span>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="btn-secondary py-2 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newProductName.trim()}
                  className="btn-primary py-2 px-5 text-xs font-semibold shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Listing Item...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>List in Catalog</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
