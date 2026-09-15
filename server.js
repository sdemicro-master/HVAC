const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new Database(process.env.DB_FILE || path.join(__dirname, "sde_hvac.db"));

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS devices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  room TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'online',
  mode TEXT NOT NULL DEFAULT 'auto',
  target_temp REAL NOT NULL DEFAULT 24.0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  temperature REAL NOT NULL,
  humidity REAL NOT NULL,
  co2 REAL NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(device_id) REFERENCES devices(device_id)
);
`);

const deviceCount = db.prepare("SELECT COUNT(*) AS n FROM devices").get().n;
if (deviceCount === 0) {
  const insertDevice = db.prepare(`
    INSERT INTO devices(device_id,name,room,status,mode,target_temp)
    VALUES (?,?,?,?,?,?)
  `);
  insertDevice.run("SDE-AC-001", "Living Room AC", "Living Room", "online", "auto", 23.5);
  insertDevice.run("SDE-AC-002", "Bedroom AC", "Bedroom", "online", "auto", 22.5);
  insertDevice.run("SDE-AC-003", "Workspace AC", "Workspace", "online", "cool", 24.0);
  insertDevice.run("SDE-AC-004", "Meeting Room AC", "Meeting Room", "standby", "auto", 25.0);

  const insertReading = db.prepare(`
    INSERT INTO sensor_readings(device_id,temperature,humidity,co2,recorded_at)
    VALUES (?,?,?,?,?)
  `);
  const rooms = [
    ["SDE-AC-001",23.8,54,612],
    ["SDE-AC-002",22.6,51,540],
    ["SDE-AC-003",24.1,57,738],
    ["SDE-AC-004",25.2,59,810]
  ];
  for (const [id,t,h,c] of rooms) insertReading.run(id,t,h,c,new Date().toISOString());
}

// Demo sensor writer: simulates incoming IoT data into the database.
// Replace this block with your MQTT/IoT ingestion service in production.
setInterval(() => {
  const devices = db.prepare("SELECT device_id,target_temp,status FROM devices").all();
  const insert = db.prepare(`
    INSERT INTO sensor_readings(device_id,temperature,humidity,co2,recorded_at)
    VALUES (?,?,?,?,?)
  `);
  const tx = db.transaction(() => {
    for (const d of devices) {
      if (d.status !== "online") continue;
      const latest = db.prepare(`
        SELECT temperature,humidity,co2 FROM sensor_readings
        WHERE device_id=? ORDER BY id DESC LIMIT 1
      `).get(d.device_id);
      if (!latest) continue;
      const t = +(latest.temperature + (Math.random()-.5)*0.12).toFixed(1);
      const h = +(Math.max(35, Math.min(65, latest.humidity + (Math.random()-.5)*1.2))).toFixed(0);
      const c = Math.max(400, Math.round(latest.co2 + (Math.random()-.5)*24));
      insert.run(d.device_id,t,h,c,new Date().toISOString());
    }
  });
  tx();
}, 5000);

function latestFor(deviceId) {
  return db.prepare(`
    SELECT d.device_id,d.name,d.room,d.status,d.mode,d.target_temp,
           r.temperature,r.humidity,r.co2,r.recorded_at
    FROM devices d
    LEFT JOIN sensor_readings r ON r.id = (
      SELECT id FROM sensor_readings x
      WHERE x.device_id=d.device_id ORDER BY x.id DESC LIMIT 1
    )
    WHERE d.device_id=?
  `).get(deviceId);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/dashboard", (req,res) => {
  const devices = db.prepare("SELECT device_id FROM devices ORDER BY id").all()
    .map(x => latestFor(x.device_id));
  const readings = db.prepare(`
    SELECT temperature,humidity,co2,recorded_at
    FROM sensor_readings
    WHERE recorded_at >= datetime('now','-24 hours')
    ORDER BY recorded_at ASC
  `).all();
  const avg = db.prepare(`
    SELECT ROUND(AVG(temperature),1) temperature,
           ROUND(AVG(humidity),0) humidity,
           ROUND(AVG(co2),0) co2
    FROM sensor_readings
    WHERE recorded_at >= datetime('now','-24 hours')
  `).get();
  res.json({company:"SDE", generated_at:new Date().toISOString(), summary:avg, devices, readings});
});

app.get("/api/devices", (req,res) => {
  res.json(db.prepare("SELECT * FROM devices ORDER BY id").all().map(x => latestFor(x.device_id)));
});

app.get("/api/devices/:id/history", (req,res) => {
  const hours = Math.min(Number(req.query.hours) || 24, 168);
  const rows = db.prepare(`
    SELECT temperature,humidity,co2,recorded_at
    FROM sensor_readings
    WHERE device_id=? AND recorded_at >= datetime('now', ?)
    ORDER BY recorded_at ASC
  `).all(req.params.id, `-${hours} hours`);
  res.json(rows);
});

app.patch("/api/devices/:id", (req,res) => {
  const allowed = ["mode","target_temp","status"];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({error:"No editable fields"});
  const sets = fields.map(k => `${k}=?`).join(",");
  const values = fields.map(k => req.body[k]);
  values.push(req.params.id);
  db.prepare(`UPDATE devices SET ${sets} WHERE device_id=?`).run(...values);
  res.json(latestFor(req.params.id));
});

app.get("/api/health", (req,res) => res.json({ok:true, database:"connected", company:"SDE"}));

app.listen(PORT, () => {
  console.log(`SDE HVAC dashboard: http://localhost:${PORT}`);
});
