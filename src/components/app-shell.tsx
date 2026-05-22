"use client";

import { useEffect, useState } from "react";

import { DEFAULT_MASTER_CREDENTIALS, DEFAULT_RATES, ITEM_LABELS, RECEIPT_KEYS, ROLE_LABELS } from "@/lib/constants";
import { buildReceiptLines } from "@/lib/receipt";

type SessionUser = {
  id: string;
  name: string;
  username: string;
  role: "MASTER_ADMIN" | "COUNTER_ADMIN";
};

type RateMap = Record<(typeof RECEIPT_KEYS)[number], number>;

type ReceiptRecord = {
  id: string;
  receiptNumber: string;
  heading: string | null;
  timestamp: string;
  admin: SessionUser;
  andarCode: string | null;
  andarRate: number | null;
  andarQty: number;
  andarAmount: number;
  baharCode: string | null;
  baharRate: number | null;
  baharQty: number;
  baharAmount: number;
  resultCode: string | null;
  resultRate: number | null;
  resultQty: number;
  resultAmount: number;
  totalAmount: number;
  entries?: Array<{ itemKey: (typeof RECEIPT_KEYS)[number]; code: string; qty: number; rate: number; amount: number }>;
};

type ReceiptEntryDraft = {
  id: string;
  itemKey: (typeof RECEIPT_KEYS)[number];
  code: string;
  qty: number;
};

type UserRecord = {
  id: string;
  name: string;
  username: string;
  role: string;
  createdAt: string;
};

const initialRates: RateMap = {
  andar: DEFAULT_RATES.andar,
  bahar: DEFAULT_RATES.bahar,
  result: DEFAULT_RATES.result,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function newEntry(itemKey: (typeof RECEIPT_KEYS)[number] = "andar"): ReceiptEntryDraft {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemKey,
    code: "",
    qty: 0,
  };
}

function sanitizeCodeInput(itemKey: (typeof RECEIPT_KEYS)[number], value: string) {
  const digits = value.replace(/\D/g, "");
  return itemKey === "result" ? digits.slice(0, 2) : digits.slice(0, 1);
}

const CATEGORY_TABS = [
  { key: "all", label: "All" },
  { key: "andar", label: "AN" },
  { key: "bahar", label: "BH" },
  { key: "result", label: "RT" },
] as const;

const POS_CODE_GRID: Record<(typeof RECEIPT_KEYS)[number], string[]> = {
  andar: Array.from({ length: 10 }, (_, index) => String(index)),
  bahar: Array.from({ length: 10 }, (_, index) => String(index)),
  result: Array.from({ length: 100 }, (_, index) => String(index).padStart(2, "0")),
};

