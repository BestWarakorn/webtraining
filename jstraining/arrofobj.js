const { copyFileSync } = require("node:fs");

const products = [
    { name: "Keyboard", price: 1250, quantity: 2 },
    { name: "Mouse", price: 500, quantity: 3 }
];

let sum=0;
for(const pro of products){
    sum+=pro.price*pro.quantity;
    console.log(`${pro.name} รวม ${pro.price*pro.quantity} บาท`);
}

console.log(`ยอดรวมทั้งหมด ${sum} บาท`)