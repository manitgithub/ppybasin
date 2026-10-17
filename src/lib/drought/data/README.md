# Drought reference data

Captured on 2026-10-17 from the public reference dashboard:
https://pa-phayom-drought-monitor.dpakorn75.chatgpt.site/

- `seasonal-snapshot.json`: `/api/drought/latest` (October 2026 issue). Used only when direct HII downloads fail. The 11 tambon IDs, zones, and historical watchlist come from this reference scope. Watchlist membership is not a live drought declaration.
- `tmd-snapshot.json`: `/api/tmd-spei/latest` (13–22 October 2026). Includes 15 reviewed grid intersection areas and the reference's coverage denominator. Current SPEI values are fetched directly from the official TMD JSON and joined to these coordinates. The rounded intersection weights reproduce the reference summary to two decimals; no extra spatial precision is claimed. This analysis boundary is the reference's boundary, **not** `public/boundaries/pa-phayom-basin.geojson` used by the flood map, whose area differs. Do not overlay these statistics on that boundary as if they describe the same geometry.
- `tmd-grid-layout.json`: coordinate footprint of the official TMD JSON within 7.6–8.0 N, 99.6–100.3 E captured on the same date. Reject changes in layout rather than silently applying old intersection weights to a new grid. Null SPEI values contribute to no-data coverage and never become zero.
- `monthly-snapshot.json`: `/api/spei/latest`. August 2026 partial OAE snapshot. Only Pa Phayom has a value verified by the reference author. The other districts remain null. This is **not** a direct independent verification against the Power BI report, nor a live OAE feed. It must always be labeled as a reference snapshot.

Official sources retained in the snapshots:

- HII dataset: https://data.hii.or.th/dataset/0af4991c-f8b5-4681-b33f-e2e92c9fd09a
- HII monthly CSV: `https://live1.hii.or.th/product/latest/forecast/drought/YYYYMMdroughtForecast_6month.csv`
- TMD JSON: http://www.arcims.tmd.go.th/dashboard/10days/web_data/dashboard_data.json
- OAE catalog: https://catalog.oae.go.th/en/dataset/ai-drought-warning

The server checks the current Bangkok calendar month and up to two previous HII issues, never downgrading to an issue older than the committed snapshot. It validates all 66 tambon/month observations, rejects conflicting duplicates and unknown statuses, and never fills missing records as “no risk”. Results are cached for 15 minutes; manual refresh has a one-minute cooldown. Committed snapshots retain their original dates if a source fails. HII forecast statuses are presented directly; no confirmed disaster alert is inferred from a forecast or SPEI alone.
