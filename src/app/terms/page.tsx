import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Use | SMART BASIN",
  description: "ข้อกำหนดการใช้งานของระบบ SMART BASIN ลุ่มน้ำป่าพะยอม",
};

export default function TermsOfUsePage() {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-5 py-10 text-[#20325c]">
      <article className="mx-auto max-w-3xl rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-xs font-extrabold text-[#216ed7]">SMART BASIN</p>
        <h1 className="mt-2 text-3xl font-extrabold">ข้อกำหนดการใช้งาน</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">ปรับปรุงล่าสุด: 29 มิถุนายน 2569</p>

        <div className="mt-8 space-y-6 text-sm font-medium leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">การยอมรับข้อกำหนด</h2>
            <p className="mt-2">
              การเข้าสู่ระบบและใช้งาน SMART BASIN ถือว่าผู้ใช้งานยอมรับข้อกำหนดนี้ ระบบนี้จัดทำเพื่อสนับสนุนการติดตาม เฝ้าระวัง
              และบริหารจัดการสถานการณ์น้ำในพื้นที่ลุ่มน้ำป่าพะยอม.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">บัญชีและสิทธิ์การใช้งาน</h2>
            <p className="mt-2">
              ผู้ใช้งานต้องเข้าสู่ระบบผ่าน LINE Login และใช้สิทธิ์ตามบทบาทที่ได้รับ ผู้ดูแลระบบสามารถกำหนด เปลี่ยนแปลง
              หรือระงับสิทธิ์การใช้งานได้เมื่อจำเป็นต่อความปลอดภัยหรือการปฏิบัติงาน.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">การใช้งานที่เหมาะสม</h2>
            <p className="mt-2">
              ห้ามใช้ระบบเพื่อเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต แก้ไขข้อมูลอันเป็นเท็จ รบกวนการทำงานของระบบ หรือกระทำการใดที่อาจกระทบต่อการปฏิบัติงานของหน่วยงาน.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">ข้อจำกัดของข้อมูล</h2>
            <p className="mt-2">
              ข้อมูลในระบบอาจมาจากฐานข้อมูล เซ็นเซอร์ การคาดการณ์ หรือข้อมูลตัวอย่างบางส่วน ผู้ใช้งานควรใช้ข้อมูลประกอบการตัดสินใจร่วมกับประกาศทางราชการ
              และข้อมูลภาคสนามล่าสุด.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">การเปลี่ยนแปลงบริการ</h2>
            <p className="mt-2">
              ผู้ดูแลระบบอาจปรับปรุง เปลี่ยนแปลง หรือระงับบางส่วนของบริการเพื่อบำรุงรักษา เพิ่มความปลอดภัย หรือพัฒนาฟังก์ชันการใช้งาน.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">ติดต่อผู้ดูแลระบบ</h2>
            <p className="mt-2">
              หากพบปัญหาการใช้งาน ข้อมูลผิดปกติ หรือมีข้อสงสัยเกี่ยวกับข้อกำหนดนี้ กรุณาติดต่อผู้ดูแลระบบ SMART BASIN ของหน่วยงานผู้รับผิดชอบโครงการ.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
