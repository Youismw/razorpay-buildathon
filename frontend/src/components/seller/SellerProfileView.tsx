"use client";

import React, { useState } from "react";
import {
  Building2,
  Bot,
  UserCheck,
  Shield,
  Layers,
  Save,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  Sliders,
} from "lucide-react";
import { SellerProfile, RoutineRestockItem } from "@/lib/sellerStore";
import { BACKEND_URL } from "@/lib/api";

interface SellerProfileViewProps {
  profile: SellerProfile;
  onSaveProfile: (profile: SellerProfile) => void;
}

export const SellerProfileView: React.FC<SellerProfileViewProps> = ({
  profile,
  onSaveProfile,
}) => {
  const [formData, setFormData] = useState<SellerProfile>(profile);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [newRestockName, setNewRestockName] = useState("");
  const [newRestockCost, setNewRestockCost] = useState<number>(100);
  const [newRestockMargin, setNewRestockMargin] = useState<number>(formData.defaultMarginPct || 25);
  const [newRestockQty, setNewRestockQty] = useState<number>(50);
  const [newRestockCategory, setNewRestockCategory] = useState<string>("groceries");

  const handleSave = () => {
    onSaveProfile(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleAddRestockItem = () => {
    if (!newRestockName.trim()) return;
    const newItem: RoutineRestockItem = {
      id: `restock-${Date.now()}`,
      productName: newRestockName.trim(),
      category: newRestockCategory,
      supplierCostInr: newRestockCost,
      currentStock: 50,
      restockThreshold: 15,
      restockQuantity: newRestockQty,
      restockIntervalDays: 7,
      preferredMarginPct: newRestockMargin,
    };
    setFormData({
      ...formData,
      routineRestockItems: [...formData.routineRestockItems, newItem],
    });

    // Also syndicate to backend catalog automatically so buyers and AI can immediately find it
    const calculatedPrice = Math.round(newRestockCost * (1 + newRestockMargin / 100));
    fetch(`${BACKEND_URL}/api/seller/catalog/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newRestockName.trim(),
        price_inr: calculatedPrice,
        category: newRestockCategory,
        stock: newRestockQty,
        supplier_cost_inr: newRestockCost,
        merchant_id: "demo-merchant.myshopify.com",
      }),
    }).catch(() => {});

    setNewRestockName("");
    setNewRestockCost(100);
    setNewRestockQty(50);
  };

  const handleRemoveRestockItem = (id: string) => {
    setFormData({
      ...formData,
      routineRestockItems: formData.routineRestockItems.filter((it) => it.id !== id),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h2 className="display-heading text-2xl mb-1">Merchant Profile & Governance</h2>
        <p className="text-sm text-[var(--text-muted)]">
          Configure merchant autonomy, business classification, and multi-marketplace API credentials.
        </p>
      </div>

      {/* General Information */}
      <div className="card p-6 space-y-5">
        <h3 className="text-sm font-bold text-[var(--brown-dark)]">
          Store Information & Industry
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)]">Store Name</label>
            <input
              type="text"
              value={formData.storeName}
              onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
              className="input text-sm py-2"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)]">Merchant ID (UCP Canonical)</label>
            <input
              type="text"
              value={formData.merchantId}
              disabled
              className="input text-sm py-2 bg-[var(--brown-faint)]/40 text-[var(--text-muted)] font-mono"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-[var(--text-primary)]">Primary Business Category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: "electronics", label: "💻 Electronics & Tech" },
                { id: "groceries", label: "🛒 Groceries & FMCG" },
                { id: "fashion", label: "👗 Fashion & Apparel" },
                { id: "beauty", label: "💄 Beauty & Personal Care" },
                { id: "home", label: "🏡 Home & Kitchen" },
                { id: "hardware", label: "🔧 Hardware & Tools" },
                { id: "construction", label: "🏗️ Construction & Bulk" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFormData({ ...formData, businessType: cat.id as any })}
                  className={`p-2.5 rounded-xl border text-xs font-medium text-left transition-all ${
                    formData.businessType === cat.id
                      ? "bg-[var(--brown)] text-white border-[var(--brown)]"
                      : "bg-white border-[rgba(92,61,46,0.12)] text-[var(--text-muted)] hover:bg-[var(--brown-faint)]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Autonomy Level */}
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-bold text-[var(--brown-dark)]">
          AI Merchant Autonomy Mode
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => setFormData({ ...formData, autonomyMode: "autonomous" })}
            className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
              formData.autonomyMode === "autonomous"
                ? "bg-[var(--gold-faint)]/40 border-[var(--gold)] shadow-xs"
                : "bg-white border-[rgba(92,61,46,0.12)] hover:bg-[var(--brown-faint)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-[var(--brown)]" />
                <span className="text-sm font-bold text-[var(--brown-dark)]">Fully Autonomous AI</span>
              </div>
              {formData.autonomyMode === "autonomous" && (
                <CheckCircle2 className="w-4 h-4 text-[var(--stage-green)]" />
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              AI automatically manages product syndication, competitive repricing, 14-day clearance discounts, and delivery dispatch.
            </p>
          </button>

          <button
            onClick={() => setFormData({ ...formData, autonomyMode: "manual_approval" })}
            className={`p-4 rounded-xl border text-left transition-all space-y-2 ${
              formData.autonomyMode === "manual_approval"
                ? "bg-[var(--brown-faint)] border-[var(--brown)] shadow-xs"
                : "bg-white border-[rgba(92,61,46,0.12)] hover:bg-[var(--brown-faint)]/30"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[var(--brown)]" />
                <span className="text-sm font-bold text-[var(--brown-dark)]">Manual Approval Required</span>
              </div>
              {formData.autonomyMode === "manual_approval" && (
                <CheckCircle2 className="w-4 h-4 text-[var(--stage-green)]" />
              )}
            </div>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              AI prepares listing proposals and carrier bookings, but requires explicit merchant PIN/confirmation before publishing.
            </p>
          </button>
        </div>
      </div>

      {/* Target Margin & Clearance Rules */}
      <div className="card p-6 space-y-5">
        <h3 className="text-sm font-bold text-[var(--brown-dark)]">
          Target Profit Margins & Automated Clearance
        </h3>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">Default Target Profit Margin</span>
              <span className="font-bold text-[var(--stage-green)] font-mono">+{formData.defaultMarginPct}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="60"
              step="1"
              value={formData.defaultMarginPct}
              onChange={(e) => setFormData({ ...formData, defaultMarginPct: Number(e.target.value) })}
              className="w-full accent-[var(--brown)] cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-xl bg-[var(--brown-faint)]/40 border border-[rgba(92,61,46,0.08)] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--brown-dark)]">
                Automated Inventory Clearance Markdowns
              </span>
              <input
                type="checkbox"
                checked={formData.autoClearanceEnabled}
                onChange={(e) => setFormData({ ...formData, autoClearanceEnabled: e.target.checked })}
                className="accent-[var(--brown)] w-4 h-4 cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Automatically applies a 15% discount on items idle for &gt; 14 days, and 30% discount on items idle for &gt; 30 days.
            </p>
          </div>
        </div>
      </div>

      {/* Routine Restock Staples (Basic Mode) */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--brown-dark)]">
              Routine Restock Staples (Basic Mode Defaults)
            </h3>
            <p className="text-[11px] text-[var(--text-muted)]">
              Pre-configured inventory items for 1-click routine supplier restocking.
            </p>
          </div>
        </div>

        {/* Existing Items */}
        <div className="space-y-2">
          {formData.routineRestockItems.map((item) => {
            const margin = item.preferredMarginPct || formData.defaultMarginPct || 25;
            const sellingPrice = Math.round(item.supplierCostInr * (1 + margin / 100));
            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--brown-faint)]/30 border border-[rgba(92,61,46,0.08)] text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text-primary)]">{item.productName}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-mono bg-white text-[var(--brown)] border border-[rgba(92,61,46,0.1)]">
                      {item.category || "staple"}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--text-faint)] block mt-0.5">
                    Cost: ₹{item.supplierCostInr} • Target Price: ₹{sellingPrice} (+{margin}% margin) • Qty: {item.restockQuantity} units
                  </span>
                </div>
                <button
                  onClick={() => handleRemoveRestockItem(item.id)}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--stage-red)]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Add New Restock Item */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddRestockItem();
          }}
          className="space-y-3 pt-3 border-t border-[rgba(92,61,46,0.06)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2">
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                Staple Product Name *
              </label>
              <input
                type="text"
                placeholder="e.g. Artisan Blue Cheese, Amul Milk, Whole Wheat Bread..."
                value={newRestockName}
                onChange={(e) => setNewRestockName(e.target.value)}
                className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                Category
              </label>
              <select
                value={newRestockCategory}
                onChange={(e) => setNewRestockCategory(e.target.value)}
                className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl"
              >
                <option value="groceries">Groceries</option>
                <option value="electronics">Electronics</option>
                <option value="fashion">Fashion</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                Wholesale Cost (₹)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Cost (₹)"
                value={newRestockCost || ""}
                onChange={(e) => setNewRestockCost(Number(e.target.value))}
                className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                Target Margin (%)
              </label>
              <input
                type="number"
                min="1"
                max="100"
                placeholder="Margin %"
                value={newRestockMargin || ""}
                onChange={(e) => setNewRestockMargin(Number(e.target.value))}
                className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[var(--text-muted)] block mb-1">
                Restock Qty (Units)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Quantity"
                value={newRestockQty || ""}
                onChange={(e) => setNewRestockQty(Number(e.target.value))}
                className="input text-xs w-full py-2 bg-white text-[var(--text-primary)] border border-[rgba(92,61,46,0.18)] rounded-xl font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={!newRestockName.trim()}
              className="btn-primary text-xs py-2 px-4 inline-flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Staple</span>
            </button>
          </div>

          {newRestockCost > 0 && (
            <div className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--brown-faint)]/40 p-2 rounded-lg flex items-center justify-between">
              <span>Calculated Selling Price:</span>
              <span className="font-bold text-[var(--brown-dark)]">
                ₹{Math.round(newRestockCost * (1 + (newRestockMargin || 25) / 100))} (+{newRestockMargin || 25}% margin)
              </span>
            </div>
          )}
        </form>
      </div>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2">
        {savedSuccess ? (
          <span className="text-xs font-semibold text-[var(--stage-green)] flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile & Routine Staples Saved Successfully!</span>
          </span>
        ) : (
          <span className="text-[11px] font-mono text-[var(--text-faint)]">
            Click save to persist changes across all marketplace adapters
          </span>
        )}

        <button
          onClick={handleSave}
          className="btn-primary py-2.5 px-6 text-xs font-semibold shadow-xs inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save Profile & Governance Settings</span>
        </button>
      </div>
    </div>
  );
};
