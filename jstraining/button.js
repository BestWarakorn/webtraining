// เลือกปุ่มและข้อความจาก id ใน index.html
const helloButton = document.getElementById("helloButton");
const message = document.getElementById("message");

// โค้ดในฟังก์ชันนี้จะทำงานเมื่อกดปุ่ม
helloButton.addEventListener("click", function () {
  // เรียกฟังก์ชันจาก input.js เพื่ออ่านข้อความในช่องกรอก
  const inputText = getInputText();
  message.textContent = inputText || "กรุณากรอกข้อความก่อนครับ";
});
