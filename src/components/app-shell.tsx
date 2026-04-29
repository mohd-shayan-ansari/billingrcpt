"use client";

import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { DEFAULT_MASTER_CREDENTIALS, DEFAULT_RATES, RECEIPT_KEYS, ROLE_LABELS } from "@/lib/constants";
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

export function AppShell() {
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ name: "", password: "" });
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
  const [currentPage, setCurrentPage] = useState<"dashboard" | "rates" | "admins" | "update-password">("dashboard");
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "", selectedUserId: "self" });

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
          setHeading(counterNum ? `Counter ${counterNum}` : "Counter 01");
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
      setHeading(counterNum ? `Counter ${counterNum}` : "Counter 01");
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
      receiptNumber: "PENDING",
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
    // Print the saved receipt
    printReceipt(data.receipt);
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

  async function printReceipt(receiptData?: ReceiptRecord) {
    let preview;
    
    if (receiptData) {
      // Printing a saved receipt - reconstruct entries from database fields
      const savedEntries: Array<{ itemKey: (typeof RECEIPT_KEYS)[number]; code: string; qty: number; rate: number; amount: number }> = [];
      
      if (receiptData.andarCode && receiptData.andarQty > 0) {
        const code = String(receiptData.andarCode || "").split(",")[0].trim();
        if (code) {
          savedEntries.push({
            itemKey: "andar",
            code,
            qty: Number(receiptData.andarQty || 0),
            rate: Number(receiptData.andarRate ?? 12),
            amount: Number(receiptData.andarAmount || 0),
          });
        }
      }
      if (receiptData.baharCode && receiptData.baharQty > 0) {
        const code = String(receiptData.baharCode || "").split(",")[0].trim();
        if (code) {
          savedEntries.push({
            itemKey: "bahar",
            code,
            qty: Number(receiptData.baharQty || 0),
            rate: Number(receiptData.baharRate ?? 55),
            amount: Number(receiptData.baharAmount || 0),
          });
        }
      }
      if (receiptData.resultCode && receiptData.resultQty > 0) {
        const code = String(receiptData.resultCode || "").split(",")[0].trim();
        if (code) {
          savedEntries.push({
            itemKey: "result",
            code,
            qty: Number(receiptData.resultQty || 0),
            rate: Number(receiptData.resultRate ?? 110),
            amount: Number(receiptData.resultAmount || 0),
          });
        }
      }
      
      preview = buildReceiptLines({
        receiptNumber: receiptData.receiptNumber,
        heading: receiptData.heading ?? "",
        timestamp: new Date(receiptData.timestamp),
        entries: savedEntries,
      });
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
    
    const lines = preview.lines.map((line) => `<div>${line.replace(/ /g, "&nbsp;")}</div>`).join("");
    const winName = `_print_${Date.now()}`;
    const printWindow = window.open("", winName, "width=420,height=800");

    if (!printWindow) {
      setMessage("Pop-up blocked. Allow pop-ups to print receipts.");
      return;
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>${preview.lines[0]}</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; font-family: Courier New, monospace; }
            .ticket { width: 58mm; padding: 4mm 3mm; white-space: pre-wrap; font-size: 12px; line-height: 1.35; }
          </style>
        </head>
        <body>
          <div class="ticket">${lines}</div>
          <script>
            window.onload = () => {
              try {
                window.focus();
                setTimeout(() => { window.print(); }, 50);
              } catch (e) {
                // ignore
              }
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  async function downloadPdf() {
    const preview = getPreview();
    const pdf = new jsPDF({ unit: "mm", format: [58, 120] });
    pdf.setFont("courier", "normal");
    pdf.setFontSize(9);

    let y = 8;
    for (const line of preview.lines) {
      pdf.text(line.slice(0, 28), 4, y);
      y += 5;
    }

    pdf.save(`${lastReceipt?.receiptNumber ?? "receipt"}.pdf`);
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
              <span>Name</span>
              <input name="username" autoComplete="off" className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none ring-0 transition focus:border-amber-300" value={loginForm.name} onChange={(event) => setLoginForm((current) => ({ ...current, name: event.target.value }))} />
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

  const preview = getPreview();

  return (
    datasource db {
      provider = "postgresql"
      url      = env("DATABASE_URL")
    }    <main className="no-print mx-auto w-full max-w-7xl px-4 py-6 md:py-10">
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

      {currentPage === "dashboard" && (
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5 shadow-2xl shadow-black/20">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Create receipt</h2>
                <p className="text-sm text-slate-400">Select item, type code, add quantity, then add more lines if needed.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right text-sm text-slate-300">Total<div className="text-2xl font-semibold text-amber-200">{formatCurrency(calculateTotal())}</div></div>
            </div>

            <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4">
              <label className="block space-y-2 text-sm text-slate-300">
                <span>Counter heading</span>
                <input value={heading} onChange={(event) => setHeading(event.target.value)} disabled={session.role === "COUNTER_ADMIN"} className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none transition focus:border-amber-300 disabled:opacity-60 disabled:cursor-not-allowed" placeholder="Counter 01" />
              </label>

              <div className="hidden grid-cols-[130px_140px_120px_130px_130px_80px] gap-3 px-2 text-xs uppercase tracking-[0.2em] text-slate-500 md:grid">
                <div>Item</div>
                <div>Code</div>
                <div>Qty</div>
                <div>Rate</div>
                <div>Total</div>
                <div></div>
              </div>

              {entries.map((entry) => {
                const rate = rates[entry.itemKey];
                const amount = computeEntryAmount(entry);
                return (
                  <div key={entry.id} className="grid gap-3 rounded-2xl border border-white/10 bg-slate-950/60 p-3 md:grid-cols-[130px_140px_120px_130px_130px_80px] md:items-end">
                    <label className="space-y-2 text-sm text-slate-300">
                      <span className="md:hidden">Item</span>
                      <select
                        value={entry.itemKey}
                        onChange={(event) => updateEntry(entry.id, { itemKey: event.target.value as (typeof RECEIPT_KEYS)[number] })}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-white outline-none transition focus:border-amber-300"
                      >
                        <option value="andar">AN</option>
                        <option value="bahar">BH</option>
                        <option value="result">RT</option>
                      </select>
                    </label>

                    <label className="space-y-2 text-sm text-slate-300">
                      <span className="md:hidden">Code</span>
                      <input
                        value={entry.code}
                        onChange={(event) => updateEntry(entry.id, { code: event.target.value })}
                        inputMode="numeric"
                        maxLength={entry.itemKey === "result" ? 2 : 1}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-white outline-none transition focus:border-amber-300"
                        placeholder={entry.itemKey === "result" ? "00 - 99" : "0 - 9"}
                      />
                    </label>

                    <label className="space-y-2 text-sm text-slate-300">
                      <span className="md:hidden">Qty</span>
                      <input
                        type="number"
                        min={1}
                        value={entry.qty}
                        onChange={(event) => updateEntry(entry.id, { qty: Math.max(1, Number(event.target.value) || 1) })}
                        className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-white outline-none transition focus:border-amber-300"
                      />
                    </label>

                    <div className="space-y-2 text-sm text-slate-300">
                      <span className="md:hidden">Rate</span>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-amber-200">{formatCurrency(rate)}</div>
                    </div>

                    <div className="space-y-2 text-sm text-slate-300">
                      <span className="md:hidden">Total</span>
                      <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">{formatCurrency(amount)}</div>
                    </div>

                    <button
                      onClick={() => removeEntryRow(entry.id)}
                      className="rounded-xl border border-red-300/20 bg-red-400/10 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={entries.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}

              <button onClick={addEntryRow} className="rounded-2xl border border-white/15 bg-slate-950/80 px-4 py-3 font-semibold text-white transition hover:border-amber-300 hover:text-amber-100">
                Add more item
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={saveAndPrint} className="rounded-2xl bg-emerald-400 px-5 py-3 font-semibold text-emerald-950 transition hover:bg-emerald-300">Print</button>
              <button onClick={downloadPdf} className="rounded-2xl border border-white/15 bg-slate-950/80 px-5 py-3 font-semibold text-white transition hover:border-amber-300 hover:text-amber-100">Download PDF</button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-slate-300">
              <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Grand total</div>
              <div className="mt-2 text-2xl font-semibold text-white">{formatCurrency(calculateTotal())}</div>
            </div>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-semibold text-white">Receipt history</h2>
                <p className="text-sm text-slate-400">Search by receipt number, heading, or admin.</p>
              </div>
              <form onSubmit={runSearch} className="flex gap-2">
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="w-56 rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none" placeholder="Search receipts" />
                <button className="rounded-2xl bg-amber-300 px-4 py-3 font-semibold text-slate-950">Go</button>
              </form>
            </div>

            <div className="mt-4 space-y-3">
              {receipts.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-slate-300">No receipts found.</div>
              ) : (
                receipts.map((receipt) => (
                  <div key={receipt.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-white">{receipt.receiptNumber}</div>
                        <div className="text-sm text-slate-400">{receipt.heading ?? "No heading"}</div>
                        <div className="text-sm text-slate-500">{formatDate(receipt.timestamp)} · {receipt.admin.name}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-amber-200">{formatCurrency(receipt.totalAmount)}</div>
                        <button onClick={() => printReceipt(receipt)} className="mt-2 rounded-lg bg-blue-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-600">Print</button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                      <div>Andar: {receipt.andarCode ?? "-"} x{receipt.andarQty}</div>
                      <div>Bahar: {receipt.baharCode ?? "-"} x{receipt.baharQty}</div>
                      <div>Result: {receipt.resultCode ?? "-"} x{receipt.resultQty}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="thermal-print overflow-hidden rounded-[2rem] border border-slate-300 bg-white p-4 shadow-2xl shadow-black/30">
            <div className="space-y-1 text-center text-xs uppercase tracking-[0.25em] text-slate-500">Preview</div>
            <div className="mt-3 whitespace-pre border-t border-dashed border-slate-300 pt-3 font-mono text-[11px] leading-5 text-slate-900">
              {preview.lines.map((line, index) => (
                <div key={`${line}-${index}`}>{line}</div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      )}
    </main>
  );
}
