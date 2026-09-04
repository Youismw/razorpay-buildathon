"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { ShoppingBag, Store, ArrowRight, Shield } from "lucide-react";
import { useCardGlow } from "@/hooks/useCardGlow";

interface RoleSelectorProps {
  onSelectRole: (role: "buyer" | "seller") => void;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({ onSelectRole }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useCardGlow(containerRef);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
    >
      {/* Brand Header */}
      <div className="text-center mb-10 animate-fadeIn relative z-10">
        <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-[var(--gold-faint)] border border-[rgba(196,162,101,0.25)]">
          <Shield className="w-4 h-4 text-[var(--brown)]" />
          <span className="text-xs font-mono font-semibold text-[var(--brown)] tracking-wider uppercase">
            AP2 Protocol · Razorpay Buildathon
          </span>
        </div>

        <h1 className="display-heading text-4xl sm:text-5xl mb-3">
          Autonomous Purchase Protocol
        </h1>
        <p className="text-base text-[var(--text-secondary)] max-w-xl mx-auto leading-relaxed">
          AI-governed agentic commerce with zero unsupervised money movement.
          Choose your perspective below to explore the protocol.
        </p>
      </div>

      {/* Role Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full relative z-10">
        {/* ═══ Buyer Card ═══ */}
        <div
          onClick={() => onSelectRole("buyer")}
          className="card group text-left cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col overflow-hidden bg-white border border-[rgba(92,61,46,0.12)]"
        >
          {/* Prominent Artwork Banner */}
          <div className="relative h-56 w-full overflow-hidden bg-[var(--white-warm)]">
            <Image
              src="/buyer-bg.jpg"
              alt="Woman browsing in a modern retail store"
              fill
              sizes="(max-width: 768px) 100vw, 450px"
              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
              priority
            />
            {/* Subtle Gradient Transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/10" />

            {/* Floating Icon Pill */}
            <div className="absolute top-4 left-4 w-11 h-11 rounded-xl bg-[var(--brown)] flex items-center justify-center shadow-lg">
              <ShoppingBag className="w-5 h-5 text-[var(--gold-light)]" />
            </div>

            <div className="absolute bottom-3 left-4 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm text-[11px] font-mono font-bold text-[var(--brown)] shadow-sm">
              Buyer Portal
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <h2 className="display-heading text-2xl mb-2 group-hover:text-[var(--brown)] transition-colors">
                I&apos;m a Buyer
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                Explore catalogs, set deterministic spending bounds, and let the AI agent
                deliberate, verify, and execute purchases through Razorpay UPI Autopay.
              </p>
            </div>

            <div className="pt-4 border-t border-[rgba(92,61,46,0.08)] flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--text-muted)]">
                5-Stage Deterministic Sandwich
              </span>
              <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--brown)] group-hover:text-[var(--gold)] transition-colors">
                <span>Enter Dashboard</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ Seller Card ═══ */}
        <div
          onClick={() => onSelectRole("seller")}
          className="card group text-left cursor-pointer transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex flex-col overflow-hidden bg-white border border-[rgba(92,61,46,0.12)]"
        >
          {/* Prominent Artwork Banner */}
          <div className="relative h-56 w-full overflow-hidden bg-[var(--white-warm)]">
            <Image
              src="/seller-bg.jpg"
              alt="Shop owner in front of modern storefront"
              fill
              sizes="(max-width: 768px) 100vw, 450px"
              className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
              priority
            />
            {/* Subtle Gradient Transition */}
            <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-black/10" />

            {/* Floating Icon Pill */}
            <div className="absolute top-4 left-4 w-11 h-11 rounded-xl bg-[var(--gold)] flex items-center justify-center shadow-lg">
              <Store className="w-5 h-5 text-[var(--brown-dark)]" />
            </div>

            <div className="absolute bottom-3 left-4 px-2.5 py-1 rounded-md bg-white/90 backdrop-blur-sm text-[11px] font-mono font-bold text-[var(--brown)] shadow-sm">
              Merchant Portal
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="display-heading text-2xl group-hover:text-[var(--brown)] transition-colors">
                  I&apos;m a Merchant / Seller
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live &amp; Autonomous
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
                Grow revenue by making your store machine-readable to AI buyers. Monitor competitor prices
                across Amazon &amp; ONDC, automate dynamic margins, and settle orders via Razorpay UPI Autopay.
              </p>
            </div>

            <div className="pt-4 border-t border-[rgba(92,61,46,0.08)] flex items-center justify-between">
              <span className="text-xs font-mono text-[var(--text-muted)]">
                AI Growth &amp; Agentic Commerce Engine
              </span>
              <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--brown)] group-hover:text-[var(--gold)] transition-colors">
                <span>Enter Merchant Co-Pilot</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-12 text-center text-xs text-[var(--text-muted)] font-mono relative z-10 flex flex-wrap items-center justify-center gap-4">
        <span>Deterministic Sandwich v1.0</span>
        <span>•</span>
        <span>ES256 Mandate Vault</span>
        <span>•</span>
        <span>10 Security Invariants</span>
        <span>•</span>
        <span>Razorpay UPI Autopay</span>
      </div>
    </div>
  );
};
