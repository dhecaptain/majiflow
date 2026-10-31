"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { CustomerAccountProfile, SavedAddress } from "@/lib/account";
import { accountApi } from "@/lib/account-client";
import type { DeliveryAddress } from "@/lib/types";
import { markLoaded } from "@/lib/load-progress";

export interface CustomerProfile {
  name: string;
  phone: string;
  email?: string;
  addresses: DeliveryAddress[];
  defaultAddressIndex: number;
}

export interface ProfileDetails {
  name: string;
  phone: string;
  email?: string;
  address?: DeliveryAddress;
}

export function profileForSession(
  stored: CustomerProfile,
  sessionUser: { name: string; email: string | null; phone?: string | null; role: "customer" | "business_owner" } | null
): CustomerProfile {
  if (!sessionUser || sessionUser.role !== "customer") return EMPTY;
  // The email is the sign-in identity for most accounts; a phone-first account
  // has no email, so its number stands in.
  const identity = (sessionUser.email ?? sessionUser.phone ?? "").trim().toLowerCase();
  const storedIdentity = (stored.email || stored.phone).trim().toLowerCase();
  const email = sessionUser.email ?? "";
  if (identity && storedIdentity !== identity) {
    return { ...EMPTY, name: sessionUser.name, email };
  }
  return { ...stored, name: sessionUser.name, email };
}

/** The server account is the source of truth; localStorage is only a cache of it. */
export function profileFromAccount(account: CustomerAccountProfile, addresses: SavedAddress[]): CustomerProfile {
  const defaultIndex = addresses.findIndex((a) => a.isDefault);
  return {
    name: account.name,
    phone: account.phone,
    email: account.email,
    addresses: addresses.map((saved) => {
      const address: DeliveryAddress & { isDefault?: boolean } = { ...saved };
      delete address.isDefault;
      return address;
    }),
    defaultAddressIndex: defaultIndex >= 0 ? defaultIndex : 0,
  };
}

interface CustomerContextValue {
  profile: CustomerProfile;
  /** True once the persisted profile has been read from localStorage. */
  hydrated: boolean;
  /** True once the user has signed in (MajiFlow uses a lightweight session flag). */
  loggedIn: boolean;
  /** True once a signed-in customer's profile has been loaded from the server. */
  accountSynced: boolean;
  saveCustomer: (p: Partial<CustomerProfile>) => void;
  /** Persist reusable checkout details; upserts (never duplicates) the address. */
  saveProfileDetails: (details: ProfileDetails) => void;
  /** Replace the cached profile with fresh server data after an account change. */
  applyAccount: (account: CustomerAccountProfile, addresses: SavedAddress[]) => void;
  /** Re-read the signed-in customer's profile and addresses from the server. */
  refreshAccount: () => Promise<void>;
  login: (seed?: Partial<CustomerProfile>) => void;
  logout: () => void;
  /** Drop everything cached on this device (after the server account is deleted). */
  forgetLocalAccount: () => void;
}

const CustomerContext = createContext<CustomerContextValue | null>(null);

const STORAGE_KEY = "mf:customer";
const AUTH_KEY = "mf:auth";
const CONSENT_KEY = "mf:profileConsent";
const CART_KEY = "mf:cart";
const EMPTY: CustomerProfile = { name: "", phone: "", addresses: [], defaultAddressIndex: 0 };

function addressKey(a: DeliveryAddress): string {
  return [a.estate.trim(), a.building?.trim() ?? "", a.floor?.trim() ?? ""]
    .join("|")
    .toLowerCase();
}

function normalizeAddress(a: DeliveryAddress, fallbackPhone: string): DeliveryAddress {
  return {
    label: a.label?.trim() || "Home",
    estate: a.estate.trim(),
    street: a.street?.trim() || undefined,
    building: a.building?.trim() || undefined,
    floor: a.floor?.trim() || undefined,
    city: a.city?.trim() || undefined,
    landmark: a.landmark?.trim() || undefined,
    notes: a.notes?.trim() || undefined,
    phone: a.phone?.trim() || fallbackPhone,
    lat: typeof a.lat === "number" && Number.isFinite(a.lat) ? a.lat : undefined,
    lng: typeof a.lng === "number" && Number.isFinite(a.lng) ? a.lng : undefined,
    accuracy:
      typeof a.accuracy === "number" && Number.isFinite(a.accuracy) ? a.accuracy : undefined,
    locationAt: a.locationAt?.trim() || undefined,
  };
}

