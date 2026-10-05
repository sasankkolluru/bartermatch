import React from "react";

export default function KPICard({
  label,
  value,
  trend,
  tone = "default",
}: {
  label: string;
  value: string | number;
  trend?: string;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  return (
    <article className={`kpi tone-${tone}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{trend || "Live data"}</em>
    </article>
  );
}

