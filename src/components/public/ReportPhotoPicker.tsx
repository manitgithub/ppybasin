"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Plus, X } from "lucide-react";
import { MAX_REPORT_PHOTOS, MAX_REPORT_PHOTO_BYTES, MAX_REPORT_PHOTOS_BYTES } from "@/lib/reports";

type Preview = { id: string; file: File; url: string };

export default function ReportPhotoPicker({ onChange }: { onChange: (files: File[]) => void }) {
  const [photos, setPhotos] = useState<Preview[]>([]);
  const [error, setError] = useState("");
  const urls = useRef(new Set<string>());
  useEffect(() => {
    const current = urls.current;
    return () => { current.forEach((url) => URL.revokeObjectURL(url)); current.clear(); };
  }, []);

  function addFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!selected.length) return;
    if (photos.length + selected.length > MAX_REPORT_PHOTOS) { setError(`แนบได้สูงสุด ${MAX_REPORT_PHOTOS} รูป ลบบางรูปก่อนเพิ่ม`); return; }
    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) { setError("รองรับรูป JPG, PNG หรือ WebP เท่านั้น"); return; }
    if (selected.some((file) => file.size === 0 || file.size > MAX_REPORT_PHOTO_BYTES)) { setError("แต่ละรูปต้องมีขนาดไม่เกิน 5 MB และไม่ใช่ไฟล์ว่าง"); return; }
    if ([...photos.map((photo) => photo.file), ...selected].reduce((total, file) => total + file.size, 0) > MAX_REPORT_PHOTOS_BYTES) { setError("รูปทั้งหมดรวมกันต้องไม่เกิน 20 MB"); return; }
    const next = [...photos, ...selected.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      return { id: crypto.randomUUID(), file, url };
    })];
    setPhotos(next); setError(""); onChange(next.map((photo) => photo.file));
  }
  function removePhoto(id: string) {
    const removed = photos.find((photo) => photo.id === id);
    if (removed) { URL.revokeObjectURL(removed.url); urls.current.delete(removed.url); }
    const next = photos.filter((photo) => photo.id !== id);
    setPhotos(next); setError(""); onChange(next.map((photo) => photo.file));
  }
  return <section className="report-photo-picker" aria-label="รูปประกอบเหตุการณ์">
    <div className="report-photo-heading"><span><Camera size={20} /><b>รูปประกอบ (ถ้ามี)</b></span><small>{photos.length}/{MAX_REPORT_PHOTOS} รูป</small></div>
    <p>JPG, PNG, WebP · รูปละไม่เกิน 5 MB · รวมไม่เกิน 20 MB</p>
    {photos.length > 0 && <div className="report-photo-previews">{photos.map((photo, index) => <figure key={photo.id}>
      {/* Native images display local object URLs without routing private files through an optimizer. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.url} alt={`รูปที่ ${index + 1}: ${photo.file.name}`} />
      <button type="button" aria-label={`ลบรูปที่ ${index + 1}: ${photo.file.name}`} onClick={() => removePhoto(photo.id)}><X size={18} /></button>
      <figcaption><b>รูปที่ {index + 1}</b><span>{photo.file.name}</span></figcaption>
    </figure>)}</div>}
    {photos.length < MAX_REPORT_PHOTOS && <label className="report-photo-add"><Plus size={21} /><span>{photos.length ? "เพิ่มรูปถ่าย" : "เลือกรูปถ่าย"}</span><input type="file" multiple accept="image/jpeg,image/png,image/webp" aria-label="เลือกรูปถ่ายหลายภาพ" onChange={addFiles} /></label>}
    {error && <p className="citizen-error" role="alert">{error}</p>}
  </section>;
}
