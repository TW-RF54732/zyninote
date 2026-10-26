# Zyninote

課業／學習筆記系統：在 `content/` 寫 Markdown、MDX 或 TSX，導覽、目錄與樣式由系統提供。完整規格見 [PLAN.md](PLAN.md)。

目前完成 **Phase 1：骨架與管線**、**Phase 2：連結**、**Phase 3：Cheat Sheet**。

## 啟動

```sh
npm install
npm run dev        # http://localhost:5180/（可用 PORT 環境變數改埠號）
npm run check      # 連結檢查：列出所有問題，有錯誤時 exit code 為 1
npm test           # 管線單元測試
npm run typecheck
```

## 結構

```
content/<subject>/_subject.md   科目首頁與設定（title、summary、order、tags）
content/<subject>/_cheats.json  cheat sheet（只存卡片參照與順序）
content/<subject>/*.md|mdx|tsx  筆記，全部平行
content/_components/            共用互動元件
src/pipeline/                   渲染 → <section data-*> → 切段 → 索引、快取
src/server/                     Vite（middleware）＋ Hono API、檔案監看
src/client/                     React 前端
src/runtime/                    筆記可用的元件（import { Section, Interactive, Link } from "zyninote"）
src/shared/links.ts             連結解析（管線、TSX <Link>、檢查、前端共用同一份）
.zyninote/cache/                推導資料，可隨時刪除
```

## 語法速查

| 功能 | 語法 |
|---|---|
| 安靜連結 | `[[ch2-tcp.mdx#tcp-flags\|顯示文字]]`；表格內的 `\|` 要寫成 `\\|` |
| 顯眼連結 | `[顯示文字](ch2-tcp.mdx#tcp-flags)` |
| TSX 連結 | `<Link to="ch2-tcp.mdx#tcp-flags">文字</Link>`，加 `quiet` 變成安靜連結 |
| 整頁顯示安靜連結 | frontmatter `links: visible` |
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

## 連結

- 三種格式的內部連結都輸出同一種標記：`<a class="zn-link" data-zn-link="quiet|visible" data-zn-ref="原文路徑" href="頁面網址">`。`.md`／`.mdx` 由 `rehype-links` 產生，TSX 由 `<Link>` 產生；兩者呼叫同一個 `resolveLink`。切段時從這個標記取出每個區塊的 `links`。
- 渲染結果只取決於來源檔本身：目標是否存在不影響輸出。斷鏈、反向連結在每次同步後對整個索引重新計算（`link-check.ts`），所以別頁改名或刪除時，本頁連結會即時標成斷鏈，而本頁不必重建。
- 閱讀時：按住 Ctrl（macOS 為 Cmd）會顯示安靜連結；Ctrl＋hover 顯示預覽卡；觸控裝置點連結會開浮空頁（「全螢幕」＝跳轉）。預覽與之後的 cheat sheet 卡片共用 `BlockView`：它渲染整頁（互動元件會重新啟動），只顯示目標區塊，並展開目標與其上層的摺疊，目標內的 `.fold` 子標題維持摺疊。
- 檢查：啟動時、`npm run check`、網頁的問題列表（`/_problems`，頁首「N 個問題」）。終端機在同步後只列出新出現的連結問題。

## Cheat sheet

- 閱讀時，標題旁的 `+` 把該區塊（含子標題）加入本科目的 cheat sheet，寫入 `content/<subject>/_cheats.json`。同一區塊可以重複加入；與既有卡片有包含關係時會先詢問。
- 畫面右緣的 `‹`：滑鼠移入 200ms 後展開、移開收起；點一下固定開啟，再點一次取消。觸控裝置只用點擊。
- 模式：本科目（sub）、本頁（local）、篩選（advance：勾選章節或 tag，tag 可切換聯集／交集）。篩選後仍維持 cheat sheet 原本的順序。
- 拖動卡片左上的 `⠿` 排序（滑鼠與觸控皆可），或在把手上按 Alt+↑／↓。
- 卡片內容在顯示時從索引抓取，原文修改後自動同步；來源被刪或 ID 改變時顯示「來源已失效」，可從本科目的標題重新指定或移除。

