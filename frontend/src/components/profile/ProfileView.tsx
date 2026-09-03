"use client";

import React, { useState, useRef } from "react";
import {
  Shield,
  KeyRound,
  Sliders,
  Sparkles,
  ShoppingBag,
  Plus,
  Trash2,
  CheckCircle2,
  Save,
  Lock,
  Unlock,
  AlertCircle,
} from "lucide-react";
import { UserProfileState, GroceryStapleItem, saveUserProfile } from "@/lib/profileStore";
import { useCardGlow } from "@/hooks/useCardGlow";

interface ProfileViewProps {
  profile: UserProfileState;
  onUpdateProfile: (updated: UserProfileState) => void;
  onShowToast: (title: string, message: string, type: "success" | "info" | "warning" | "error") => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  profile,
  onUpdateProfile,
  onShowToast,
}) => {
  const [formData, setFormData] = useState<UserProfileState>(profile);
  const [newBrand, setNewBrand] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemBrand, setNewItemBrand] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  const handleSave = () => {
    saveUserProfile(formData);
    onUpdateProfile(formData);
    onShowToast("Profile Updated", "Governance limits, security PIN, and grocery preferences saved.", "success");
  };

  const handleAddBrand = () => {
    if (!newBrand.trim()) return;
    if (formData.favoriteBrands.includes(newBrand.trim())) return;
    setFormData((prev) => ({
      ...prev,
      favoriteBrands: [...prev.favoriteBrands, newBrand.trim()],
    }));
    setNewBrand("");
  };

  const handleRemoveBrand = (brand: string) => {
    setFormData((prev) => ({
      ...prev,
      favoriteBrands: prev.favoriteBrands.filter((b) => b !== brand),
    }));
  };

  const handleAddGroceryItem = () => {
    if (!newItemName.trim() || !newItemBrand.trim()) return;
    const newItem: GroceryStapleItem = {
      id: Date.now().toString(),
      name: newItemName.trim(),
      preferredBrand: newItemBrand.trim(),
      category: "groceries",
    };
    setFormData((prev) => ({
      ...prev,
      usualGroceryList: [...prev.usualGroceryList, newItem],
    }));
    setNewItemName("");
    setNewItemBrand("");
  };

  const handleRemoveGroceryItem = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      usualGroceryList: prev.usualGroceryList.filter((item) => item.id !== id),
    }));
  };

  return (
    <div ref={containerRef} className="flex-1 w-full min-h-0 overflow-y-auto overflow-x-hidden touch-pan-y">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 pb-32">
        {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="display-heading text-2xl sm:text-3xl mb-1">
            Personalization & Autonomous Mandate Governance
          </h2>
          <p className="text-sm text-[var(--text-muted)]">
            Configure transaction limits, AI PIN permissions, buying patterns, and staple grocery lists.
          </p>
        </div>

        <button
          onClick={handleSave}
          className="btn-primary py-2.5 px-5 text-sm self-start sm:self-auto shrink-0 shadow-md"
        >
          <Save className="w-4 h-4" />
          <span>Save Changes</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ═══ Card 1: Autonomous Spending & Limits ═══ */}
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--brown-faint)] flex items-center justify-center text-[var(--brown)]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Autonomous Spending Limits
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Cryptographically enforced policy ceilings (INV-010)
              </p>
            </div>
          </div>

          {/* Max Single Transaction Limit */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="font-medium text-[var(--text-secondary)]">
                Max Single Transaction Limit
              </span>
              <span className="font-mono font-bold text-[var(--brown-dark)] text-base">
                ₹{formData.maxTransactionLimitInr.toLocaleString("en-IN")}
              </span>
            </div>
            <input
              type="range"
              min={500}
              max={50000}
              step={500}
              value={formData.maxTransactionLimitInr}
              onChange={(e) => setFormData({ ...formData, maxTransactionLimitInr: Number(e.target.value) })}
              className="w-full accent-[var(--brown)] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] font-mono text-[var(--text-faint)]">
              <span>₹500 (Strict Micro-debts)</span>
              <span>₹25,000</span>
              <span>₹50,000 (Max Limit)</span>
            </div>
          </div>

          {/* Monthly Budget Ceiling */}
          <div className="space-y-1.5 pt-2 border-t border-[rgba(92,61,46,0.06)]">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Monthly Cumulative Spend Ceiling
            </label>
            <div className="flex items-center gap-2 input py-2 px-3 text-sm">
              <span className="text-[var(--text-faint)]">₹</span>
              <input
                type="number"
                value={formData.monthlyLimitInr}
                onChange={(e) => setFormData({ ...formData, monthlyLimitInr: Number(e.target.value) })}
                className="w-full bg-transparent focus:outline-none font-mono font-medium text-[var(--text-primary)]"
                min={1000}
              />
            </div>
          </div>
        </div>

        {/* ═══ Card 2: AI PIN & Security Permissions ═══ */}
        <div className="card p-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--brown-faint)] flex items-center justify-center text-[var(--brown)]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Mandate Execution & PIN Permissions
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Control whether AI executes automatically or asks for confirmation
              </p>
            </div>
          </div>

          {/* Autonomy Mode Switcher */}
          <div className="space-y-3">
            <label className="text-xs font-medium text-[var(--text-secondary)] block">
              Execution Autonomy Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, autonomyMode: "autonomous" })}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  formData.autonomyMode === "autonomous"
                    ? "border-[var(--brown)] bg-[var(--brown-faint)]/40 shadow-sm"
                    : "border-[rgba(92,61,46,0.12)] hover:border-[var(--gold)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Unlock className="w-4 h-4 text-[var(--stage-green)]" />
                  {formData.autonomyMode === "autonomous" && (
                    <CheckCircle2 className="w-4 h-4 text-[var(--brown)]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    Fully Autonomous
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                    Zero-click settlement within budget
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, autonomyMode: "pin_required" })}
                className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                  formData.autonomyMode === "pin_required"
                    ? "border-[var(--brown)] bg-[var(--brown-faint)]/40 shadow-sm"
                    : "border-[rgba(92,61,46,0.12)] hover:border-[var(--gold)]"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Lock className="w-4 h-4 text-[var(--gold)]" />
                  {formData.autonomyMode === "pin_required" && (
                    <CheckCircle2 className="w-4 h-4 text-[var(--brown)]" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-[var(--text-primary)]">
                    PIN Confirmation
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] leading-tight mt-0.5">
                    Requires manual UPI PIN entry
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* User UPI PIN Setup */}
          <div className="space-y-1.5 pt-2 border-t border-[rgba(92,61,46,0.06)]">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                Configured UPI PIN (4-Digits)
              </label>
              <span className="text-[10px] font-mono text-[var(--text-faint)]">
                Local Secure Enclave
              </span>
            </div>
            <input
              type="password"
              maxLength={4}
              value={formData.userPin}
              onChange={(e) => setFormData({ ...formData, userPin: e.target.value.replace(/\D/g, "") })}
              className="input py-2 px-3 text-sm font-mono tracking-widest w-36 text-center"
              placeholder="••••"
            />
          </div>
        </div>
      </div>

      {/* ═══ Card 3: Personal Buying Profile & AI Pattern Deduction ═══ */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[var(--brown-faint)] flex items-center justify-center text-[var(--brown)]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              Personal Buying Profile & Preferences
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Preferences referenced by the AI reasoning core during candidate evaluation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
              Account Holder Name
            </label>
            <input
              type="text"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className="input text-sm py-2 px-3 w-full"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[var(--text-secondary)] block mb-1">
              Dietary & Quality Focus
            </label>
            <input
              type="text"
              value={formData.dietaryPreference}
              onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
              className="input text-sm py-2 px-3 w-full"
              placeholder="e.g., Organic First, Vegan, Low-carb"
            />
          </div>
        </div>

        {/* Favorite Brands Tag Manager */}
        <div className="space-y-2 pt-2 border-t border-[rgba(92,61,46,0.06)]">
          <label className="text-xs font-medium text-[var(--text-secondary)] block">
            Preferred Brands (Prioritized by AI)
          </label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {formData.favoriteBrands.map((brand) => (
              <span
                key={brand}
                className="badge px-2.5 py-1 text-xs font-medium bg-[var(--brown-faint)] text-[var(--brown)] flex items-center gap-1.5"
              >
                <span>{brand}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveBrand(brand)}
                  className="hover:text-[var(--stage-red)]"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex gap-2 max-w-sm">
            <input
              type="text"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              placeholder="Add preferred brand..."
              className="input text-xs py-1.5 px-3 flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddBrand();
                }
              }}
            />
            <button
              type="button"
              onClick={handleAddBrand}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {/* Purchase Tracking & Learning Toggle */}
        <div className="pt-2 border-t border-[rgba(92,61,46,0.06)] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)] block">
              Autonomous Purchase Pattern Learning
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Allow AI to track past orders and automatically deduce brand preferences and restocking intervals
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, allowPurchaseTracking: !formData.allowPurchaseTracking })}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              formData.allowPurchaseTracking ? "bg-[var(--brown)]" : "bg-[var(--text-faint)]"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                formData.allowPurchaseTracking ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Display Rates & Pricing in Chat / Search */}
        <div className="pt-2 border-t border-[rgba(92,61,46,0.06)] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)] block">
              Show Product Rates & Unit Pricing
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Display per-unit rates (e.g. ₹72/L) in search and deliberation unless &ldquo;don&apos;t show rate&rdquo; is requested
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, showRatesInChat: !formData.showRatesInChat })}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              formData.showRatesInChat ? "bg-[var(--brown)]" : "bg-[var(--text-faint)]"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                formData.showRatesInChat ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Quantity Confirmation for Unspecified Items */}
        <div className="pt-2 border-t border-[rgba(92,61,46,0.06)] flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-[var(--text-primary)] block">
              Always Ask Quantity for Staples
            </span>
            <span className="text-[11px] text-[var(--text-muted)]">
              Prompt for amount/volume (e.g. 1L, 2L, 5L) when unspecified in commands like &ldquo;buy milk&rdquo;
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFormData({ ...formData, alwaysConfirmQuantity: !formData.alwaysConfirmQuantity })}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              formData.alwaysConfirmQuantity ? "bg-[var(--brown)]" : "bg-[var(--text-faint)]"
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                formData.alwaysConfirmQuantity ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* ═══ Card 4: Usual Grocery List (Staple Items) ═══ */}
      <div className="card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--brown-faint)] flex items-center justify-center text-[var(--brown)]">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Usual Grocery List (Staple Items)
              </h3>
              <p className="text-xs text-[var(--text-muted)]">
                Items automatically gathered when you say <i>"Order my usual grocery list"</i>
              </p>
            </div>
          </div>
        </div>

        {/* Grocery Item List */}
        <div className="space-y-2">
          {formData.usualGroceryList.map((item) => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-white/70 border border-[rgba(92,61,46,0.08)] flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <span className="text-xs font-semibold text-[var(--text-primary)] block">
                  {item.name}
                </span>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Preferred Brand: <span className="text-[var(--brown-dark)] font-medium">{item.preferredBrand}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleRemoveGroceryItem(item.id)}
                className="p-1.5 text-[var(--text-faint)] hover:text-[var(--stage-red)] transition-colors rounded-lg"
                title="Remove staple"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add New Grocery Staple */}
        <div className="p-3.5 rounded-xl border border-dashed border-[rgba(92,61,46,0.18)] bg-[var(--brown-faint)]/20 space-y-3">
          <span className="text-xs font-medium text-[var(--text-secondary)] block">
            Add New Staple Item
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name (e.g. Sourdough Loaf)"
              className="input text-xs py-2 px-3"
            />
            <input
              type="text"
              value={newItemBrand}
              onChange={(e) => setNewItemBrand(e.target.value)}
              placeholder="Preferred brand (e.g. The Baker's Dozen)"
              className="input text-xs py-2 px-3"
            />
          </div>
          <button
            type="button"
            onClick={handleAddGroceryItem}
            disabled={!newItemName.trim() || !newItemBrand.trim()}
            className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add to Staple List</span>
          </button>
        </div>
      </div>
    </div>
  </div>
);
};