function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocal(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* noop */
  }
}

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<CustomerProfile>(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountSynced, setAccountSynced] = useState(false);

  const applyAccount = useCallback((account: CustomerAccountProfile, addresses: SavedAddress[]) => {
    setProfile(profileFromAccount(account, addresses));
    setAccountSynced(true);
  }, []);

  const refreshAccount = useCallback(async () => {
    const result = await accountApi.profile();
    if (result.ok) applyAccount(result.data.profile, result.data.addresses);
  }, [applyAccount]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- hydrate the profile from localStorage after mount */
    let next = EMPTY;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) next = { ...EMPTY, ...(JSON.parse(raw) as Partial<CustomerProfile>) };
    } catch {
      /* noop */
    }
    setProfile(next);
    setLoggedIn((typeof window !== "undefined" && readLocal(AUTH_KEY) === "1") || Boolean(next.name));
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then(
        (body: {
          user?: {
            name: string;
            email: string | null;
            phone?: string | null;
            role: "customer" | "business_owner";
          } | null;
        }) => {
          if (!active) return;
          setProfile((current) => profileForSession(current, body.user ?? null));
          setLoggedIn(body.user?.role === "customer");
          if (body.user?.role === "customer") return refreshAccount();
        }
      )
      .catch(() => {
        // Public browsing and guest checkout remain available if session lookup is unavailable.
      })
      .finally(() => {
        // The first data fetch settled, so the splash can move on.
        markLoaded("data");
      });
    return () => {
      active = false;
    };
  }, [hydrated, refreshAccount]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    writeLocal(STORAGE_KEY, JSON.stringify(profile));
  }, [profile, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    writeLocal(AUTH_KEY, loggedIn ? "1" : "0");
  }, [loggedIn, hydrated]);

  const saveCustomer = useCallback((p: Partial<CustomerProfile>) => {
    setProfile((prev) => ({ ...prev, ...p }));
  }, []);

  const saveProfileDetails = useCallback((details: ProfileDetails) => {
    const name = details.name.trim();
    const phone = details.phone.trim();
    setProfile((prev) => {
      let addresses = prev.addresses;
      let defaultIndex = prev.defaultAddressIndex;
      if (details.address) {
        const next = normalizeAddress(details.address, phone);
        if (addresses.length === 0) {
          addresses = [next];
          defaultIndex = 0;
        } else {
          const existingIdx = addresses.findIndex((a) => addressKey(a) === addressKey(next));
          if (existingIdx >= 0) {
            addresses = addresses.map((a, i) => (i === existingIdx ? { ...a, ...next } : a));
          } else {
            addresses = [next, ...addresses];
          }
        }
      }
      return {
        ...prev,
        name: name || prev.name,
        phone: phone || prev.phone,
        email: details.email?.trim() || prev.email,
        defaultAddressIndex: defaultIndex,
        addresses,
      };
    });
    if (!loggedIn) return;
    void (async () => {
      if (name && phone) await accountApi.updateProfile({ name, phone });
      if (details.address) await accountApi.saveAddress({ ...normalizeAddress(details.address, phone) });
      await refreshAccount();
    })();
  }, [loggedIn, refreshAccount]);

  const login = useCallback((seed?: Partial<CustomerProfile>) => {
    if (seed) setProfile((prev) => ({ ...prev, ...seed, phone: seed.phone?.trim() || prev.phone }));
    setLoggedIn(true);
    void (async () => {
      // Registration collects a first address; persist it before the server copy replaces the cache.
      for (const address of seed?.addresses ?? []) {
        if (address.estate?.trim()) await accountApi.saveAddress(address);
      }
      await refreshAccount();
    })();
  }, [refreshAccount]);

  const logout = useCallback(() => {
    setLoggedIn(false);
    setAccountSynced(false);
  }, []);

  const forgetLocalAccount = useCallback(() => {
    setProfile(EMPTY);
    setLoggedIn(false);
    setAccountSynced(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(AUTH_KEY);
      window.localStorage.removeItem(CONSENT_KEY);
      window.localStorage.removeItem(CART_KEY);
    } catch {
      /* noop */
    }
  }, []);

  return (
    <CustomerContext.Provider
      value={{
        profile,
        hydrated,
        loggedIn,
        accountSynced,
        saveCustomer,
        saveProfileDetails,
        applyAccount,
        refreshAccount,
        login,
        logout,
        forgetLocalAccount,
      }}
    >
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer(): CustomerContextValue {
  const ctx = useContext(CustomerContext);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}