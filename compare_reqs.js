const fs = require('fs');
let d1, d2;
try {
  d1 = JSON.parse(fs.readFileSync('9527.json', 'utf8'));
  d2 = JSON.parse(fs.readFileSync('9528.json', 'utf8'));
} catch (e) {
  console.error("Parse error:", e);
  process.exit(1);
}

function compare(obj1, obj2, path = '') {
  if (typeof obj1 !== typeof obj2) return `Type diff at ${path}: ${typeof obj1} vs ${typeof obj2}`;
  
  if (typeof obj1 === 'object' && obj1 !== null) {
    if (Array.isArray(obj1)) {
      if (obj1.length !== obj2.length) console.log(`Array length diff at ${path}: ${obj1.length} vs ${obj2.length}`);
      for (let i = 0; i < Math.min(obj1.length, obj2.length); i++) {
        let diff = compare(obj1[i], obj2[i], `${path}[${i}]`);
        if (diff) return diff;
      }
      if (obj1.length !== obj2.length) return `Array length differs after identical prefix at ${path}`;
    } else {
      const keys1 = Object.keys(obj1);
      const keys2 = Object.keys(obj2);
      for (let k of keys1) {
        let diff = compare(obj1[k], obj2[k], path ? `${path}.${k}` : k);
        if (diff) return diff;
      }
    }
  } else {
    if (obj1 !== obj2) {
      return `Value diff at ${path}:\n9527: ${String(obj1).substring(0, 100)}...\n9528: ${String(obj2).substring(0, 100)}...`;
    }
  }
  return null;
}

console.log(compare(d1, d2));
