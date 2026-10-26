# Zyninote

課業／學習筆記系統：在 `content/` 寫 Markdown、MDX 或 TSX，導覽、目錄與樣式由系統提供。完整規格見 [PLAN.md](PLAN.md)。

目前完成 **Phase 1：骨架與管線**。

## 啟動

```sh
npm install
npm run dev        # http://localhost:5180/（可用 PORT 環境變數改埠號）
npm test           # 管線單元測試
npm run typecheck
```

## 結構

```
content/<subject>/_subject.md   科目首頁與設定（title、summary、order、tags）
content/<subject>/_cheats.json  cheat sheet（Phase 3）
content/<subject>/*.md|mdx|tsx  筆記，全部平行
content/_components/            共用互動元件
src/pipeline/                   渲染 → <section data-*> → 切段 → 索引、快取
src/server/                     Vite（middleware）＋ Hono API、檔案監看
src/client/                     React 前端
src/runtime/                    筆記可用的元件（import { Section, Interactive } from "zyninote"）
.zyninote/cache/                推導資料，可隨時刪除
```

## 語法速查（Phase 1）

| 功能 | 語法 |
|---|---|
| 標題 ID／預設摺疊 | `## 標題 {#id .fold}`（.md 與 .mdx 相同） |
| 數學 | `$...$`、`$$...$$` |
| 圖表 | ```` ```mermaid ```` |
| MDX 互動元件 | `import X from "../_components/X.tsx"` 後寫 `<X />` |
| TSX 區塊 | `<Section id="..." title="..." fold>`，巢狀深度決定 h2/h3/… |
| 互動元件描述 | 元件輸出包在 `<Interactive description="...">` 中，描述會進入區塊文字 |

TSX 筆記用 `export const meta = { title, tags, order, summary }` 提供 frontmatter，`export default` 為頁面元件。

## 管線

- `.md` 用 unified 渲染；`.mdx`／`.tsx` 走 Vite 的 SSR（`ssrLoadModule` + `renderToString`），所以伺服器建索引時和瀏覽器顯示時用的是同一條 plugin 鏈。
- 三種格式都輸出 `<section class="zn-section" data-id data-level data-title data-fold>`，再由唯一的 `src/pipeline/segment.ts` 切成區塊與目錄。
- 快取：`.zyninote/cache/manifest.json` 記錄每頁的內容雜湊與依賴（MDX/TSX 透過模組圖取得）；命中就重用，不命中才重建。
- 監看 `content/`：變動後只重建受影響的頁面（包含引用了被改元件的頁面），再透過 Vite WebSocket 發出 `zyninote:update`，前端重新抓取資料。

## 與 PLAN.md 的偏差與補充決定

- **版面**：只沿用 OneSource 的視覺風格（深色、單色系、細線），不沿用它的排版。Subject 首頁是詳細目錄，列出每章完整的標題樹；章節頁的側欄是**本頁標題**，不是章節列表。
- **Subject 內的元件**必須以底線開頭（例如 `_Chart.tsx`）；不以底線開頭的 `.tsx` 一律視為筆記。
- **TSX 重複 ID** 只會警告，不會自動加後綴，以免伺服器與瀏覽器渲染結果不同。md／mdx 會自動加 `-1`、`-2` 並警告。
- **排序**：先依 `order`，未填的排在後面，再依檔名自然排序（`ch2` 在 `ch10` 之前）。
- **章節頁第一章的「上一頁」**連回 subject 目錄頁。
- 標題 `.fold` 的展開狀態在同一頁即時更新時保留，換頁或重新載入就回到預設值。
