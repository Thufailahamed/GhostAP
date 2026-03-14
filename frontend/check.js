const fs = require("fs");
const path = require("path");

let out = "";
function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir("src", function (filePath) {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
    const content = fs.readFileSync(filePath, "utf8");
    const buttons = content.match(/<Button[^>]*>/g) || [];
    buttons.forEach((b) => {
      const m = b.match(/className=["']([^"']+)["']/);
      if (m) {
        out += `FILE: ${filePath}\nCLASSES: ${m[1]}\n\n`;
      }
    });
  }
});

fs.writeFileSync("check_buttons.json", JSON.stringify({ out }), "utf8");
