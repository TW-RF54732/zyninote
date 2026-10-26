// `npm run check`: index content/ once, print every diagnostic (broken links, paths outside content/,
// duplicate ids...) and exit with 1 when any error is found.
import { Indexer } from "../pipeline/indexer.ts";
import { cacheDir, contentDir, createVite, printDiagnostics, root } from "./setup.ts";

const vite = await createVite();
try {
  const indexer = new Indexer({ root, contentDir, cacheDir, vite });
  await indexer.sync();
  const diagnostics = indexer.allDiagnostics();
  printDiagnostics(diagnostics);
  const errors = diagnostics.filter((d) => d.level === "error").length;
  console.log(`[zyninote] 檢查完成：${errors} 個錯誤，${diagnostics.length - errors} 個警告`);
  process.exitCode = errors ? 1 : 0;
} finally {
  await vite.close();
}
