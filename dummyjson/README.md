# DummyJSON + Supabase

เว็บทดลองบนเครื่อง: Node.js 22+ (เครื่องนี้มีแล้ว) ไม่ต้อง npm install

## ตั้งค่าครั้งแรก
1. เปิด Supabase project > SQL Editor > New query คัดลอก schema.sql ทั้งไฟล์แล้วกด Run
2. คัดลอก .env.example เป็น .env
3. เปิด Settings > API Keys แล้วคัดลอก Secret key (sb_secret_...) ใส่ SUPABASE_SECRET_KEY ใน .env ห้ามใส่ใน script.js หรือส่งลง Git
4. ในโฟลเดอร์นี้รัน `npm start` แล้วเปิด http://localhost:3000

Project URL ตั้งไว้แล้ว: https://kgqdkllladfhibxjhslo.supabase.co
ถ้าเปลี่ยน .env ต้องหยุดเซิร์ฟเวอร์ด้วย Ctrl+C แล้ว npm start ใหม่

## ทดลอง
เพิ่มสินค้าลงตะกร้า > ปรับจำนวน > กรอกข้อมูลผู้รับทดสอบ > ยืนยันสั่งซื้อ
ดูข้อมูลใน Supabase Table Editor: orders และ order_items หรือโหลดประวัติบนเว็บ
ราคาหน้าเว็บเป็นราคาประมาณ Backend อ่านราคาปัจจุบันจาก DummyJSON ใหม่ก่อนบันทึก ไม่มีส่วนลด ค่าจัดส่ง หรือการรับเงินจริง
ตะกร้าเก็บใน localStorage ประวัติคำสั่งซื้อเก็บใน Supabase

## โครงสร้าง
- index.html / style.css / script.js: หน้าเว็บ
- server.mjs: Backend ด้วย Node.js built-in modules รับคำสั่งซื้อ ตรวจข้อมูลและราคา
- schema.sql: ตารางพร้อม RLS และ function สำหรับ transaction และป้องกัน request_id ซ้ำ
- .env: ค่าลับบนเครื่อง (ไม่ถูกเสิร์ฟให้เบราว์เซอร์)

Backend ฟังเฉพาะ 127.0.0.1 และไม่มีระบบสมาชิก ประวัติแสดง 20 คำสั่งซื้อล่าสุดของโปรเจกต์นี้ เหมาะกับทดลองส่วนตัวบนเครื่อง อย่าเปิดเซิร์ฟเวอร์นี้สู่สาธารณะก่อนเพิ่มการยืนยันตัวตนและสิทธิ์ของเจ้าของคำสั่งซื้อ

## ระบบสมาชิก (Supabase Auth)
1. รัน migration-users.sql ใน SQL Editor หลัง schema.sql
2. Authentication > URL Configuration: Site URL = http://localhost:3000 และเพิ่ม Redirect URL http://localhost:3000/account.html
3. Authentication > Sign In / Providers เปิด Email provider และคงการยืนยันอีเมลไว้
4. npm start แล้วเปิด /account.html เพื่อสมัครสมาชิก ยืนยันผ่านอีเมล แล้วเข้าสู่ระบบ
รหัสผ่านจัดเก็บโดย Supabase Auth ไม่มีตาราง password ในแอป Backend ตรวจผู้ใช้กับ Supabase ทุกคำขอ และใช้ HttpOnly cookies สำหรับ session
คำสั่งซื้อเดิมก่อนมีระบบสมาชิกยังอยู่ในตาราง แต่ user_id เป็น null จึงไม่ถูกนำไปแสดงให้บัญชีใหม่
เซิร์ฟเวอร์นี้ยังสำหรับ localhost เท่านั้น หาก deploy ต้องใช้ HTTPS และ Secure cookies พร้อมมาตรการจำกัดคำขอ
