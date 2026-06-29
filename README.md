# SMART BASIN - ระบบอัจฉริยะลุ่มน้ำป่าพะยอม

Next.js dashboard สำหรับติดตามสถานการณ์น้ำ ศูนย์พักพิง และพื้นที่เฝ้าระวังน้ำท่วมในลุ่มน้ำป่าพะยอม

## การรันในเครื่อง

```bash
npm install
npm run dev
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
```

ระบบจะอ่านข้อมูลศูนย์พักพิงจากตาราง `public.shelters` และแปลงพิกัด `geom` ด้วย PostGIS (`ST_X`, `ST_Y`) ผ่าน route `/api/dashboard`

## Sensor Webhook

สร้างตารางสำหรับรับข้อมูลเซ็นเซอร์:

```bash
npm run db:migrate:sensors
```

ตั้งค่าฝั่ง IoT sender:

```http
POST /api/sensor
Content-Type: application/json
```

```json
{
  "device_id": "WS001",
  "temperature": 31.5,
  "humidity": 75,
  "wind_speed": 3.2,
  "battery": 4.1
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
