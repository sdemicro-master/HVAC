# SDE Smart HVAC Dashboard

Dashboard HVAC yang benar-benar membaca data dari database melalui REST API.

## Stack
- Node.js + Express
- SQLite (`better-sqlite3`)
- HTML/CSS/JavaScript vanilla
- REST API
- Polling 5 detik untuk tampilan live

## Jalankan
1. Install Node.js 18+.
2. Buka folder ini di terminal.
3. Jalankan:
   `npm install`
4. Jalankan:
   `npm start`
5. Buka:
   `http://localhost:3000`

Database `sde_hvac.db` dibuat otomatis saat server pertama kali berjalan.

## API
- `GET /api/dashboard` — summary, zone terbaru, histori 24 jam
- `GET /api/devices` — daftar device + reading terakhir
- `GET /api/devices/SDE-AC-001/history?hours=24` — histori sensor
- `PATCH /api/devices/SDE-AC-001` — ubah `mode`, `target_temp`, atau `status`
- `GET /api/health` — status database/API

## Database production
Saat ini SQLite dipakai agar proyek langsung bisa dijalankan. Untuk production, tabel `devices` dan `sensor_readings` bisa dipindahkan ke MySQL/PostgreSQL dan endpoint API tetap mempertahankan kontrak yang sama.

## Integrasi IoT
`setInterval()` pada `server.js` hanya simulator data. Untuk sensor nyata, ganti bagian tersebut dengan subscriber MQTT, Modbus gateway, OPC-UA, REST ingestion, atau service IoT yang Anda gunakan.

Contoh payload sensor:
`{ "device_id":"SDE-AC-001", "temperature":23.8, "humidity":54, "co2":612 }`
