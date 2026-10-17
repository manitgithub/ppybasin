# RID public cameras in the Pa Phayom map

Verified 2026-10-17 against https://telerid.rid.go.th/#/ using its public feeds, without authentication:

- Station inventory: `https://telerid.rid.go.th/restapi/main/station_list/`
- Public camera inventory: `wss://telerid.rid.go.th/ws/cctv/` (`INIT` message)
- Per-station public metadata: `wss://telerid.rid.go.th/ws/station/{id}/`
- Snapshot: `https://telerid.rid.go.th/restapi/main/camera/1/SKA-{code}/image.jpg`

The station inventory contained 921 stations. Point-in-polygon filtering against `public/boundaries/pa-phayom-basin.geojson` selected these two, both with camera channel 1 in the public camera inventory:

| Code | ID | Name | Latitude | Longitude |
| --- | --- | --- | --- | --- |
| TSL11 | 719 | ฝายคลองบ้านพร้าว | 7.83329 | 99.9109 |
| TX83 | 757 | บ้านทะเลน้อย | 7.788817 | 100.12426 |

Nearby TSL12 (คลองท่าแนะ), TX276 (บ้านเขาปู่), TPN11 (ฝายไม้เสียบ), and TTr8 (บ้านเขาหลัก) are outside this map boundary and were not added. Existing DDPM markers are retained.

At verification, TX83 returned a valid JPEG (`image/jpg`); TSL11 returned HTTP 500 and its public timestamp was old (2026-08-13T18:30:00Z, 14 August in Thailand). Keep the station visible, show image failures, and display the timestamp currently reported by the public station feed; do not claim either station is streaming live. The metadata may be available even when the snapshot is unavailable. Times are displayed in Asia/Bangkok, and timestamps older than one hour receive an explicit warning.

Only registered camera identifiers are accepted by the image and metadata routes. No caller-supplied upstream URL or image path is used. The proxy supports the official `image/jpg` response as well as `image/jpeg`, validates JPEG magic bytes, caps image size, and uses bounded requests. Metadata requests are coalesced and cached for 30 seconds. The preview refreshes snapshots and metadata every minute while visible.
