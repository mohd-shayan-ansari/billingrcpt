import { ReactNode } from "react";

type GlassCardProps = {
  title?: string;
  subtitle?: string;
  className?: string;
  action?: ReactNode;
  children: ReactNode;
};

export function GlassCard({ title, subtitle, className = "", action, children }: GlassCardProps) {
  return (
    <section className={`rounded-[2rem] border border-white/10 bg-slate-950/85 p-4 shadow-2xl shadow-black/20 ${className}`.trim()}>
      {(title || subtitle || action) ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title ? <h3 className="text-xl font-semibold text-white">{title}</h3> : null}
            {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type StatTileProps = {
  label: string;
  value: string;
  tone?: "emerald" | "amber" | "slate";
};

export function StatTile({ label, value, tone = "slate" }: StatTileProps) {
  const toneClasses = {
    emerald: "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-300/20 bg-amber-300/10 text-amber-100",
    slate: "border-white/10 bg-white/5 text-slate-200",
  } as const;

  return (
    <div className={`rounded-2xl border p-3 ${toneClasses[tone]}`}>
      <div className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</div>
      <div className="mt-1 text-xl font-semibold text-white">{value}</div>
    </div>
  );
}
