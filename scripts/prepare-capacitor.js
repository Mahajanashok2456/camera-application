import fs from "node:fs";
import path from "node:path";

const publicDir = path.resolve(process.cwd(), ".output/public");
const assetsDir = path.join(publicDir, "assets");

if (!fs.existsSync(assetsDir)) {
  console.error("No assets directory found in .output/public. Please run build first.");
  process.exit(1);
}

const files = fs.readdirSync(assetsDir);
const mainCss = files.find((f) => f.startsWith("styles-") && f.endsWith(".css"));
const mainJs = files.find((f) => f.startsWith("index-") && f.endsWith(".js"));

if (!mainCss || !mainJs) {
  console.error("Could not find main CSS or JS bundle in .output/public/assets");
  process.exit(1);
}

const htmlContent = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
    <title>Vintage Camera</title>
    <meta name="theme-color" content="#221f1c" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <link rel="stylesheet" href="./assets/${mainCss}" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="icon" href="./favicon.png" type="image/png" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600&family=Barlow:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" />
  </head>
  <body class="bg-background text-foreground">
    <div id="root"></div>
    <script type="module" src="./assets/${mainJs}"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(publicDir, "index.html"), htmlContent, "utf8");
console.log("Successfully generated .output/public/index.html for native Capacitor runtime.");
