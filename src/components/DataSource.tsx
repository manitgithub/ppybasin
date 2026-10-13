export type DataSourceInfo = { label: string; url?: string };

export default function DataSource({ label, url, inverse = false }: DataSourceInfo & { inverse?: boolean }) {
  return (
    <div className={`min-w-0 text-[11px] leading-relaxed ${inverse ? "text-white/90" : "text-slate-600"}`}>
      <p>แหล่งข้อมูล: <span className="font-semibold">{label}</span></p>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-0.5 block [overflow-wrap:anywhere] underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 ${inverse ? "text-white" : "text-[#2167b5]"}`}
          aria-label={`เปิดแหล่งข้อมูล ${label} (แท็บใหม่)`}
        >
          {url}
        </a>
      )}
    </div>
  );
}
