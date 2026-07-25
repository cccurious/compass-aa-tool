const digits = (n: number) => Array.from('０１２３４５６７８９'.repeat(30)).slice(0, n).join('');
// X1: P9 と同構造・語だけ ０×10 に（尻尾も ０×117）
const x1 = '００００００００００ '.repeat(6) + '０'.repeat(117);
// X2: W1 と同構造・語だけ数字ものさしに（尻尾は 60 のまま）
const x2 = '０１２３４５６７８９ '.repeat(9) + digits(60);
console.log('X1:', Array.from(x1).length, '字');
console.log(x1);
console.log('X2:', Array.from(x2).length, '字');
console.log(x2);
