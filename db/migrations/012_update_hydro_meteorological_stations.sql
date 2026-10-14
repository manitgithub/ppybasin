begin;

-- Update only the eight supplied stations; preserve their readings and other devices.
insert into public.sensor_devices (device_id, name, location_name, latitude, longitude, status, metadata)
values
  ('PPY-01', 'ท่าอ่างป่าพะยอม', 'คลองป่าพะยอม, อ.ป่าพะยอม, จ.พัทลุง', 7.775364, 99.841004, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองป่าพะยอม","district":"ป่าพะยอม","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('PPY-02', 'บ้านใต้สะท่อม', 'คลองตลิ่งชัน, อ.ป่าพะยอม, จ.พัทลุง', 7.759851, 99.891585, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองตลิ่งชัน","district":"ป่าพะยอม","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('PPY-03', 'บ้านพร้าว', 'คลองปันแต, อ.ป่าพะยอม, จ.พัทลุง', 7.801450, 99.954751, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองปันแต","district":"ป่าพะยอม","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('PPY-04', 'บ้านปากคลองเก่า', 'คลองกระถิน, อ.ควนขนุน, จ.พัทลุง', 7.746880, 100.087279, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองกระถิน","district":"ควนขนุน","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('PPY-05', 'บ้านห้วยน้ำดำ', 'คลองห้วยกรวด, อ.ป่าพะยอม, จ.พัทลุง', 7.867480, 99.845137, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองห้วยกรวด","district":"ป่าพะยอม","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('PPY-06', 'บ้านแหลมโตนด', 'คลองแม่ไสย่านหนัด, อ.ควนขนุน, จ.พัทลุง', 7.817655, 100.047455, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองแม่ไสย่านหนัด","district":"ควนขนุน","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('TSL11', 'TSL11', 'คลองป่าพะยอม, อ.ป่าพะยอม, จ.พัทลุง', 7.833290, 99.910900, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"คลองป่าพะยอม","district":"ป่าพะยอม","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb),
  ('TX83', 'TX83', 'ทะเลน้อย, อ.ควนขนุน, จ.พัทลุง', 7.788817, 100.124260, 'active', '{"source":"hydro_meteorological_survey","source_label":"ตารางที่ตั้งสถานีสำรวจทางอุตุ-อุทกวิทยาที่ผู้ใช้ส่งให้","source_date":"2026-10-14","waterway":"ทะเลน้อย","district":"ควนขนุน","province":"พัทลุง","excluded_from_installation_list":false}'::jsonb)
on conflict (device_id) do update set
  name = excluded.name,
  location_name = excluded.location_name,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  status = case
    when public.sensor_devices.metadata->>'excluded_from_installation_list' = 'true' then excluded.status
    else public.sensor_devices.status
  end,
  metadata = public.sensor_devices.metadata || excluded.metadata,
  updated_at = now();

commit;
