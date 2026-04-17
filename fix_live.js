const fs = require("fs");
const path = require("path");

const dirs = [
  "c:/Users/chhab/OneDrive/Desktop/printmaster/src/src/screens",
  "c:/Users/chhab/OneDrive/Desktop/printmaster/src/screens"
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, "utf-8");
  
  // Find useEffect calls that just call load()
  // pattern: useEffect(() => {\n    load();\n  }, [load]);
  const effectPattern1 = /useEffect\(\(\) => \{\s*load\(\);\s*\}, \[load\]\);/g;
  const effectPattern2 = /useEffect\(\(\) => \{\s*load\(\);\s*\},\s+\[load\]\)/g;
  
  let modified = false;

  // Replace hook usage
  if (effectPattern1.test(content) || effectPattern2.test(content) || content.includes("useEffect(() => { load(); }, [load]);")) {
    content = content.replace(/useEffect\(\(\) => \{\s*load\(\);\s*\}, \[load\]\);/g, "useFocusEffect(useCallback(() => { load(); }, [load]));");
    content = content.replace(/useEffect\(\(\) => \{ load\(\); \}, \[load\]\);/g, "useFocusEffect(useCallback(() => { load(); }, [load]));");
    modified = true;
  }

  if (modified) {
    // Ensure useFocusEffect is imported
    if (!content.includes("useFocusEffect")) {
      if (content.includes('@react-navigation/native"')) {
        content = content.replace(
          /import \{([^}]+)\} from "@react-navigation\/native";/,
          (match, p1) => `import {${p1}, useFocusEffect } from "@react-navigation/native";`
        );
      } else {
        // Find last import
        const lastImportIndex = content.lastIndexOf("import ");
        const endOfImport = content.indexOf("\n", lastImportIndex);
        content = content.substring(0, endOfImport) + '\nimport { useFocusEffect } from "@react-navigation/native";' + content.substring(endOfImport);
      }
    }
    
    // Ensure useCallback is imported if accidentally missing (though usually there)
    if (!content.includes("useCallback")) {
        content = content.replace(/import React, \{([^}]+)\} from "react";/, "import React, { useCallback, $1 } from \"react\";");
    }

    fs.writeFileSync(filePath, content, "utf-8");
    console.log("Updated: " + filePath);
  }
}

dirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      if (file.endsWith(".tsx")) {
        processFile(path.join(dir, file));
      }
    });
  }
});
