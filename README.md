# Zyninote

課業／學習筆記系統：在 `content/` 寫 Markdown、MDX 或 TSX，導覽、目錄與樣式由系統提供。完整規格見 [PLAN.md](PLAN.md)。

目前完成 **Phase 1：骨架與管線**、**Phase 2：連結**、**Phase 3：Cheat Sheet**、**Phase 4：Tag 與搜尋**。

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

- 閱讀時，標題旁的 `+`（hover 標題時出現）把該區塊（含子標題）加入本科目的 cheat sheet，寫入 `content/<subject>/_cheats.json`。已加入的標題常駐顯示小勾勾 `✓`，再按一次從 cheat sheet 移除；與既有卡片有包含關係時會先詢問。
- 浮空圓角卡片，停靠在螢幕四個角落之一（預設右下）。收起時整張卡片滑到側邊螢幕外，只露出箭頭長條；滑鼠移入立即滑出，離開卡片 20px 外才收回；點箭頭固定開啟，再點一次取消。觸控裝置只用點擊。
- 箭頭方向跟著停靠側：靠右時收起 `‹`、打開 `›`；靠左時相反（收起 `›`、打開 `‹`），長條也在卡片的內側。
- 拖動卡片頂端標題列的空白處（游標變成手掌）可以移動卡片，放開時對齊最近的角落：右下、右上、左下、左上。
- 拖動內側邊緣調整寬度，拖動上／下緣（遠離角落的那一邊）調整高度；雙擊邊緣恢復預設。位置、寬度、高度都會記住。
- 模式：本科目（sub）、本頁（local）、篩選（advance：點「篩選 ▾」浮出選單，勾選章節或 tag，tag 可切換聯集／交集；有條件時分頁顯示數量，如「篩選 (3)」）。選單浮在卡片上，不會推動排版。篩選後仍維持 cheat sheet 原本的順序。
- 每張卡片的標題列：左側 `⠿`（hover 時出現，拖動排序，滑鼠與觸控皆可，也可按 Alt+↑／↓）、區塊標題（點擊跳轉），右側以小字對齊底部顯示來源章節，最右的 `×` 移除。
- 面板走極簡風格：卡片之間只有一條細分隔線，其他地方不用框線；模式、章節、tag 都是純文字切換。
- 卡片內容在顯示時從索引抓取，原文修改後自動同步；來源被刪或 ID 改變時顯示「來源已失效」，可從本科目的標題重新指定或移除。

```json
{
  "cards": [
    { "id": "c_8f3a", "ref": "ch2-tcp.mdx#tcp-flags", "added": "2026-10-26" }
  ]
}
```

## Tag

- 每篇筆記在 frontmatter（TSX 為 `export const meta`）寫自己的 `tags`；科目的 `_subject.md` 的 `tags:` 是本科目已註冊的 tag。tag 只在科目內有效。
- **編輯筆記的 tag**：hover 筆記標題區，點「編輯 tag」。輸入時只補全本科目已註冊的 tag（↑／↓ 選擇，Enter 或逗號加入，空白時 Backspace 刪掉最後一個）；輸入未註冊的 tag 會先詢問，同意後儲存時一併註冊到 `_subject.md`。按「儲存」才寫檔，Esc 或「取消」放棄。
- **科目頁的 tag 管理**：科目頁工具列的「篩選 ▾」選單底部點「管理 tag…」，開啟對話框。列出已註冊的 tag 與「有人用但未註冊」的 tag，以及用到它的筆記。可以註冊、改名、移除；改名成既有的 tag 名稱即為**合併**（會先確認）。改名、合併、移除會同步改寫本科目所有用到它的筆記與 `_subject.md`。
- 手動寫進筆記但沒註冊的 tag 會列入問題列表。

## 搜尋

- 頁首的搜尋框（`/` 或 Ctrl／Cmd＋K）。以**區塊**為單位：每個標題區塊是一筆，另外每頁的標題、摘要、tag 是一筆。點結果直接跳到該標題（摺疊的會展開）。
- 在科目內時預設只搜本科目，結果清單上方可切換「全部」。
- 空白分開的每個詞都要出現（在區塊標題、內文或所在頁面的標題中）；標題命中排前面，同分依閱讀順序。不分大小寫、全形半形（ＴＣＰ＝tcp）。

## 與 PLAN.md 的偏差與補充決定

