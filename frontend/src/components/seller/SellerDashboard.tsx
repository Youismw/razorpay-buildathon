"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useCardGlow } from "@/hooks/useCardGlow";
import {
  SellerProfile,
  SettlementPreferences,
  AIStrategyRecommendation,
  loadSellerProfile,
  saveSellerProfile,
  DEFAULT_SELLER_PROFILE,
} from "@/lib/sellerStore";
import { BACKEND_URL } from "@/lib/api";
import { SellerNavbar, SellerTab } from "./SellerNavbar";
import { SellerChatAssistant } from "./SellerChatAssistant";
import { SellerCatalogView } from "./SellerCatalogView";
import { SellerOrdersLogisticsView } from "./SellerOrdersLogisticsView";
import { SellerAnalyticsView } from "./SellerAnalyticsView";
import { SellerSettlementView } from "./SellerSettlementView";
import { SellerProfileView } from "./SellerProfileView";
import { ZoomContainer } from "../shared/ZoomContainer";

interface SellerDashboardProps {
  onBack: () => void;
}

export const SellerDashboard: React.FC<SellerDashboardProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<SellerTab>("chat");
  const [sellerMode, setSellerMode] = useState<"basic" | "advanced">("basic");
  const [profile, setProfile] = useState<SellerProfile>(DEFAULT_SELLER_PROFILE);
  const containerRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  useEffect(() => {
    const loaded = loadSellerProfile();
    setProfile(loaded);
    // Also fetch from backend if available
    fetch(`${BACKEND_URL}/api/seller/profile`)
      .then((res) => res.json())
      .then((backendProfile) => {
        if (backendProfile?.merchant_id) {
          const merged: SellerProfile = {
            merchantId: backendProfile.merchant_id,
            storeName: backendProfile.store_name,
            businessType: backendProfile.business_type,
            autonomyMode: backendProfile.autonomy_mode,
            defaultMarginPct: backendProfile.default_margin_pct,
            autoClearanceEnabled: backendProfile.auto_clearance_enabled,
            clearanceDiscount14dPct: backendProfile.clearance_discount_14d_pct,
            clearanceDiscount30dPct: backendProfile.clearance_discount_30d_pct,
            marketplaces: backendProfile.marketplaces.map((m: any) => ({
              marketplace: m.marketplace,
              enabled: m.enabled,
              accountId: m.account_id,
              status: m.status,
              feePercentage: m.fee_percentage,
            })),
            settlement: {
              payoutSchedule: backendProfile.settlement.payout_schedule,
              refundPolicy: backendProfile.settlement.refund_policy,
              disputeResolution: backendProfile.settlement.dispute_resolution,
              businessType: backendProfile.settlement.business_type,
              bankAccountLast4: backendProfile.settlement.bank_account_last4,
              autoSweepEnabled: backendProfile.settlement.auto_sweep_enabled,
            },
            routineRestockItems: backendProfile.routine_restock_items.map((r: any) => ({
              id: r.id,
              productName: r.product_name,
              category: r.category,
              supplierCostInr: r.supplier_cost_inr,
              currentStock: r.current_stock,
              restockThreshold: r.restock_threshold,
              restockQuantity: r.restock_quantity,
              restockIntervalDays: r.restock_interval_days,
              preferredMarginPct: r.preferred_margin_pct,
            })),
          };
          setProfile(merged);
          saveSellerProfile(merged);
        }
      })
      .catch(() => {});
  }, []);

  const handleUpdateProfile = (newProfile: SellerProfile) => {
    setProfile(newProfile);
    saveSellerProfile(newProfile);
    fetch(`${BACKEND_URL}/api/seller/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_id: newProfile.merchantId,
        store_name: newProfile.storeName,
        business_type: newProfile.businessType,
        autonomy_mode: newProfile.autonomyMode,
        default_margin_pct: newProfile.defaultMarginPct,
        auto_clearance_enabled: newProfile.autoClearanceEnabled,
        clearance_discount_14d_pct: newProfile.clearanceDiscount14dPct,
        clearance_discount_30d_pct: newProfile.clearanceDiscount30dPct,
        marketplaces: newProfile.marketplaces.map((m) => ({
          marketplace: m.marketplace,
          enabled: m.enabled,
          account_id: m.accountId,
          status: m.status,
          fee_percentage: m.feePercentage,
        })),
        settlement: {
          payout_schedule: newProfile.settlement.payoutSchedule,
          refund_policy: newProfile.settlement.refundPolicy,
          dispute_resolution: newProfile.settlement.disputeResolution,
          business_type: newProfile.settlement.businessType,
          bank_account_last4: newProfile.settlement.bankAccountLast4,
          auto_sweep_enabled: newProfile.settlement.autoSweepEnabled,
        },
        routine_restock_items: newProfile.routineRestockItems.map((r) => ({
          id: r.id,
          product_name: r.productName,
          category: r.category,
          supplier_cost_inr: r.supplierCostInr,
          current_stock: r.currentStock,
          restock_threshold: r.restockThreshold,
          restock_quantity: r.restockQuantity,
          restock_interval_days: r.restockIntervalDays,
          preferred_margin_pct: r.preferredMarginPct,
        })),
      }),
    }).catch(() => {});
  };

  const handleUpdateSettlement = (settlement: SettlementPreferences) => {
    const updated = { ...profile, settlement };
    handleUpdateProfile(updated);
  };

  const handleApplyStrategyRecommendation = (rec: AIStrategyRecommendation) => {
    // Switch to chat tab and send recommendation action
    setActiveTab("chat");
  };

  return (
    <div ref={containerRef} className="min-h-screen relative flex flex-col bg-[var(--bg-main)]">
      {/* Background artwork */}
      <div className="fixed inset-0 opacity-[0.10] mix-blend-multiply pointer-events-none z-0">
        <Image src="/seller-bg.jpg" alt="" fill sizes="100vw" className="object-cover" />
      </div>

      {/* Seller Header Navbar */}
      <SellerNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onBackToBuyer={onBack}
        sellerMode={sellerMode}
        onToggleSellerMode={setSellerMode}
        profile={profile}
      />

      {/* Main Tab Views */}
      <main className="flex-1 relative z-10 flex flex-col min-h-0">
        <ZoomContainer>
          {activeTab === "chat" && (
            <SellerChatAssistant
              profile={profile}
              sellerMode={sellerMode}
              onNavigateToCatalog={() => setActiveTab("catalog")}
            />
          )}

          {activeTab === "catalog" && (
            <SellerCatalogView
              profile={profile}
              sellerMode={sellerMode}
              onTriggerScan={() => setActiveTab("chat")}
            />
          )}

          {activeTab === "orders" && <SellerOrdersLogisticsView />}

          {activeTab === "analytics" && (
            <SellerAnalyticsView
              profile={profile}
              onNavigateToOrders={() => setActiveTab("orders")}
            />
          )}

          {activeTab === "settlement" && (
            <SellerSettlementView
              profile={profile}
              onUpdatePreferences={handleUpdateSettlement}
            />
          )}

          {activeTab === "profile" && (
            <SellerProfileView
              profile={profile}
              onSaveProfile={handleUpdateProfile}
            />
          )}
        </ZoomContainer>
      </main>
    </div>
  );
};
