const fs = require("fs");
const path = require("path");

const targetPath = path.join(process.cwd(), "node_modules", "@capacitor", "filesystem", "android", "build.gradle");

if (!fs.existsSync(targetPath)) {
  process.exit(0);
}

const original = fs.readFileSync(targetPath, "utf8");
const updated = original.replace(/jvmToolchain\(21\)/g, "jvmToolchain(17)");

if (updated !== original) {
  fs.writeFileSync(targetPath, updated, "utf8");
}