# Additional GIS map layers

Imported on 2026-10-17 from the public reference [Pa Phayom Water Watch](https://pa-phayom-station-map.dpakorn75.chatgpt.site/), whose layer control links to [the source GIS folder](https://drive.google.com/drive/folders/1aTi0Osd82RebUhDnL5i9brLaOR8wd1c3). Each file in `public/gis/` is copied from the same-named `/data/{id}.geojson` on the reference site. Coordinates and feature counts were checked during import. Survey dates and original agency provenance are not supplied by these exports; do not describe them as current observations. Land use is explicitly dated 2020 (2563).

| File / layer ID | Features | Contents |
| --- | ---: | --- |
| gis_rain | 8 | Reference rain station locations |
| gis_water | 15 | Reference water-level station locations |
| gis_auto | 6 | Reference automatic station locations |
| thanae_basin | 1 | Khlong Tha Nae basin boundary |
| districts | 9 | District boundaries |
| subdistricts | 44 | Subdistrict boundaries |
| main_stream | 1 | Main watercourse alignment |
| waterways | 45 | Watercourse / waterbody polygons |
| villages | 107 | Village locations |
| flood_risk | 85 | Village flood risk classifications |
| drought_risk | 44 | Village drought risk classifications |
| landuse | 7,219 | Land use polygons, 2020 |

The existing Pa Phayom boundary and operational layers are retained. Tha Nae is now a primary boundary option beside Pa Phayom, using the same white backing, dashed outline and subtle fill (teal for Pa Phayom, purple for Tha Nae). Select either or both; “ดูทั้ง 2 ลุ่มน้ำ” enables both and fits their combined bounds. A single outside mask subtracts all selected basins with polygon-clipping, preserving clear overlapping areas and respecting holes. With neither selected, no outside mask is shown. Nearby shelter navigation retains viewport control. The remaining eleven GIS layers start disabled and fetch local static files only when enabled. Parsed files are cached for the browser session; disabling a loading layer aborts its request. Loading/error states appear in each row; toggle off/on to retry failures. Leaflet Canvas renders geometry, including the larger land use layer. Popup and tooltip contents use DOM text nodes, never HTML from GIS properties. Old water-level attributes in `gis_water` are intentionally not displayed as measurements. Risk layers describe the source dataset, not active incidents or alerts. Data coverage includes nearby areas outside the basin.

To update, fetch the source exports, verify counts/coordinates/attributes, and update `src/lib/gis-layers.ts` and this provenance note together. Files are snapshots and do not automatically synchronize with the reference site.

Run `npm run test:basin-boundaries` to check single/combined masks, overlaps, holes, and coverage against the actual basin files.
