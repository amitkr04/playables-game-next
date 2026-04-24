const fs = require("fs");
const path = require("path");

const outPath = path.resolve(__dirname, "..", "out", "index.html");
let html = fs.readFileSync(outPath, "utf8");

const sdkTag = '<script src="https://www.youtube.com/game_api/v1"></script>';
html = html.replace(sdkTag, "");

const firstChunkScript = html.match(
  /<script src="\/_next\/static\/chunks\/[^"]+" async="">/,
);
if (firstChunkScript) {
  html = html.replace(firstChunkScript[0], `${sdkTag}\n${firstChunkScript[0]}`);
}

fs.writeFileSync(outPath, html, "utf8");
console.log(
  "Patched out/index.html to ensure SDK script appears before chunk scripts.",
);
