"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { ArrowRight, CloudRain, Wind, X } from "lucide-react";
import styles from "./WindyWeather.module.css";

const WindyViewer = dynamic(() => import("./WindyViewer"), { loading: () => <p className={styles.loading} role="status">กำลังเปิด Windy…</p> });

export default function WindyWeather({ onFullPage }: { onFullPage?: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [layer, setLayer] = useState<"rain" | "wind">("rain");
  const [opened, setOpened] = useState(false);
  function open(next: "rain" | "wind") {
    setLayer(next); setOpened(true); dialog.current?.showModal();
  }
  return <>
    <section className={styles.launcher} aria-label="ฝนและลมจาก Windy">
      <div><strong>อากาศและพยากรณ์ · Windy</strong><small>ฝนตามเวลา · ฝนสะสม · ลม · เมฆ</small></div>
      <div className={styles.launchButtons}>
        <button type="button" onClick={() => open("rain")} aria-label="ดูฝนจาก Windy"><CloudRain size={17} />ฝน</button>
        <button type="button" onClick={() => open("wind")} aria-label="ดูลมจาก Windy"><Wind size={17} />ลม</button>
      </div>
      {onFullPage && <button type="button" className={styles.fullPage} onClick={onFullPage}>เปิดหน้า Windy <ArrowRight size={14} /></button>}
    </section>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="windy-title" onClose={() => setOpened(false)} onClick={event => {
      if (event.target === event.currentTarget) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.current?.close();
      }
    }}>
      <header className={styles.header}>
        <div><h2 id="windy-title">Windy · สภาพอากาศและพยากรณ์</h2><p>ป่าพะยอมและภาคใต้ · แผนที่และตารางพยากรณ์</p></div>
        <button type="button" className={styles.close} onClick={() => dialog.current?.close()} aria-label="ปิดแผนที่ Windy"><X size={22} /></button>
      </header>
      <div className={styles.content}>{opened && <WindyViewer initialLayer={layer} showHeading={false} />}</div>
    </dialog>
  </>;
}
