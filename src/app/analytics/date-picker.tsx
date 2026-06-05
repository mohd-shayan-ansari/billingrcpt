"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function DatePicker({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = () => {
    setIsSyncing(true);
    router.refresh();
    setTimeout(() => {
      setIsSyncing(false);
    }, 800);
  };

  return (
    <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-1 border border-white/10">
      <input
        type="date"
        defaultValue={defaultValue}
        onChange={(e) => {
          const newDate = e.target.value;
          const params = new URLSearchParams(searchParams.toString());
          if (newDate) {
            params.set("date", newDate);
          } else {
            params.delete("date");
          }
          router.push(`?${params.toString()}`);
        }}
        className="bg-transparent border-none text-white text-sm outline-none px-2 py-1 [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert cursor-pointer"
      />
      <div className="w-px h-6 bg-white/10"></div>
      <button 
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-3 py-1 text-sm font-semibold text-emerald-300 transition hover:bg-white/5 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
      >
        {isSyncing ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
        <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync"}</span>
      </button>
    </div>
  );
}
