# SDE Smart HVAC — Cloudflare Workers + D1

Versi Cloudflare-native: Workers Static Assets + Worker API + D1. Tidak menggunakan Express/SQLite.

## Deploy
1. `npm install`
2. `npx wrangler d1 create sde-hvac-db`
3. Masukkan `database_id` hasil command ke `wrangler.jsonc`.
4. `npx wrangler d1 execute sde-hvac-db --remote --file=schema.sql`
5. `npx wrangler deploy`

Untuk Git integration Cloudflare: root repository adalah root project ini, build command `npm install`, deploy command `npx wrangler deploy`. Jangan set output directory lain karena `wrangler.jsonc` sudah menunjuk `./public`.

## API
GET `/api/health`
GET `/api/dashboard`
GET `/api/devices/SDE-AC-001/history?hours=24`
PATCH `/api/devices/SDE-AC-001`
POST `/api/sensors`

Contoh sensor:
`curl -X POST https://YOUR-DOMAIN/api/sensors -H 'content-type: application/json' -d '{"device_id":"SDE-AC-001","temperature":23.8,"humidity":54,"co2":612}'`

Tambahkan authentication/API token sebelum endpoint sensor dibuka ke internet untuk production.
