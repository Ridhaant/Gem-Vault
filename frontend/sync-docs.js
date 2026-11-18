import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const docsDir = path.resolve(__dirname, "../docs");

const indexHtmlPath = path.join(docsDir, "index.html");
const notFoundHtmlPath = path.join(docsDir, "404.html");
const nojekyllPath = path.join(docsDir, ".nojekyll");
const assetsDir = path.join(docsDir, "assets");

if (fs.existsSync(indexHtmlPath)) {
  const indexContent = fs.readFileSync(indexHtmlPath, "utf8");
  fs.writeFileSync(notFoundHtmlPath, indexContent, "utf8");
  fs.writeFileSync(nojekyllPath, "", "utf8");

  // Clean stale assets in docs/assets without deleting dynamic imported chunks
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    let combinedReferences = indexContent;
    for (const file of files) {
      if (file.endsWith(".js") || file.endsWith(".css")) {
        try {
          combinedReferences += " " + fs.readFileSync(path.join(assetsDir, file), "utf8");
        } catch {}
      }
    }
    for (const file of files) {
      if (!combinedReferences.includes(file)) {
        try {
          fs.unlinkSync(path.join(assetsDir, file));
          console.log(`✓ Removed stale asset: ${file}`);
        } catch {}
      }
    }
  }

  console.log("✓ Successfully synchronized docs/404.html and docs/.nojekyll");
} else {
  console.error("docs/index.html not found!");
}
