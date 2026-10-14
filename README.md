# SMART BASIN - ระบบอัจฉริยะลุ่มน้ำป่าพะยอม

Next.js dashboard สำหรับติดตามสถานการณ์น้ำ ศูนย์พักพิง และพื้นที่เฝ้าระวังน้ำท่วมในลุ่มน้ำป่าพะยอม

## การรันในเครื่อง

```bash
npm install
npm run dev
```

เมื่อต้องการใช้ workflow ประกาศเตือนน้ำท่วมและการอนุมัติ ให้รัน migration เพิ่มเติม:

```bash
npm run db:migrate:alerts
```

เปิดหน้าเว็บที่ [http://localhost:3000](http://localhost:3000)

## Environment

คัดลอก `.env.example` เป็น `.env.local` แล้วตั้งค่า:

```bash
DATABASE_URL="postgresql://..."
AUTH_SECRET="replace-with-32-byte-random-secret"
LINE_CHANNEL_ID=""
LINE_CHANNEL_SECRET=""
LINE_CALLBACK_URL="https://hpor.horusai.pro/api/auth/line/callback"
AUTH_BYPASS="false"
```

ระบบจะอ่านข้อมูลศูนย์พักพิงจากตาราง `public.shelters` และแปลงพิกัด `geom` ด้วย PostGIS (`ST_X`, `ST_Y`) ผ่าน route `/api/dashboard`

เมื่อเปิดด้วย `localhost`, `127.0.0.1` หรือ `::1` ในโหมดพัฒนา ระบบให้บัญชีผู้ติดตามทดสอบอัตโนมัติ เปิดฟอร์มและส่งรายงานได้โดยไม่ต้อง Login LINE (ต้องมีฐานข้อมูลและ migration พร้อม) โดเมนจริงและโหมด production ยังต้อง Login LINE

ต้องการทดสอบหน้าผู้ดูแลใน dev ให้ตั้ง `AUTH_BYPASS=true` ใน `.env.local` ระบบจะสร้างผู้ใช้จำลองสิทธิ์ admin โดยไม่ต้องผ่าน LINE Login

เพิ่มหรืออัปเดตข้อมูลศูนย์อพยพพื้นที่ป่าพะยอมพร้อมจำนวนรองรับ:

```bash
npm run db:migrate:shelters
```

นำเข้าทะเบียนศูนย์พักพิงจาก CSV:

```bash
npm run db:import:shelters -- --dry-run
npm run db:import:shelters
```

ไฟล์เริ่มต้นคือ `docs/ศูนย์พักพิง-090569.csv` หรือระบุพาธ CSV หลังคำสั่งได้ รองรับ `--scope all`, `--scope phatthalung` และ `--scope pa-phayom` (ค่าเริ่มต้น `all`)
ตัวนำเข้าปรับ schema ให้อัตโนมัติ เก็บทุกแถวพร้อมต้นฉบับและข้อผิดพลาดใน `public.shelter_registry` รวมถึงข้อมูลผู้ประสานงานซึ่งไม่ส่งออกผ่าน API สาธารณะ
เฉพาะสถานที่ในอำเภอป่าพะยอมที่ชื่อ ความจุ และพิกัดครบ จะเชื่อมเข้า `public.shelters` ด้วยรหัส `PPY-SH-XXX` โดยรวมสถานที่ชื่อและพิกัดเดียวกันเป็นหมุดเดียว
ศูนย์ใหม่ใช้สถานะ `standby` (เตรียมพร้อม ยังไม่ยืนยันเปิด) การนำเข้าไฟล์เดิมซ้ำจะอัปเดตข้อมูลต้นทางโดยไม่เพิ่มรายการซ้ำ ไม่เปลี่ยนสถานะเปิด–ปิดหรือเวลายืนยันของศูนย์เดิม และไม่ลบศูนย์ที่เจ้าหน้าที่บันทึกไว้

สร้าง/อัปเดตตารางข้อมูลพื้นฐานหมู่บ้าน:

```bash
npm run db:migrate:villages
```

## Sensor Webhook

สร้างตารางสำหรับรับข้อมูลเซ็นเซอร์:

```bash
npm run db:migrate:sensors
```

คำสั่งนี้จะเพิ่ม/อัปเดตสถานีอุตุ–อุทกวิทยา 8 จุดตามตารางวันที่ 14 ตุลาคม 2569 รวม `TSL11` และ `TX83` และนำสถานีเดิม `WS001`–`WS006` ออกจากรายการ/แผนที่ โดยเก็บประวัติการตรวจวัดเดิมไว้

สำหรับฐานข้อมูลที่สร้างตารางแล้ว ให้อัปเดตเฉพาะชุดสถานีล่าสุดด้วย:

```bash
node scripts/run-migration.mjs db/migrations/012_update_hydro_meteorological_stations.sql db/migrations/013_retire_previous_sensor_stations.sql
```

ตั้งค่าฝั่ง IoT sender:

```http
POST /api/sensor
Content-Type: application/json
```

```json
{
  "device_id": "WS001",
  "wind_speed": 1.10,
  "direction": "Northeast",
  "humidity": 50.40,
  "temperature": 27.40,
  "rainfall": 0.00,
  "water_level": 7.413,
  "batteryVoltage": 11.05,
  "switchingVoltage": 11.16
}
```

ไม่ต้องส่ง `timestamp` ระบบจะใช้เวลาของ server ตอนรับข้อมูลเป็นเวลาอ้างอิงให้เอง ข้อมูลจะถูกบันทึกที่ `public.sensor_readings` และอัปเดตสถานะล่าสุดของอุปกรณ์ที่ `public.sensor_devices`

## หมายเหตุข้อมูล

ฐานข้อมูลปัจจุบันมีตารางหลักคือ `public.shelters` ยังไม่พบตาราง telemetry/ระดับน้ำจริง จึงใช้ข้อมูลสถานีตรวจวัดและพื้นที่น้ำท่วมจำลองใน dashboard ระหว่างรอ schema จริง

## LINE Login และสิทธิ์ผู้ใช้

สร้างตารางผู้ใช้และ session:

```bash
npm run db:migrate:auth
```

ตั้งค่า URL ใน LINE Developers:

- Callback URL: `https://basinuat.horusai.pro/api/auth/line/callback`
- Privacy policy URL: `https://basinuat.horusai.pro/privacy`
- Terms of use URL: `https://basinuat.horusai.pro/terms`

## หน้าผู้ติดตามและรายงานประชาชน

ผู้มาใหม่ดูหน้าหลักได้ทันที บัญชี LINE ใหม่เริ่มเป็นผู้ติดตามสถานการณ์ (`viewer`) และไม่ให้บัญชีแรกเป็น admin อัตโนมัติ กำหนดผู้ดูแลผ่าน `LINE_ADMIN_USER_IDS` หรือผู้ดูแลเดิม เมื่อทดสอบหน้าผู้ติดตามให้ตั้ง `AUTH_BYPASS=false`

```bash
npm run db:migrate:auth
npm run db:migrate:reports
```

หน้ามือถือรองรับแจ้งน้ำท่วม/สภาพถนน ขอความช่วยเหลือ แจ้งน้ำลด รูปประกอบและพิกัด พร้อมติดตามรายงานส่วนตัว เจ้าหน้าที่ต้องมี `reports:manage` เพื่อดูคิวและเปลี่ยนสถานะ ดูรายละเอียดฐานข้อมูล สิทธิ์ และข้อกำหนดการเปิดใช้งานใน [docs/citizen-reports.md](docs/citizen-reports.md)
