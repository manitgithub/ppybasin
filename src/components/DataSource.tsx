export type DataSourceInfo = { label: string; url?: string };

export function DataSources({ sources }: { sources: DataSourceInfo[] }) {
  return <div className="my-3 grid min-w-0 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3 rounded-[8px] border border-slate-200 bg-white p-4">
    {sources.map((source) => <DataSource key={`${source.label}-${source.url}`} {...source} />)}
  </div>;
}

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