```json
{
  "cards": [
    { "id": "c_8f3a", "ref": "ch2-tcp.mdx#tcp-flags", "added": "2026-10-26" }
  ]
}
```

## 與 PLAN.md 的偏差與補充決定

- **版面**：只沿用 OneSource 的視覺風格（深色、單色系、細線），不沿用它的排版。Subject 首頁是詳細目錄，列出每章完整的標題樹；章節頁的側欄是**本頁標題**，不是章節列表。
- **Subject 內的元件**必須以底線開頭（例如 `_Chart.tsx`）；不以底線開頭的 `.tsx` 一律視為筆記。
- **TSX 重複 ID** 只會警告，不會自動加後綴，以免伺服器與瀏覽器渲染結果不同。md／mdx 會自動加 `-1`、`-2` 並警告。
- **排序**：先依 `order`，未填的排在後面，再依檔名自然排序（`ch2` 在 `ch10` 之前）。
- **章節頁第一章的「上一頁」**連回 subject 目錄頁。
- 標題 `.fold` 的展開狀態在同一頁即時更新時保留，換頁或重新載入就回到預設值。
- **連結路徑**：副檔名可省略（`[[ch2-tcp]]`）。`_subject.md` 或資料夾（`../calculus/`）指向 subject 首頁。非筆記檔（例如 PDF）連到 `/content/...` 並檢查檔案是否存在。外部連結（`https:`、`mailto:`）不處理、不檢查。
- **絕對路徑**（`/computer-network/...`）和超出 `content/` 的路徑一樣視為錯誤：連結停用（沒有 href），並列入問題。
- **沒有 `|` 的 wikilink** 顯示原本寫的路徑。
- **斷鏈一律顯示**成錯誤樣式（虛線、紅色），安靜連結也一樣，方便發現。
- **TSX `<Link>`** 預設是顯眼連結。路徑相對於使用它的筆記，寫在 `_components/` 的共用元件裡也一樣。MDX 裡手寫的 JSX `<a>` 不會被處理，請用 Markdown 連結、wikilink 或 `<Link>`。
- **預覽卡**：hover 120ms 後出現，離開 300ms 後關閉；捲動頁面或按 Esc 也會關閉。預覽卡裡不再開巢狀預覽，但點連結會跳轉。Ctrl＋點擊保留瀏覽器預設行為（開新分頁）。觸控浮空頁裡點連結則會換成新目標。
- **反向連結**不含同一頁內的連結，subject 首頁也會顯示。來源在第一個標題之前的，顯示為「開頭段落」。
- **cheat sheet 的 `ref`** 是從 `_cheats.json` 所在資料夾寫的相對連結，解析規則和筆記連結完全相同（副檔名可省略、不得超出 content/）。必須帶 `#id`：卡片一定是一個標題區塊。失效參照、重複的卡片 id、格式錯誤都列入問題列表。
- **`_cheats.json` 的寫法**：每張卡片一行，方便看 git diff；系統改寫時保留不認得的欄位。檔案不存在等於空的 cheat sheet，第一次加入時建立。JSON 格式錯誤時拒絕所有寫入，不會覆蓋手寫的內容。
- **排序衝突**：排序請求必須列出目前所有卡片，檔案在別處被改過時會拒絕並要求重新整理，不會悄悄丟卡片。
- **面板狀態**：模式與篩選（每個 subject 分開）、是否固定，記在瀏覽器的 localStorage；這只是便利功能，不屬於筆記資料。
- **固定開啟時**，寬螢幕（≥1200px）上頁面會讓出右側空間；窄螢幕則覆蓋在內容上。面板收起時不載入卡片內容。
- **卡片內容**最高 55vh，超過時在卡片內捲動，避免單張卡片佔滿面板、拖動困難。
- **加入按鈕**只出現在正在閱讀的頁面（含 subject 首頁），預覽卡與 cheat sheet 卡片內不會出現。按鈕是前端加到 DOM 上的，不影響索引的 HTML。
- **未註冊 tag** 的檢查在 Phase 4 加入同一個問題列表。
