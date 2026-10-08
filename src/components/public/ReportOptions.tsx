"use client";

import type { LucideIcon } from "lucide-react";
import { Check, HelpCircle, Waves } from "lucide-react";
import { waterDepthLabels } from "@/lib/reports";

export function OptionButton({ name, value, label, icon: Icon, selected, onChange, multiple = false }: { name: string; value: string; label: string; icon: LucideIcon; selected: boolean; onChange: () => void; multiple?: boolean }) {
  return <label className={`report-option-button${selected ? " selected" : ""}`}>
    <input type={multiple ? "checkbox" : "radio"} name={name} value={value} checked={selected} onChange={onChange} />
    <Icon size={21} aria-hidden="true" /><span>{label}</span>{selected && <Check className="option-check" size={16} aria-hidden="true" />}
  </label>;
}

const waterlines: Record<string, number> = { ankle: 76, knee: 60, waist: 44, neck: 23, overhead: 6 };
function DepthIcon({ depth }: { depth: string }) {
  const y = waterlines[depth];
  return <svg className="water-depth-icon" viewBox="0 0 56 88" width="42" height="60" aria-hidden="true">
    <circle cx="28" cy="16" r="7" fill="none" stroke="currentColor" strokeWidth="2.5" />
    <path d="M28 25v29m0-24-12 16m12-16 12 16M28 54l-9 28m9-28 9 28" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d={`M5 ${y}q6-4 12 0t12 0t12 0t10 0V88H5Z`} fill="currentColor" opacity=".18" />
    <path d={`M5 ${y}q6-4 12 0t12 0t12 0t10 0`} fill="none" stroke="currentColor" strokeWidth="2" />
  </svg>;
}
export function WaterDepthOptions({ value, onChange }: { value: keyof typeof waterDepthLabels; onChange: (value: keyof typeof waterDepthLabels) => void }) {
  return <fieldset className="water-depth-field"><legend><Waves size={19} />น้ำสูงประมาณไหน?</legend><p>เทียบกับร่างกายผู้ใหญ่จากที่มองเห็น ไม่ต้องลงน้ำเพื่อวัด</p>
    <div className="water-depth-options">{Object.entries(waterDepthLabels).map(([depth, label]) => <label key={depth} className={`water-depth-button${value === depth ? " selected" : ""}`}>
      <input type="radio" name="waterDepth" value={depth} checked={value === depth} onChange={() => onChange(depth as keyof typeof waterDepthLabels)} />
      {depth === "unknown" ? <HelpCircle size={31} aria-hidden="true" /> : depth === "dry" ? <Waves size={31} aria-hidden="true" /> : <DepthIcon depth={depth} />}<span>{label}</span>{value === depth && <Check className="option-check" size={15} aria-hidden="true" />}
    </label>)}</div>
  </fieldset>;
}