- **版面**：只沿用 OneSource 的視覺風格（深色、單色系、細線），不沿用它的排版。所有頁面共用同一個骨架：固定在頂端的 header（側邊欄開關、麵包屑、搜尋）、左欄、主欄；沒有頁尾。
- **全域側邊欄**：負責「全局位置與跳轉」，只到檔案層級（科目 → 筆記），不列標題；目前科目自動展開，其他科目可手動展開。在首頁、科目頁、問題頁預設打開，直接佔左欄；閱讀筆記時預設收起，打開時**覆蓋**左欄的本頁目錄（打開是主動切換注意力，不需要同時看到兩者），點外面或按 Esc 收起。窄螢幕一律是從左滑出的抽屜。快捷鍵 Ctrl/Cmd+B 開關、`/` 聚焦搜尋。每次換頁都回到該頁的預設狀態。
- **章節頁**左欄是**本頁標題**（本頁目錄＋閱讀進度），不是章節列表。
- **Subject 首頁**像一本書的目錄：標題與 summary、「繼續閱讀」一行、tag 篩選列（文字開關，與 cheat sheet 模式列同樣式；「全部」清除，任一符合即顯示，最後是「管理 tag…」），接著每章一段：章名、summary、與本頁目錄同樣式的標題樹，章與章之間用和筆記 h2 相同的細線分隔，不用卡片、不加編號。頁內沒有搜尋框，header 的搜尋在科目頁本來就只搜本科目。`_subject.md` 只讀 frontmatter，內文不顯示（其中的連結仍會被索引、算進反向連結）。「繼續閱讀」記錄每個 subject 最後讀的筆記與畫面頂端的區塊，存在 localStorage，屬於便利功能。
- **首頁**只回答「要去哪」：上面一排「繼續閱讀」（各科目最後讀到的位置，依時間排序，最多 4 個），下面是所有科目的格狀磚（科目名、summary 最多兩行），用滿橫向寬度。章節列表交給科目頁與側邊欄，所以科目或章節再多，首頁的長度也只隨科目數成長。
- **樣式 token**：顏色、字級（最小 14px：14／16／18／20／h2／h1）、圓角（6／12／膠囊）都定義在 `styles.css` 的 `:root`，元件不直接寫色碼或像素字級。
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
- **hover 不延遲**（覆蓋 PLAN.md 預設的 200ms）：移入立即展開；收回改用距離判定，滑鼠離開卡片 20px 外才收回，不用時間延遲。
- **面板狀態**：模式與篩選（每個 subject 分開）、是否固定、停靠角落、寬度與高度，記在瀏覽器的 localStorage；這只是便利功能，不屬於筆記資料。
- **cheat sheet 只是 overlay**：不論是否固定，都不會改變筆記版面。第一次展開前不載入卡片內容。
- **加入按鈕是開關**（偏離 PLAN.md「同一區塊可重複加入」）：已加入的區塊按 `✓` 會移除它的所有卡片，所以從網頁上無法重複加入同一區塊。`_cheats.json` 仍允許同一 ref 出現多次（各有自己的 id），手寫的重複卡片照常顯示。
- **加入按鈕**只出現在正在閱讀的筆記頁（subject 首頁不顯示內文，所以沒有），預覽卡與 cheat sheet 卡片內不會出現。按鈕是前端加到 DOM 上的，不影響索引的 HTML。
- **tag 寫回**：只改寫 `tags` 那一項，其他 frontmatter（含註解、順序）原樣保留；改寫成 `tags: [a, b]` 的形式，需要時加引號。TSX 只能改寫字面值字串陣列（`tags: ["a"]`），寫成變數或展開時會拒絕並請你手動改。一次操作會先算好所有要改的檔案，有任何一個無法改寫就整個取消，不會改一半。
- **沒有 `_subject.md` 的科目**在註冊 tag 時會自動建立一個（只含 title 與 tags）。
- **tag 名稱**前後空白會去掉，不能是空白、不能含換行等控制字元，最多 40 字。
- **新 tag 的詢問**在加入時就跳出；筆記原本就有、但未註冊的 tag，按儲存時會一起詢問。
- **搜尋不用斷詞或 n-gram**（偏離 PLAN.md 建議的 MiniSearch／FlexSearch）：個人筆記的量下，直接對每個區塊做子字串比對就夠快，中文、英文、公式（以 TeX 原文）都能找到，也不會有斷詞錯誤。搜尋資料由記憶體中的區塊即時建立（每次同步後第一次搜尋時），不另外寫入快取。
- **katex 版本**：`package.json` 用 `overrides` 讓 `rehype-katex`、`remark-math`（經 `micromark-extension-math`）都使用頂層的 `katex`，避開舊版 katex 的 audit 警告。不要跑 `npm audit fix --force`：它會把 `remark-math`／`rehype-katex` 退回不支援 MDX 的舊版（`\text{...}` 的大括號會被當成 JS 運算式）。
- **搜尋範圍**：在科目或筆記頁時預設「本科目」，其他頁面搜尋全部。
