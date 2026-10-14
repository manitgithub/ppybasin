import styles from "./LocalPreviewSwitcher.module.css";

export default function LocalPreviewSwitcher({ loggedIn, children }: { loggedIn: boolean; children: React.ReactNode }) {
  return <div className={styles.root}>
    <aside className={styles.toolbar} aria-label="สลับมุมมองทดสอบ localhost">
      <span>LOCAL <span className={styles.caption}>· มุมมองทดสอบ</span></span>
      <form action="/api/dev/preview" method="post">
        <button name="mode" value="logged-in" aria-pressed={loggedIn}>เข้าสู่ระบบ</button>
        <button name="mode" value="guest" aria-pressed={!loggedIn}>ไม่เข้าสู่ระบบ</button>
      </form>
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
