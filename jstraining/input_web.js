// เลือกช่องกรอกข้อความจาก id ใน index.html
const textInput = document.getElementById("textInput");

// อ่านค่าปัจจุบันเมื่อเรียกใช้ และตัดช่องว่างหัวท้าย
function getInputText() {
  return textInput.value.trim();
}
