const fs = require("node:fs");
const input = fs.readFileSync(0, "utf8").trim();

const numbers = input.split(/\s+/).map(Number);
const n = numbers[0];
let sum=0;

for(let i=1;i<=n;i++){
    sum+=numbers[i];
}

console.log(`รวม ${sum} บาท`)