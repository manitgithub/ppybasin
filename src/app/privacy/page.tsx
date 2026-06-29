import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | SMART BASIN",
  description: "นโยบายความเป็นส่วนตัวของระบบ SMART BASIN ลุ่มน้ำป่าพะยอม",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-[#eef3f8] px-5 py-10 text-[#20325c]">
      <article className="mx-auto max-w-3xl rounded-[8px] border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <p className="text-xs font-extrabold text-[#216ed7]">SMART BASIN</p>
        <h1 className="mt-2 text-3xl font-extrabold">นโยบายความเป็นส่วนตัว</h1>
        <p className="mt-2 text-sm font-semibold text-slate-500">ปรับปรุงล่าสุด: 29 มิถุนายน 2569</p>

        <div className="mt-8 space-y-6 text-sm font-medium leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">ข้อมูลที่เราเก็บรวบรวม</h2>
            <p className="mt-2">
              ระบบ SMART BASIN ใช้ LINE Login เพื่อยืนยันตัวตนผู้ใช้งาน โดยอาจเก็บข้อมูลจากบัญชี LINE เช่น LINE User ID,
              ชื่อที่แสดง, รูปโปรไฟล์ และอีเมลในกรณีที่ผู้ใช้อนุญาต รวมถึงข้อมูลบทบาท สิทธิ์การใช้งาน และเวลาเข้าสู่ระบบ.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">วัตถุประสงค์ในการใช้ข้อมูล</h2>
            <p className="mt-2">
              ข้อมูลถูกใช้เพื่อยืนยันตัวตน ควบคุมสิทธิ์การเข้าถึง dashboard จัดการผู้ใช้งาน บันทึกสถานะการใช้งาน และรักษาความปลอดภัยของระบบติดตามสถานการณ์น้ำ.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">การเปิดเผยข้อมูล</h2>
            <p className="mt-2">
              เราไม่ขายข้อมูลส่วนบุคคลให้บุคคลภายนอก ข้อมูลอาจถูกเข้าถึงโดยผู้ดูแลระบบหรือหน่วยงานที่เกี่ยวข้องเฉพาะเท่าที่จำเป็นต่อการปฏิบัติงานและการดูแลความปลอดภัย.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">การเก็บรักษาและความปลอดภัย</h2>
            <p className="mt-2">
              ระบบจัดเก็บ session ในรูปแบบ server-side และใช้ cookie แบบ httpOnly เพื่อลดความเสี่ยงจากการเข้าถึงโดยสคริปต์ฝั่งผู้ใช้.
              ข้อมูลจะถูกเก็บเท่าที่จำเป็นต่อการให้บริการและการตรวจสอบระบบ.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">สิทธิของผู้ใช้งาน</h2>
            <p className="mt-2">
              ผู้ใช้งานสามารถติดต่อผู้ดูแลระบบเพื่อขอตรวจสอบ แก้ไข ปิดใช้งาน หรือลบข้อมูลบัญชีที่เกี่ยวข้องกับระบบได้ตามความเหมาะสม.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-extrabold text-[#20325c]">ติดต่อเรา</h2>
            <p className="mt-2">
              หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อผู้ดูแลระบบ SMART BASIN ของหน่วยงานผู้รับผิดชอบโครงการ.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
