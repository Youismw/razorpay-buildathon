"use client";

import { BACKEND_URL } from "./api";

export interface GroceryStapleItem {
  id: string;
  name: string;
  preferredBrand: string;
  category: string;
}

export interface UserProfileState {
  userName: string;
  maxTransactionLimitInr: number;
  monthlyLimitInr: number;
  autonomyMode: "autonomous" | "pin_required";
  userPin: string;
  dietaryPreference: string;
  favoriteBrands: string[];
  usualGroceryList: GroceryStapleItem[];
  allowPurchaseTracking: boolean;
  showRatesInChat: boolean;
  alwaysConfirmQuantity: boolean;
  hasConfiguredPin?: boolean;
}

export const DEFAULT_USER_PROFILE: UserProfileState = {
  userName: "Rohit Chauhan",
  maxTransactionLimitInr: 5000,
  monthlyLimitInr: 25000,
  autonomyMode: "autonomous",
  userPin: "1234",
  hasConfiguredPin: false,
  dietaryPreference: "Vegetarian / Organic First",
  favoriteBrands: ["Amul", "Blue Tokai", "Aashirvaad", "Sony", "Britannia"],
  usualGroceryList: [
    { id: "1", name: "Pasteurized Milk (1L)", preferredBrand: "Nandini Special Pasteurized Milk", category: "groceries" },
    { id: "2", name: "100% Whole Wheat Bread (400g)", preferredBrand: "Britannia 100% Whole Wheat Bread", category: "groceries" },
    { id: "3", name: "Instant Coffee (100g)", preferredBrand: "Nescafé Classic Instant Coffee", category: "groceries" },
    { id: "4", name: "Shudh Chakki Atta (5kg)", preferredBrand: "Aashirvaad Superior MP Shudh Chakki Atta", category: "groceries" },
    { id: "5", name: "Salted Table Butter (500g)", preferredBrand: "Amul Pasteurized Salted Table Butter", category: "groceries" },
    { id: "6", name: "Farm Fresh Eggs (Pack of 6)", preferredBrand: "Farm Fresh White Eggs", category: "groceries" },
  ],
  allowPurchaseTracking: true,
  showRatesInChat: true,
  alwaysConfirmQuantity: true,
};

const STORAGE_KEY = "ap2_buyer_profile_v1";

export function loadUserProfile(): UserProfileState {
  if (typeof window === "undefined") return DEFAULT_USER_PROFILE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_USER_PROFILE;
    return { ...DEFAULT_USER_PROFILE, ...JSON.parse(saved) };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfileState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    fetch(`${BACKEND_URL}/api/buyer/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userName: profile.userName,
        maxTransactionLimitInr: profile.maxTransactionLimitInr,
        monthlyLimitInr: profile.monthlyLimitInr,
        autonomyMode: profile.autonomyMode,
        userPin: profile.userPin,
        dietaryPreference: profile.dietaryPreference,
        favoriteBrands: profile.favoriteBrands,
        usualGroceryList: profile.usualGroceryList,
        allowPurchaseTracking: profile.allowPurchaseTracking,
      }),
    }).catch(() => {});
  } catch (err) {
    console.error("Failed to save user profile", err);
  }
}