export function AppShell() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [rates, setRates] = useState<RateMap>(initialRates);
  const [rateDraft, setRateDraft] = useState<RateMap>(initialRates);
  const [entries, setEntries] = useState<ReceiptEntryDraft[]>([newEntry("andar")]);
  const [heading, setHeading] = useState("Counter 01");
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [search, setSearch] = useState("");
  const [adminForm, setAdminForm] = useState({ name: "", password: "" });
  const [lastReceipt, setLastReceipt] = useState<ReceiptRecord | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<"dashboard" | "rates" | "admins" | "update-password" | "sales" | "settings">("dashboard");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", selectedUserId: "self" });
  const [nextReceiptNumber, setNextReceiptNumber] = useState<string>("PENDING");
  const [salesDate, setSalesDate] = useState(new Date().toISOString().split("T")[0]);
  const [salesData, setSalesData] = useState<Array<{ heading: string; total: number }>>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [isSalesLoading, setIsSalesLoading] = useState(false);
  const [codeSelectionOpen, setCodeSelectionOpen] = useState<"andar" | "bahar" | "result" | null>(null);
  const [codeQuantities, setCodeQuantities] = useState<Record<string, Record<string, number>>>({ andar: {}, bahar: {}, result: {} });
  const [activeMode, setActiveMode] = useState<"service" | "simple">("service");
  const [activeCategory, setActiveCategory] = useState<"all" | (typeof RECEIPT_KEYS)[number]>("all");
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const resp = await fetch(`/api/receipts/next?heading=${encodeURIComponent(heading)}`, { cache: "no-store" });
        if (resp.ok) {
          const data = await resp.json();
          if (active && data?.receiptNumber) {
            setNextReceiptNumber(String(data.receiptNumber));
          }
        }
      } catch (e) {
        if (active) setNextReceiptNumber("PENDING");
      }
    })();
    return () => { active = false; };
  }, [heading, lastReceipt]);

  useEffect(() => {
    let active = true;
    if (currentPage === "sales" && session?.role === "MASTER_ADMIN") {
      void (async () => {
        try {
          setIsSalesLoading(true);
          const resp = await fetch(`/api/sales?date=${salesDate}`, { cache: "no-store" });
          if (resp.ok) {
            const data = await resp.json();
            if (active) {
              setSalesData(data.salesData || []);
              setGrandTotal(data.grandTotal || 0);
            }
          }
        } catch (e) {
          console.error(e);
        } finally {
          if (active) setIsSalesLoading(false);
        }
      })();
    }
    return () => { active = false; };
  }, [currentPage, salesDate, session]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { user: SessionUser };
        setSession(data.user);

        const [ratesResponse, receiptsResponse, usersResponse] = await Promise.all([
          fetch("/api/rates", { cache: "no-store" }),
          fetch("/api/receipts", { cache: "no-store" }),
          fetch("/api/admin/users", { cache: "no-store" }),
        ]);

        if (ratesResponse.ok) {
          const ratesData = (await ratesResponse.json()) as { rates: Array<{ itemKey: keyof RateMap; rate: number }> };
          const nextRates = { ...initialRates };
          for (const entry of ratesData.rates) {
            nextRates[entry.itemKey] = entry.rate;
          }
          setRates(nextRates);
          setRateDraft(nextRates);
        }

        if (receiptsResponse.ok) {
          const receiptsData = (await receiptsResponse.json()) as { receipts: ReceiptRecord[] };
          setReceipts(receiptsData.receipts);
        }

        // Set fixed counter heading based on user role
        if (data.user.role === "COUNTER_ADMIN") {
          const counterNum = data.user.name.match(/\d+/)?.[0];
          setHeading(counterNum ? `Counter ${counterNum.padStart(2, "0")}` : "Counter 01");
        }

        if (usersResponse.ok) {
          const usersData = (await usersResponse.json()) as { users: UserRecord[] };
          setUsers(usersData.users);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function refreshRates() {
    const response = await fetch("/api/rates", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { rates: Array<{ itemKey: keyof RateMap; rate: number }> };
    const nextRates = { ...initialRates };
    for (const entry of data.rates) {
      nextRates[entry.itemKey] = entry.rate;
    }

    setRates(nextRates);
    setRateDraft(nextRates);
  }

  async function refreshReceipts(nextSearch = search) {
    const response = await fetch(`/api/receipts?search=${encodeURIComponent(nextSearch)}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { receipts: ReceiptRecord[] };
    setReceipts(data.receipts);
  }

  async function refreshUsers() {
    const response = await fetch("/api/admin/users", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { users: UserRecord[] };
    setUsers(data.users);
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loginForm),
    });

    const data = (await response.json().catch(() => ({}))) as { user?: SessionUser; error?: string };

    if (!response.ok || !data.user) {
      setMessage(data.error ?? "Login failed");
      return;
    }

    setSession(data.user);
    setMessage(`Welcome, ${data.user.name}`);
    
    // Set fixed counter heading for counter admins
    if (data.user.role === "COUNTER_ADMIN") {
      const counterNum = data.user.name.match(/\d+/)?.[0];
      setHeading(counterNum ? `Counter ${counterNum.padStart(2, "0")}` : "Counter 01");
    }
    
    await Promise.all([refreshRates(), refreshReceipts(), refreshUsers()]);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setEntries([newEntry("andar")]);
    setReceipts([]);
    setUsers([]);
    setMessage("Signed out");
  }

  function computeEntryAmount(entry: ReceiptEntryDraft) {
    if (!entry.code) {
      return 0;
    }

    return rates[entry.itemKey] * entry.qty;
  }

  function calculateTotal() {
    return entries.reduce((sum, entry) => sum + computeEntryAmount(entry), 0);
  }

  function getPreview() {
    return buildReceiptLines({
      receiptNumber: nextReceiptNumber,
      heading,
      timestamp: new Date(),
      entries: entries
        .map((entry) => {
          if (!entry.code || !entry.qty) {
            return null;
          }

          const rate = rates[entry.itemKey];
          return {
            itemKey: entry.itemKey,
            code: entry.code,
            qty: entry.qty,
            rate,
            amount: rate * entry.qty,
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
    });
  }

  async function submitReceipt() {
    setMessage(null);

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heading,
        entries: entries.map((entry) => ({ itemKey: entry.itemKey, code: entry.code, qty: entry.qty })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { receipt?: ReceiptRecord; error?: string };
    if (!response.ok || !data.receipt) {
      setMessage(data.error ?? "Unable to create receipt");
      return;
    }

    setLastReceipt(data.receipt);
    setEntries([newEntry("andar")]);
    setMessage(`Receipt ${data.receipt.receiptNumber} created`);
    await refreshReceipts();
  }

  async function saveAndPrint() {
    setMessage(null);

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heading,
        entries: entries.map((entry) => ({ itemKey: entry.itemKey, code: entry.code, qty: entry.qty })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { receipt?: ReceiptRecord; error?: string };
    if (!response.ok || !data.receipt) {
      setMessage(data.error ?? "Unable to create receipt");
      return;
    }

    setLastReceipt(data.receipt);
    setEntries([newEntry("andar")]);
    setMessage(`Receipt ${data.receipt.receiptNumber} created`);
    await refreshReceipts();
    
    downloadReceiptImage(data.receipt);
  }

  function updateEntry(entryId: string, patch: Partial<ReceiptEntryDraft>) {
    setEntries((current) =>
      current.map((entry) => {
        if (entry.id !== entryId) {
          return entry;
        }

        const next = { ...entry, ...patch };
        return {
          ...next,
          code: sanitizeCodeInput(next.itemKey, next.code),
          qty: Math.max(0, next.qty || 0),
        };
      }),
    );
  }

  function removeEntryRow(entryId: string) {
    setEntries((current) => {
      if (current.length === 1) {
        return current;
      }

      return current.filter((entry) => entry.id !== entryId);
    });
  }

  function addEntryRow() {
    setEntries((current) => [...current, newEntry("andar")]);
  }

  function adjustCodeQty(category: string, code: string, delta: number) {
    setCodeQuantities((prev) => {
      const catMap = { ...prev[category] };
      const newVal = Math.max(0, (catMap[code] || 0) + delta);
      if (newVal === 0) {
        delete catMap[code];
      } else {
        catMap[code] = newVal;
      }
      return { ...prev, [category]: catMap };
    });
  }

  function setCodeQty(category: string, code: string, value: number) {
    setCodeQuantities((prev) => {
      const catMap = { ...prev[category] };
      const newVal = Math.max(0, value);
      if (newVal === 0) {
        delete catMap[code];
      } else {
        catMap[code] = newVal;
      }
      return { ...prev, [category]: catMap };
    });
  }

  function codeQuantitiesToEntries(): ReceiptEntryDraft[] {
    const result: ReceiptEntryDraft[] = [];
    for (const category of RECEIPT_KEYS) {
      const catMap = codeQuantities[category] || {};
      for (const [code, qty] of Object.entries(catMap)) {
        if (qty > 0) {
          result.push({
            id: `${category}-${code}`,
            itemKey: category,
            code,
            qty,
          });
        }
      }
    }
    return result;
  }

  function calculateTotalFromQuantities() {
    let total = 0;
    for (const category of RECEIPT_KEYS) {
      const catMap = codeQuantities[category] || {};
      for (const qty of Object.values(catMap)) {
        total += rates[category] * qty;
      }
    }
    return total;
  }

  function getSelectedCount() {
    let total = 0;
    for (const category of RECEIPT_KEYS) {
      const catMap = codeQuantities[category] || {};
      for (const qty of Object.values(catMap)) {
        total += qty;
      }
    }
    return total;
  }

  function getVisibleCatalogCategories() {
    if (activeCategory === "all") {
      return RECEIPT_KEYS;
    }

    return [activeCategory];
  }

  function getSelectedQuantity(category: (typeof RECEIPT_KEYS)[number], code: string) {
    return codeQuantities[category]?.[code] || 0;
  }

  function incrementCodeQuantity(category: (typeof RECEIPT_KEYS)[number], code: string) {
    adjustCodeQty(category, code, 1);
    setCartOpen(true);
  }

  function renderMobileDashboard() {
    const currentSession = session;
    if (!currentSession) {
      return null;
    }

    const selectedItems = getSelectedItemsSummary();
    const selectedCount = getSelectedCount();
    const visibleCategories = getVisibleCatalogCategories();

    return (
      <div className="space-y-4 pb-28">
        <section className="rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm uppercase tracking-[0.35em] text-slate-500">P...</div>
              <h2 className="mt-1 text-2xl font-semibold text-white">{ROLE_LABELS[currentSession.role]} console</h2>
              <p className="text-sm text-slate-400">Mobile POS mode for billing and counter entry.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMenuOpen((current) => !current)}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
                aria-label="Open menu"
              >
                ☰
              </button>
              <button
                type="button"
                onClick={() => setCurrentPage("sales")}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white"
                aria-label="Reports"
              >
                ▦
              </button>
            </div>
          </div>

          {menuOpen && currentSession.role === "MASTER_ADMIN" && (
            <div className="mt-4 grid gap-2 rounded-3xl border border-white/10 bg-slate-950/95 p-2 text-sm text-white">
              <button onClick={() => { setCurrentPage("rates"); setMenuOpen(false); }} className="rounded-2xl px-4 py-3 text-left hover:bg-white/5">Change Rates</button>
              <button onClick={() => { setCurrentPage("sales"); setMenuOpen(false); }} className="rounded-2xl px-4 py-3 text-left hover:bg-white/5">Reports</button>
              <button onClick={() => { setCurrentPage("admins"); setMenuOpen(false); }} className="rounded-2xl px-4 py-3 text-left hover:bg-white/5">Counter Admins</button>
              <button onClick={() => { setCurrentPage("update-password"); setMenuOpen(false); }} className="rounded-2xl px-4 py-3 text-left hover:bg-white/5">Update Password</button>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 rounded-[1.75rem] border border-white/10 bg-white/5 p-1 text-sm font-semibold">
            <button
              type="button"
              onClick={() => setActiveMode("simple")}
              className={`rounded-[1.5rem] px-4 py-3 transition ${activeMode === "simple" ? "bg-white text-slate-950" : "text-slate-300"}`}
            >
              Simple
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("service")}
              className={`rounded-[1.5rem] px-4 py-3 transition ${activeMode === "service" ? "bg-emerald-400 text-slate-950" : "text-slate-300"}`}
            >
              Service
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveCategory(tab.key)}
                className={`rounded-full border px-4 py-3 text-sm font-semibold transition ${activeCategory === tab.key ? "border-emerald-400 bg-emerald-400 text-slate-950" : "border-slate-500/60 bg-white/5 text-slate-300"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {activeMode === "simple" ? (
          <section className="rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-white">Create receipt</h3>
                <p className="text-sm text-slate-400">Manual entry view for quick edits.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-right text-sm text-slate-300">
                Total
                <div className="text-xl font-semibold text-emerald-300">{formatCurrency(calculateTotal())}</div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Heading</span>
                {currentSession.role === "MASTER_ADMIN" ? (
                  <select value={heading} onChange={(event) => setHeading(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none">
                    {Array.from({ length: 15 }).map((_, index) => {
                      const counter = String(index + 1).padStart(2, "0");
                      return <option key={counter} value={`Counter ${counter}`}>Counter {counter}</option>;
                    })}
                  </select>
                ) : (
                  <input value={heading} disabled className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white opacity-70" />
                )}
              </label>

              {entries.map((entry, index) => (
                <div key={entry.id} className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-white/5 p-3">
                  <div className="grid grid-cols-[1fr_auto] gap-3">
                    <select value={entry.itemKey} onChange={(event) => updateEntry(entry.id, { itemKey: event.target.value as (typeof RECEIPT_KEYS)[number] })} className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none">
                      <option value="andar">Andar</option>
                      <option value="bahar">Bahar</option>
                      <option value="result">Result</option>
                    </select>
                    <button type="button" onClick={() => removeEntryRow(entry.id)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                    <input value={entry.code} onChange={(event) => updateEntry(entry.id, { code: event.target.value })} className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" placeholder="Code" />
                    <input type="number" min={0} value={entry.qty || ""} onChange={(event) => updateEntry(entry.id, { qty: Number(event.target.value) || 0 })} className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" placeholder="Qty" />
                    <div className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-right text-slate-300 md:col-span-1">{formatCurrency(computeEntryAmount(entry))}</div>
                  </div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Line {index + 1}</div>
                </div>
              ))}

              <div className="flex gap-3">
                <button type="button" onClick={addEntryRow} className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white">Add line</button>
                <button type="button" onClick={saveAndPrint} className="flex-1 rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-emerald-950">Save &amp; Print</button>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-4">
              {visibleCategories.map((category) => (
                <div key={category} className="rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{ITEM_LABELS[category]}</h3>
                      <p className="text-sm text-slate-400">Tap a card to add it to the cart.</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">Rate <span className="font-semibold text-emerald-300">{formatCurrency(rates[category])}</span></div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {POS_CODE_GRID[category].map((code) => {
                      const qty = getSelectedQuantity(category, code);
                      const isSelected = qty > 0;
                      return (
                        <button
                          key={`${category}-${code}`}
                          type="button"
                          onClick={() => incrementCodeQuantity(category, code)}
                          className={`relative aspect-[0.92] rounded-[1.35rem] border p-3 text-left transition active:scale-[0.98] ${isSelected ? "border-emerald-400 bg-emerald-400/10 shadow-lg shadow-emerald-400/10" : "border-white/10 bg-white/5"}`}
                        >
                          <div className="flex h-full flex-col justify-between">
                            <div className="rounded-[1rem] border border-emerald-400/10 bg-emerald-400/10 p-4 text-center text-emerald-300">◻</div>
                            <div>
                              <div className="font-semibold text-white">{ITEM_LABELS[category].slice(0, 2).toUpperCase()}-{code}</div>
                              <div className="text-sm font-semibold text-emerald-300">{formatCurrency(rates[category])}</div>
                            </div>
                          </div>
                          {isSelected ? <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-400 px-1 text-xs font-bold text-slate-950">{qty}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="fixed bottom-20 left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-[28rem] -translate-x-1/2 rounded-[1.5rem] bg-emerald-400 px-5 py-4 text-left font-semibold text-emerald-950 shadow-2xl shadow-emerald-500/20"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm">{selectedCount} items</span>
                <span className="text-base">View Cart — {formatCurrency(calculateTotalFromQuantities())}</span>
                <span>›</span>
              </div>
            </button>

            {cartOpen && (
              <div className="fixed inset-0 z-40 bg-black/60 px-3 pb-4 pt-24 backdrop-blur-sm" onClick={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
                <div className="mx-auto flex max-h-[78vh] w-full max-w-md flex-col rounded-[2rem] border border-white/10 bg-slate-950/98 p-5 shadow-2xl shadow-black/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold text-white">Cart</h3>
                      <p className="text-sm text-slate-400">Adjust quantities before charging.</p>
                    </div>
                    <button type="button" onClick={() => setCartOpen(false)} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-300">Close</button>
                  </div>

                  <div className="mt-4 flex-1 space-y-3 overflow-y-auto">
                    {selectedItems.length === 0 ? (
                      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-400">No items selected yet.</div>
                    ) : (
                      selectedItems.map((item) => (
                        <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                          <div>
                            <div className="text-lg font-semibold text-white">{item.label}</div>
                            <div className="text-sm text-slate-400">Qty {item.qty}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => adjustCodeQty(item.label.startsWith("AN") ? "andar" : item.label.startsWith("BH") ? "bahar" : "result", item.label.split("-")[1], -1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-xl text-white">−</button>
                            <div className="min-w-10 text-center text-lg font-semibold text-white">{item.qty}</div>
                            <button type="button" onClick={() => adjustCodeQty(item.label.startsWith("AN") ? "andar" : item.label.startsWith("BH") ? "bahar" : "result", item.label.split("-")[1], 1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400 text-xl font-semibold text-slate-950">+</button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
                    <div className="flex items-center justify-between text-sm text-slate-300"><span>Subtotal</span><span>{formatCurrency(calculateTotalFromQuantities())}</span></div>
                    <div className="flex items-center justify-between text-2xl font-semibold text-white"><span>TOTAL</span><span className="text-emerald-300">{formatCurrency(calculateTotalFromQuantities())}</span></div>
                    <button type="button" onClick={saveFromQuantities} className="w-full rounded-[1.5rem] bg-red-500 px-4 py-4 text-lg font-semibold text-white">Charge {formatCurrency(calculateTotalFromQuantities())}</button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <section className="rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">Receipt preview</h3>
              <p className="text-sm text-slate-400">Generated from the current draft.</p>
            </div>
            <button type="button" onClick={() => downloadReceiptImage(lastReceipt ?? undefined)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300">Print / Save</button>
          </div>
          <div className="mt-4 rounded-3xl border border-slate-300 bg-white p-4 text-slate-900">
            <div className="space-y-1 font-mono text-[11px] leading-5">
              {preview.lines.map((line, index) => <div key={`${line}-${index}`}>{line}</div>)}
            </div>
          </div>
        </section>
      </div>
    );
  }

  function getSelectedItemsSummary() {
    const items: Array<{ label: string; qty: number; amount: number }> = [];
    const codePrefix = { andar: "AN", bahar: "BH", result: "RT" } as const;
    for (const category of RECEIPT_KEYS) {
      const catMap = codeQuantities[category] || {};
      for (const [code, qty] of Object.entries(catMap)) {
        if (qty > 0) {
          items.push({
            label: `${codePrefix[category]}-${code}`,
            qty,
            amount: rates[category] * qty,
          });
        }
      }
    }
    return items;
  }

  async function saveFromQuantities() {
    setMessage(null);
    const draftEntries = codeQuantitiesToEntries();
    if (draftEntries.length === 0) {
      setMessage("Please select at least one code with quantity");
      return;
    }

    const response = await fetch("/api/receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heading,
        entries: draftEntries.map((entry) => ({ itemKey: entry.itemKey, code: entry.code, qty: entry.qty })),
      }),
    });

    const data = (await response.json().catch(() => ({}))) as { receipt?: ReceiptRecord; error?: string };
    if (!response.ok || !data.receipt) {
      setMessage(data.error ?? "Unable to create receipt");
      return;
    }

    setLastReceipt(data.receipt);
    setCodeQuantities({ andar: {}, bahar: {}, result: {} });
    setMessage(`Receipt ${data.receipt.receiptNumber} created`);
    await refreshReceipts();

    downloadReceiptImage(data.receipt);
  }

  function getPreviewFromQuantities() {
    const draftEntries = codeQuantitiesToEntries();
    return buildReceiptLines({
      receiptNumber: nextReceiptNumber,
      heading,
      timestamp: new Date(),
      entries: draftEntries
        .map((entry) => {
          if (!entry.code || !entry.qty) return null;
          const rate = rates[entry.itemKey];
          return { itemKey: entry.itemKey, code: entry.code, qty: entry.qty, rate, amount: rate * entry.qty };
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    });
  }

  async function downloadReceiptImage(receiptData?: ReceiptRecord) {
    let preview;
    
    if (receiptData) {
      // If the API returned individual entries (from saveAndPrint), use them directly
      if (receiptData.entries && receiptData.entries.length > 0) {
        preview = buildReceiptLines({
          receiptNumber: receiptData.receiptNumber,
          heading: receiptData.heading ?? "",
          timestamp: new Date(receiptData.timestamp),
          entries: receiptData.entries,
        });
      } else {
        // Reconstruct from grouped DB fields (receipt history download)
        // Split comma-separated codes into individual receipt lines
        const savedEntries: Array<{ itemKey: (typeof RECEIPT_KEYS)[number]; code: string; qty: number; rate: number; amount: number }> = [];
        
        const itemTypes = [
          { key: "andar" as const, codeField: receiptData.andarCode, qty: receiptData.andarQty, rate: receiptData.andarRate ?? 12, amount: receiptData.andarAmount },
          { key: "bahar" as const, codeField: receiptData.baharCode, qty: receiptData.baharQty, rate: receiptData.baharRate ?? 55, amount: receiptData.baharAmount },
          { key: "result" as const, codeField: receiptData.resultCode, qty: receiptData.resultQty, rate: receiptData.resultRate ?? 110, amount: receiptData.resultAmount },
        ];

        for (const item of itemTypes) {
          if (!item.codeField || item.qty <= 0) continue;
          
          const codes = String(item.codeField).split(",").map(c => c.trim()).filter(Boolean);
          
          if (codes.length <= 1) {
            // Single code — use stored qty and amount directly
            const code = codes[0] || "";
            if (code) {
              savedEntries.push({
                itemKey: item.key,
                code,
                qty: Number(item.qty),
                rate: Number(item.rate),
                amount: Number(item.amount),
              });
            }
          } else {
            // Multiple codes — distribute qty evenly, each line gets its own amount
            const perCodeQty = Math.floor(Number(item.qty) / codes.length);
            const remainder = Number(item.qty) % codes.length;
            
            for (let i = 0; i < codes.length; i++) {
              const qty = perCodeQty + (i < remainder ? 1 : 0);
              savedEntries.push({
                itemKey: item.key,
                code: codes[i],
                qty,
                rate: Number(item.rate),
                amount: Number(item.rate) * qty,
              });
            }
          }
        }
        
        preview = buildReceiptLines({
          receiptNumber: receiptData.receiptNumber,
          heading: receiptData.heading ?? "",
          timestamp: new Date(receiptData.timestamp),
          entries: savedEntries,
        });
      }
    } else {
      // Printing draft receipt - fetch next receipt number to display
      let nextNumber = "PENDING";
      try {
        const resp = await fetch(`/api/receipts/next?heading=${encodeURIComponent(heading)}`, { cache: "no-store" });
        if (resp.ok) {
          const data = await resp.json();
          if (data?.receiptNumber) {
            nextNumber = String(data.receiptNumber);
          }
        }
      } catch (e) {
        // ignore, fall back to PENDING
      }

      preview = buildReceiptLines({
        receiptNumber: nextNumber,
        heading,
        timestamp: new Date(),
        entries: entries
          .map((entry) => {
            if (!entry.code || !entry.qty) {
              return null;
            }

            const rate = rates[entry.itemKey];
            return {
              itemKey: entry.itemKey,
              code: entry.code,
              qty: entry.qty,
              rate,
              amount: rate * entry.qty,
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      });
    }
    
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const scale = 2; // 2x resolution for crisp, sharp text
      const fontSize = 18;
      const lineHeight = 24;
      const padding = 28;
      const fontFamily = '"Courier New", Courier, monospace';
      const boldFont = `bold ${fontSize}px ${fontFamily}`;
      
      ctx.font = boldFont;
      
      let maxWidth = 0;
      for (const line of preview.lines) {
        const metrics = ctx.measureText(line);
        if (metrics.width > maxWidth) {
          maxWidth = metrics.width;
        }
      }
      
      const logicalWidth = maxWidth + padding * 2;
      const logicalHeight = preview.lines.length * lineHeight + padding * 2;
      
      canvas.width = logicalWidth * scale;
      canvas.height = logicalHeight * scale;
      canvas.style.width = `${logicalWidth}px`;
      canvas.style.height = `${logicalHeight}px`;
      
      ctx.scale(scale, scale);
      
      // Crisp rendering settings
      ctx.imageSmoothingEnabled = false;
      
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, logicalWidth, logicalHeight);
      
      ctx.font = boldFont;
      ctx.fillStyle = "black";
      ctx.textBaseline = "top";
      
      let y = padding;
      for (const line of preview.lines) {
        ctx.fillText(line, padding, y);
        
        // Underline the Time line
        if (line.includes("Time:")) {
          const textWidth = ctx.measureText(line.trimEnd()).width;
          const trimmedLine = line.trimStart();
          const leadingSpaces = line.length - trimmedLine.length;
          const offsetX = ctx.measureText(line.substring(0, leadingSpaces)).width;
          const underlineY = y + fontSize + 2;
          ctx.beginPath();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "black";
          ctx.moveTo(padding + offsetX, underlineY);
          ctx.lineTo(padding + textWidth, underlineY);
          ctx.stroke();
        }
        
        y += lineHeight;
      }
      
      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      const receiptNum = receiptData ? receiptData.receiptNumber : preview.lines.find(l => l.includes('Recpt No'))?.split(': ')[1] || 'receipt';
      a.download = `${receiptNum}.png`;
      a.click();
    }
  }

  async function saveRates() {
    const response = await fetch("/api/rates", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rateDraft),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Unable to save rates");
      return;
    }

    setRates(rateDraft);
    setMessage("Rates updated");
  }

  async function createCounterAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminForm.name || !adminForm.password) {
      setMessage("Please fill in Name and Password");
      return;
    }
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: adminForm.name, password: adminForm.password }),
    });

    const data = await response.json().catch(() => ({ error: "Network error" }));
    if (!response.ok || !data.user) {
      // Handle Zod validation errors (which are objects)
      let errorMsg = "Unable to create counter admin";
      if (typeof data.error === "string") {
        errorMsg = data.error;
      } else if (typeof data.error === "object" && data.error !== null) {
        // Extract first error message from Zod fieldErrors
        const firstField = Object.keys(data.error)[0];
        if (firstField && Array.isArray(data.error[firstField])) {
          errorMsg = data.error[firstField][0];
        }
      }
      setMessage(errorMsg);
      return;
    }

    setMessage(`Created ${data.user.name}`);
    setAdminForm({ name: "", password: "" });
    await refreshUsers();
  }

  async function deleteUser(id: string) {
    const response = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setMessage("Unable to remove user");
      return;
    }

    setMessage("Counter admin removed");
    await refreshUsers();
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setMessage("Please fill in all password fields");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage("New password and confirm password do not match");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setMessage("Password must be at least 6 characters");
      return;
    }
    const response = await fetch("/api/auth/update-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        currentPassword: passwordForm.currentPassword, 
        newPassword: passwordForm.newPassword,
        userId: passwordForm.selectedUserId === "self" ? undefined : passwordForm.selectedUserId,
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "Network error" }));
      setMessage(data.error ?? "Unable to update password");
      return;
    }

    setMessage("Password updated successfully");
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "", selectedUserId: "self" });
  }

  async function runSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await refreshReceipts(search);
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-300">Loading receipt console...</div>;
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-10">
        <section className="grid w-full gap-8 rounded-[2rem] border border-white/10 bg-slate-950/85 p-6 shadow-2xl shadow-black/30 backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div className="space-y-6">
            <button
              type="button"
              aria-label="Open menu"
              className="inline-flex items-center rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 text-white transition hover:border-amber-300/60 hover:text-amber-100"
            >
              <span className="space-y-1">
                <span className="block h-1 w-6 bg-white"></span>
                <span className="block h-1 w-6 bg-white"></span>
                <span className="block h-1 w-6 bg-white"></span>
              </span>
            </button>
          </div>

          <form onSubmit={handleLogin} autoComplete="off" className="space-y-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-6">
            <h2 className="text-2xl font-semibold text-white">Sign in</h2>
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Username or Name</span>
              <input name="username" autoComplete="off" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0 transition focus:border-amber-300" value={loginForm.username} onChange={(event) => setLoginForm((current) => ({ ...current, username: event.target.value }))} />
            </label>
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Password</span>
              <input name="password" type="password" autoComplete="new-password" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300" value={loginForm.password} onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))} />
            </label>
            <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200">Enter dashboard</button>
            {message ? <p className="rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{message}</p> : null}
          </form>
        </section>
      </main>
    );
  }

  const preview = getPreviewFromQuantities();

  return (
    <main className="no-print mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
      <div className="mb-6 flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white md:text-4xl">{ROLE_LABELS[session.role]} console</h1>
        </div>
        <div className="flex items-center gap-3">
          {session.role === "MASTER_ADMIN" && currentPage === "dashboard" && (
            <div className="relative">
              <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-3 font-medium text-white transition hover:border-amber-300/60 hover:text-amber-100">
                <div className="space-y-1">
                  <div className="h-1 w-5 bg-white"></div>
                  <div className="h-1 w-5 bg-white"></div>
                  <div className="h-1 w-5 bg-white"></div>
                </div>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 rounded-xl border border-white/10 bg-slate-950/90 shadow-lg z-50">
                  <button onClick={() => { setCurrentPage("rates"); setMenuOpen(false); }} className="block w-full px-4 py-2 text-left text-white hover:bg-amber-300/20 rounded-t-xl text-sm">Change Rates</button>
                  <button onClick={() => { setCurrentPage("sales"); setMenuOpen(false); }} className="block w-full px-4 py-2 text-left text-white hover:bg-amber-300/20 text-sm">Sales</button>
                  <button onClick={() => { setCurrentPage("admins"); setMenuOpen(false); }} className="block w-full px-4 py-2 text-left text-white hover:bg-amber-300/20 text-sm">Counter Admins</button>
                  <button onClick={() => { setCurrentPage("update-password"); setMenuOpen(false); }} className="block w-full px-4 py-2 text-left text-white hover:bg-amber-300/20 rounded-b-xl text-sm">Update Password</button>
                </div>
              )}
            </div>
          )}
          {currentPage !== "dashboard" && (
            <button onClick={() => { setCurrentPage("dashboard"); setMenuOpen(false); }} className="rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 font-medium text-white transition hover:border-amber-300/60 hover:text-amber-100">Back</button>
          )}
          <button onClick={handleLogout} className="rounded-2xl border border-white/15 bg-slate-950/70 px-4 py-3 font-medium text-white transition hover:border-amber-300/60 hover:text-amber-100">Sign out</button>
        </div>
      </div>

      {message ? <div className="mb-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">{message}</div> : null}

      {currentPage === "rates" && session.role === "MASTER_ADMIN" && (
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 max-w-2xl">
          <h2 className="text-2xl font-semibold text-white">Change Rates</h2>
          <p className="text-sm text-slate-400 mt-2">Edit rates for each item type.</p>
          <div className="mt-6 space-y-4">
            {RECEIPT_KEYS.map((key) => (
              <label key={key} className="block space-y-2 text-sm text-slate-300">
                <span>{key === "andar" ? "Andar" : key === "bahar" ? "Bahar" : "Result"}</span>
                <input type="number" min={0} value={rateDraft[key]} onChange={(event) => setRateDraft((current) => ({ ...current, [key]: Number(event.target.value) }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" />
              </label>
            ))}
          </div>
          <button onClick={saveRates} className="mt-6 w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200">Save rates</button>
        </div>
      )}

      {currentPage === "admins" && session.role === "MASTER_ADMIN" && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5">
            <h2 className="text-2xl font-semibold text-white">Add Counter Admin</h2>
            <form onSubmit={createCounterAdmin} className="mt-4 space-y-3 max-w-md">
              <input value={adminForm.name} onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" placeholder="Name" required />
              <input value={adminForm.password} onChange={(event) => setAdminForm((current) => ({ ...current, password: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" placeholder="Password" type="password" required />
              <button className="w-full rounded-2xl bg-emerald-400 px-4 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-300">Add counter admin</button>
            </form>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5">
            <h2 className="text-2xl font-semibold text-white">Counter Admins</h2>
            <div className="mt-4 space-y-3">
              {users.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-300">No counter admins yet.</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div>
                      <div className="font-semibold text-white">{user.name}</div>
                      <div className="text-sm text-slate-400">{user.username}</div>
                    </div>
                    <button onClick={() => deleteUser(user.id)} className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/20">Remove</button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {currentPage === "update-password" && (
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 max-w-2xl">
          <h2 className="text-2xl font-semibold text-white">Update Password</h2>
          {session.role === "MASTER_ADMIN" && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Select User</span>
                <select value={passwordForm.selectedUserId || ""} onChange={(event) => setPasswordForm((current) => ({ ...current, selectedUserId: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none">
                  <option value="self">My Account</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <form onSubmit={updatePassword} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Current Password</span>
              <input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" required />
            </label>
            <label className="block space-y-2 text-sm text-slate-300">
              <span>New Password</span>
              <input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" required />
            </label>
            <label className="block space-y-2 text-sm text-slate-300">
              <span>Confirm New Password</span>
              <input type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" required />
            </label>
            <button className="w-full rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-200">Update Password</button>
          </form>
        </div>
      )}

      {currentPage === "sales" && session.role === "MASTER_ADMIN" && (
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 max-w-4xl mx-auto shadow-2xl shadow-black/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-semibold text-white">Sales Report</h2>
              <p className="text-sm text-slate-400">View sales per counter for a specific date.</p>
            </div>
            <div className="flex items-center gap-3">
              <label htmlFor="sales-date" className="text-sm text-slate-300 font-medium">Date:</label>
              <input
                id="sales-date"
                type="date"
                value={salesDate}
                onChange={(e) => setSalesDate(e.target.value)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-white outline-none focus:border-amber-300/60"
              />
            </div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isSalesLoading ? (
              <div className="col-span-full py-8 text-center text-slate-400">Loading sales data...</div>
            ) : salesData.length === 0 ? (
              <div className="col-span-full py-8 text-center text-slate-400 rounded-2xl border border-white/5 bg-white/5">No sales recorded for this date.</div>
            ) : (
              salesData.map((sale, index) => (
                <div key={index} className="flex items-center justify-between p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                  <span className="font-medium text-white">{sale.heading}</span>
                  <span className="font-semibold text-amber-200">{formatCurrency(sale.total)}</span>
                </div>
              ))
            )}
          </div>

          {!isSalesLoading && salesData.length > 0 && (
            <div className="mt-8 flex items-center justify-between p-5 rounded-2xl bg-amber-300/10 border border-amber-300/20">
              <span className="text-xl font-semibold text-amber-100">Grand Total</span>
              <span className="text-2xl font-bold text-amber-300">{formatCurrency(grandTotal)}</span>
            </div>
          )}
        </div>
      )}

      {currentPage === "dashboard" && renderMobileDashboard()}

      {currentPage === "settings" && (
        <div className="space-y-4 rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20">
          <div>
            <h2 className="text-2xl font-semibold text-white">Settings</h2>
            <p className="text-sm text-slate-400">Manage account, rates, and admin tools.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {session.role === "MASTER_ADMIN" ? (
              <>
                <button onClick={() => setCurrentPage("rates")} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left text-white">Change Rates</button>
                <button onClick={() => setCurrentPage("sales")} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left text-white">Reports</button>
                <button onClick={() => setCurrentPage("admins")} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left text-white">Counter Admins</button>
                <button onClick={() => setCurrentPage("update-password")} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left text-white">Update Password</button>
              </>
            ) : (
              <button onClick={() => setCurrentPage("update-password")} className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left text-white">Update Password</button>
            )}
          </div>
        </div>
      )}

      <nav className="fixed bottom-3 left-1/2 z-50 flex w-[calc(100%-1rem)] max-w-md -translate-x-1/2 items-center justify-between rounded-[1.5rem] border border-white/10 bg-slate-950/92 px-3 py-2 shadow-2xl shadow-black/40 backdrop-blur">
        <button onClick={() => setCurrentPage("dashboard")} className={`flex flex-1 flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-xs font-medium ${currentPage === "dashboard" ? "text-emerald-300" : "text-slate-400"}`}>
          <span className="text-lg">▣</span>
          Dashboard
        </button>
        <button onClick={() => setCurrentPage("sales")} className={`flex flex-1 flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-xs font-medium ${currentPage === "sales" ? "text-emerald-300" : "text-slate-400"}`}>
          <span className="text-lg">▤</span>
          Reports
        </button>
        <button onClick={() => setCurrentPage("settings")} className={`flex flex-1 flex-col items-center gap-1 rounded-[1rem] px-2 py-2 text-xs font-medium ${currentPage === "settings" ? "text-emerald-300" : "text-slate-400"}`}>
          <span className="text-lg">⚙</span>
          Settings
        </button>
      </nav>
    </main>
  );
}
