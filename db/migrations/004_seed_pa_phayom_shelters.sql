begin;

insert into public.shelters (code, name, capacity, status, geom, updated_at)
values
  (
    'PPY-SH-001',
    'ศูนย์พักพิงเทศบาลป่าพะยอม',
    450,
    'open',
    ST_SetSRID(ST_MakePoint(100.20650, 7.78990), 4326),
    now()
  ),
  (
    'PPY-SH-002',
    'โรงเรียนบ้านทุ่งยาว',
    280,
    'open',
    ST_SetSRID(ST_MakePoint(100.19770, 7.77150), 4326),
    now()
  ),
  (
    'PPY-SH-003',
    'ศาลาอเนกประสงค์บ้านคลองทรายขาว',
    320,
    'open',
    ST_SetSRID(ST_MakePoint(100.18680, 7.78360), 4326),
    now()
  ),
  (
    'PPY-SH-004',
    'วัดบ้านหัวลำ',
    240,
    'open',
    ST_SetSRID(ST_MakePoint(100.21240, 7.80120), 4326),
    now()
  ),
  (
    'PPY-SH-005',
    'โรงเรียนบ้านแม่ขรี',
    360,
    'open',
    ST_SetSRID(ST_MakePoint(100.16690, 7.74680), 4326),
    now()
  ),
  (
    'PPY-SH-006',
    'องค์การบริหารส่วนตำบลลานข่อย',
    220,
    'closed',
    ST_SetSRID(ST_MakePoint(100.22810, 7.76230), 4326),
    now()
  )
on conflict (code) do update set
  name = excluded.name,
  capacity = excluded.capacity,
  status = excluded.status,
  geom = excluded.geom,
  updated_at = now();

commit;
