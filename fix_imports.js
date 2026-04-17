const fs = require("fs");
const path = require("path");

const dirs = [
  "c:/Users/chhab/OneDrive/Desktop/printmaster/src/src/screens",
  "c:/Users/chhab/OneDrive/Desktop/printmaster/src/screens"
];

function ensureImport(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  
  if (content.includes("useFocusEffect(") && !content.includes("useFocusEffect }") && !content.includes("useFocusEffect,") && !content.includes("{ useFocusEffect }")) {
    if (content.includes("@react-navigation/native")) {
      content = content.replace(
        /import\s+\{([^}]+)\}\s+from\s+["']@react-navigation\/native["'];/,
        (match, p1) => `import { ${p1.trim()}, useFocusEffect } from "@react-navigation/native";`
      );
    } else {
      const parts = content.split('\n');
      const lastImport = parts.findLastIndex(p => p.startsWith('import '));
      parts.splice(lastImport + 1, 0, 'import { useFocusEffect } from "@react-navigation/native";');
      content = parts.join('\n');
    }
    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Fixed import in: " + filePath);
  }
}

dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith(".tsx")) {
        ensureImport(path.join(dir, file));
      }
    });
  }
});
