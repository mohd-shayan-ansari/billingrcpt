"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function DatePicker({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

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
    </div>
  );
}
