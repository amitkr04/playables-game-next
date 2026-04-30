const fs = require("fs");
const path = require("path");

const outPath = path.resolve(__dirname, "..", "out", "index.html");
let html = fs.readFileSync(outPath, "utf8");

// 1. Remove SDK tag temporarily
const sdkTag = '<script src="https://www.youtube.com/game_api/v1"></script>';
html = html.replace(sdkTag, "");

// 2. Find first chunk script and add SDK tag before it
const firstChunkScript = html.match(
  /<script src="[^"]*_next\/static\/chunks\/[^"]+" async="">/,
);
if (firstChunkScript) {
  html = html.replace(firstChunkScript[0], `${sdkTag}\n${firstChunkScript[0]}`);
}

// 3. Replace all absolute paths with relative paths
// Replace /_next/ with ./_next/
html = html.replace(/\/_next\//g, "./_next/");

// 4. Replace any ../_next/ back to ./_next/ (normalize)
html = html.replace(/\.\.\/_next\//g, "./_next/");

// 5. Fix favicon path from /favicon.ico to ./favicon.ico (in HTML and serialized data)
html = html.replace(/href="\/favicon\.ico/g, 'href="./favicon.ico');
html = html.replace(
  /\\\"href\\\":\\\"\/favicon\.ico/g,
  '\\"href\\":\\"./favicon.ico',
);

// 6. Fix any other absolute href paths that start with /
html = html.replace(/href="\//g, 'href="./');

// 7. Ensure CSS and JS preload hrefs also use relative paths
html = html.replace(/href="\/_next\//g, 'href="./_next/');

// 8. Fix font paths in serialized data (woff2 files)
html = html.replace(/\/_next\/static\/media\//g, "./_next/static/media/");

fs.writeFileSync(outPath, html, "utf8");

// 9. Fix CSS files - replace absolute paths with relative paths
const cssPath = path.resolve(__dirname, "..", "out", "_next", "static", "css");
if (fs.existsSync(cssPath)) {
  const cssFiles = fs
    .readdirSync(cssPath)
    .filter((file) => file.endsWith(".css"));

  cssFiles.forEach((file) => {
    const filePath = path.join(cssPath, file);
    let css = fs.readFileSync(filePath, "utf8");

    // Replace absolute paths with relative paths in CSS
    css = css.replace(/url\(\/_next\//g, "url(./_next/");

    fs.writeFileSync(filePath, css, "utf8");
  });
}

console.log(
  "✓ Patched out/index.html:",
  "\n  - Ensured SDK script appears before chunk scripts",
  "\n  - Converted all paths to relative (./ prefix)",
  "\n  - Fixed favicon and icon paths",
  "\n  - Normalized inconsistent path patterns",
  "\n✓ Patched CSS files:",
  "\n  - Fixed font and asset paths to be relative",
);
