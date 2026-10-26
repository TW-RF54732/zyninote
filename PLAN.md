# Zyninote 實作計畫

> 給實作者（Claude Code）的規格與分期計畫。所有「已決定」的項目請照做；「預設值」可在實作時調整，但需在 README 註明。

---

## 1. 定位

Zyninote 是一個**課業／學習筆記系統**，形式上是「有結構的筆記網站」：

- 使用者只寫內容（Markdown 為主），導覽、目錄、樣式、功能由系統自動提供
- 需要圖表或互動時，可以直接寫網頁元件（MDX / TSX）
- **人和 AI Agent 都是使用者**：規則要明確、可預測、機器可讀
- 第一階段以**本機個人服務**為主（可讀可寫、功能完整優先），之後再支援 build 成唯讀靜態網站

### 核心原則

1. **`content/` 是唯一的資料來源**。快取全部可刪、可重建，刪除快取不得遺失任何資料。
2. **各格式用自己的語法，統一成同一條管線**。不自創檔案格式。
3. **擴充語法越少越好**，且盡量沿用現有慣例。
4. **內容優先、標註其次、程式碼最後**。

---

## 2. 專案結構

```
root/
├─ content/                  ← 筆記庫（唯一資料來源，可攜）
│  ├─ <subject>/
│  │  ├─ _subject.md         ← 科目首頁、設定、tag 註冊；目錄自動生成在此頁
│  │  ├─ _cheats.json        ← 本科目的 cheat sheet（參照＋順序）
│  │  ├─ ch1-xxx.md
│  │  ├─ ch2-xxx.mdx
│  │  └─ ch3-xxx.tsx
│  ├─ <subject>/ ...
│  └─ _components/           ← 共用互動元件（MDX/TSX 引用）
├─ src/                      ← 系統程式（伺服器、管線、前端）
├─ .zyninote/cache/          ← 快取（加入 .gitignore）
├─ AGENTS.md                 ← 給 AI Agent 的規則說明
├─ README.md
└─ package.json
```

### 結構規則（已決定）

- `content/` 底下**只有一層資料夾**：subject。
- subject 底下的筆記檔**全部平行**，不允許子資料夾、不允許「檔案掛檔案」。
- 底線開頭（`_subject.md`、`_cheats.json`、`_components/`）為系統檔，不視為一般筆記。
- 分類靠 tag，不靠資料夾。
- 目錄生成在 **root 首頁**與 **subject 首頁**（`_subject.md`），不放在一般筆記裡。

---

## 3. 內容模型

### 3.1 筆記 frontmatter

```yaml
---
title: TCP 三次握手
tags: [basic, 傳輸層]
order: 2            # 章節排序（見第 11 節預設值）
summary: 一句話摘要，給目錄、搜尋與 AI 使用
links: visible      # 選填；整頁安靜連結改為永遠顯示
---
```

- `.tsx` 檔以 `export const meta = { ... }` 提供相同欄位。

### 3.2 Tag（已決定）

- **tag 寫在各檔案的 frontmatter**，由檔案自己管理。
- **tag 的範圍限於 subject 內**。不同 subject 的同名 tag 是兩個不同的 tag，沒有全域 tag。
- subject 只負責**註冊**：`_subject.md` frontmatter 的 `tags:` 列出本科目已註冊的 tag。
- 編輯 tag 時提供**自動補全**（只列本 subject 已註冊的 tag）。
- 使用未註冊的 tag 時：**提示後自動註冊**（避免錯字悄悄註冊）。
- 需支援 tag 改名／合併（同步更新本 subject 所有檔案）。

### 3.3 標題 ID

- 每個標題都有 ID：預設由標題文字自動產生 slug（需保留中文，例如使用 github-slugger）。
- 可手動指定：`## TCP Flags {#tcp-flags}`，手動 ID 優先。
- 同頁 ID 重複時自動加後綴並警告。

---

## 4. 語法規格

| 功能 | 語法 | 說明 |
|---|---|---|
| 安靜連結 | `[[path\|顯示文字]]`、`[[path#id\|顯示文字]]` | wikilink；預設外觀同一般文字 |
| 顯眼連結 | `[顯示文字](path)`、`[文字](path#id)` | 標準 Markdown；永遠有連結樣式 |
| 標題屬性 | `## 標題 {#id .fold}` | Pandoc 屬性語法；`.fold` = 預設摺疊 |
| 數學 | `$...$`、`$$...$$` | LaTeX 語法，KaTeX 渲染 |
| 圖表 | ```` ```mermaid ```` 程式碼區塊 | Mermaid 渲染 |
| 互動元件 | MDX 中 `<Component />` | 元件放在 `content/_components/` 或 subject 內 |
| TSX 區塊 | `<Section id title fold>` | TSX 頁面必須用它包住內容，才能進目錄／cheat sheet |
| TSX 連結 | `<Link to="...">` | TSX 頁面的連結必須用它，才能被記錄 |

### 4.1 連結規則

- 路徑一律為**相對路徑**，不做其他限制。
- 解析後路徑**不得超出 `content/`**（例如 `../../src/...`），違反即報錯，不可 leak 出內容根目錄。
- 目標不存在 → 斷鏈警告。
- 渲染時把 `ch2-xxx.md` 這類檔案路徑轉成實際頁面網址（讓原始檔在編輯器可點、網頁上也可點）。

### 4.2 MDX 注意事項

- MDX 的 `{ }` 是 JS 表達式，會與 `{#id .fold}` 衝突。
- 解法：`.mdx` 在交給 MDX 編譯前，先以前處理步驟**抽出標題行末尾的屬性區塊**，再編譯。`.md` 用一般 Markdown 解析器（支援屬性語法），不受影響。
- 確保 `.md` 與 `.mdx` 的標題屬性語法完全相同。

### 4.3 互動元件的文字描述

- 互動元件需能提供一段文字描述（例如 `description` prop 或元件內的說明文字），納入區塊的 `text`，供搜尋與 AI 閱讀。

---

## 5. 統一管線

```
.md  ─┐
.mdx ─┼─→ 渲染成 HTML ─→ 依 <section data-*> 切出區塊 ─→ 區塊索引 ─→ 目錄／搜尋／預覽／cheat sheet／反向連結
.tsx ─┘
```

### 5.1 步驟

1. **解析與渲染**：三種格式各自用對應的工具渲染成 HTML。
   - md／mdx 的標題在渲染時包成 `<section data-id data-level data-title data-fold>`，範圍為該標題到下一個同級或更高級標題之前。
   - tsx 的 `<Section>` 輸出相同的標記。
2. **切段**：只有一份切段程式，從 HTML 依 `section` 標記取得區塊（含巢狀關係）。
3. **建立索引**：

```ts
type Page = {
  path: string;            // 相對 content/ 的路徑
  subject: string;
  format: "md" | "mdx" | "tsx";
  meta: { title; tags; order; summary; links? };
  sections: Section[];
};

type Section = {
  id: string;
  level: number;
  title: string;
  fold: boolean;
  html: string;            // 渲染後內容
  text: string;            // 純文字（含互動元件描述）
  links: LinkRef[];        // 本區塊內的連結
  children: string[];      // 子區塊 id
};
```

### 5.2 快取與更新

- 快取位置：`.zyninote/cache/`，加入 `.gitignore`。
- 快取內容只有推導資料：渲染 HTML、區塊索引、搜尋索引。
- **刪除快取 → 下次啟動重新掃描 `content/` 重建，不得遺失任何資料**（cheat sheet、tag 等都存在 `content/`）。
- 啟動時全量掃描一次；之後監看 `content/`，**只重新處理變動的檔案**並增量更新索引與搜尋索引。
- 前端自動刷新（類似 Vite HMR 的體驗）。

---

## 6. 功能規格

### 6.1 目錄

- 頁面內目錄：由 sections 的 level／title 產生。
- subject 目錄：顯示在 `_subject.md` 頁面，列出本科目所有筆記（依排序）。
- root 目錄：列出所有 subject。
- 側邊導覽、上一頁／下一頁（參考 OneSource 文件站的版面）。

### 6.2 摺疊（`.fold`）

- 有 `.fold` 的標題預設摺疊，其他預設展開；點擊標題切換。
- **不記憶摺疊狀態**，每次載入依語法決定。
- 連結、預覽或 cheat sheet 指向摺疊區塊內的標題時，**自動展開**。

### 6.3 連結與預覽

- **安靜連結**（wikilink）：預設無底線、無顏色；**按住 Ctrl** 時顯示連結樣式。
- **顯眼連結**（標準 Markdown）：永遠顯示連結樣式。
- frontmatter `links: visible`：整頁安靜連結改為永遠顯示。
- **預覽**：按住 Ctrl 並 hover 連結 → 浮動視窗顯示目標內容；目標為標題時只顯示該區塊。
- 點擊連結 → 跳轉。
- **觸控裝置**：點擊連結 → 跳出浮空頁，提供「關閉」與「全螢幕」（全螢幕 = 跳轉）。
- 預覽與 cheat sheet 卡片**共用同一個區塊顯示元件**；含互動元件的區塊需重新啟動元件。

### 6.4 Cheat Sheet（專案重點）

**用途**：閱讀時快速對照常出現但不熟的名詞、代號，避免開分頁或來回切換。

**資料**：每個 subject 一份 `_cheats.json`，只存參照與順序，不存內容副本。

```json
{
  "cards": [
    { "id": "c_8f3a", "ref": "ch2-tcp.md#tcp-flags", "added": "2026-10-26" },
    { "id": "c_91bd", "ref": "ch1-intro.md#osi-七層", "added": "2026-10-26" }
  ]
}
```

- 每張卡片有獨立 `id`（允許同一 ref 重複加入）。
- 陣列順序 = 顯示順序；新增一律放最後，除非使用者拖動。

**卡片**

- 一張卡片 = 一個標題區塊（hN 及其內容，含子標題）。
- 卡片內容於顯示時從索引抓取，原文修改後自動同步。
- 區塊內的 `.fold` 子標題在卡片中維持摺疊。
- 來源被刪或 ID 改變 → 卡片顯示「來源已失效」，可重新指定或移除。

**加入**

- 網頁上每個標題旁有「加入 cheat sheet」按鈕，寫入 `_cheats.json`。
- 若要加入的區塊與既有卡片有包含關係（例如加入 h2，而其底下的 h3 已在 cheat sheet，或反之）→ **跳出提示，但仍允許加入**。

**浮動面板**

- 平常只在畫面邊緣顯示一個 `<`。
- 滑鼠移入 `<`（約 200ms 延遲）→ 展開；移開 → 收起。
- 點擊 `<` → 切換為固定開啟（移開不收起），再點一次取消。
- 面板可捲動，卡片可拖動排序（寫回 `_cheats.json`）。
- 觸控裝置：只用點擊切換。

**模式與篩選**

| 模式 | 顯示內容 |
|---|---|
| `sub` | 本 subject 所有卡片 |
| `local` | 來源為目前頁面的卡片 |
| `advance` | 依勾選的**章節**或**tag** 篩選 |

- tag 篩選依據**來源頁面的 frontmatter tag**（例如三個頁面都有 `basic`，勾選 `basic` 即顯示這三頁的所有卡片）。
- 多選 tag 預設**聯集**，提供切換為交集。
- 篩選後仍依 cheat sheet 原本的順序顯示。

### 6.5 搜尋

- 全文搜尋，以**區塊**為單位建立索引，結果直接跳到該標題。
- 可限定範圍：全部／目前 subject。
- 中文需可正常搜尋（注意斷詞，可用 n-gram 或支援 CJK 的方案）。

### 6.6 反向連結

- 每頁底部列出「連到本頁的筆記」（含連到本頁某標題的區塊）。
- 由索引中所有區塊的 `links` 反查。

### 6.7 連結檢查

- 指令或啟動時檢查：斷鏈、超出 `content/` 的路徑、cheat sheet 失效參照、重複 ID、未註冊 tag。
- 結果顯示在終端與網頁（例如一個問題列表頁）。

---

## 7. 個人服務

- 本機伺服器提供網頁與寫入 API。
- 寫入操作（皆直接寫回 `content/`）：
  - cheat sheet：新增、刪除、排序、重新指定 ref
  - tag：編輯頁面 tag、註冊、改名、合併
  - 筆記：上傳 `.md`、建立新筆記、建立新 subject
- 編輯功能：先支援在網頁上上傳／新增檔案；實際內容編輯可用外部編輯器，存檔即時反映。網頁內編輯器列為後續項目。
- 版本控制：使用者自行 `git init` 與 commit，系統不處理（列入 roadmap）。

---

## 8. AI Agent 支援（本期範圍）

本期只做讓**本機 Agent 直接讀專案**所需的文件：

- `AGENTS.md`：完整規則
  - 資料夾結構與「只有 subject 一層、檔案平行」規則
  - frontmatter 欄位與格式
  - tag 範圍與註冊規則（使用新 tag 前先註冊到 `_subject.md`）
  - 連結只用相對路徑、不得超出 `content/`
  - 標題屬性語法 `{#id .fold}`
  - 何時用 `.md`／`.mdx`／`.tsx`
  - `_cheats.json` 格式
  - 互動元件必須提供文字描述
  - 改完後執行連結檢查
- 一份 Agent skill（以 AGENTS.md 為基礎，說明常見操作流程，例如「把講義整理成筆記放進某科目」）。
- 系統自動輸出全站索引（例如 `.zyninote/index.json` 或 `llms.txt`），Agent 讀一個檔即可掌握全貌。

MCP server 與 CLI 不在本期範圍。

---

## 9. 技術選型（建議，可調整）

- **語言**：TypeScript（Node.js）
- **前端**：React
- **伺服器**：Vite 開發伺服器＋輕量後端（例如 Hono 或 Express）
- **Markdown 管線**：unified／remark／rehype
  - remark-gfm、remark-math＋rehype-katex、wikilink 外掛、標題屬性外掛
- **MDX**：@mdx-js
- **Mermaid**：mermaid（前端渲染）
- **檔案監看**：chokidar
- **搜尋**：MiniSearch 或 FlexSearch（需處理中文）
- **slug**：github-slugger

---

## 10. 分期

### Phase 1：骨架與管線
- 專案結構、`content/` 範例（至少兩個 subject、含 md／mdx／tsx 各一）
- 三種格式渲染 → 統一 section 標記 → 切段 → 區塊索引
- 快取與增量更新、前端自動刷新
- 頁面路由、版面（側邊導覽、頁面內目錄、上一頁／下一頁）
- KaTeX、Mermaid、標題 ID、`.fold`

**驗收**：刪除 `.zyninote/cache/` 後重啟，所有頁面正常；修改任一筆記，網頁一秒內更新。

### Phase 2：連結
- wikilink 與標準連結解析、路徑轉換、邊界檢查
- 安靜／顯眼樣式、Ctrl 顯示、`links: visible`
- Ctrl+hover 預覽、觸控浮空頁
- 反向連結、連結檢查

**驗收**：`../../src` 類路徑報錯；預覽指向摺疊標題時自動展開。

### Phase 3：Cheat Sheet
- `_cheats.json` 讀寫 API
- 標題旁加入按鈕、包含關係提示
- 邊緣 `<` 浮動面板、hover／固定切換、捲動、拖動排序
- sub／local／advance 模式、tag 聯集／交集
- 失效參照處理

**驗收**：刪除快取後 cheat sheet 完整保留；修改原文後卡片同步更新；同一區塊可重複加入。

### Phase 4：Tag 與搜尋
- tag 註冊、自動補全、新 tag 提示、改名／合併
- 全文搜尋（區塊級、可限定 subject、中文可用）

### Phase 5：Agent 文件
- `AGENTS.md`、Agent skill、全站索引輸出
- README（安裝、啟動、語法速查）

---

## 11. 預設值（尚未最終決定，先照此實作）

| 項目 | 預設 | 備註 |
|---|---|---|
| 章節排序 | frontmatter `order`，未填時依檔名排序 | 檔名前綴（`ch1-`）作為備援 |
| 多 tag 篩選 | 聯集 | 提供交集切換 |
| hover 展開延遲 | 200ms | 可設定 |
| 預覽觸發鍵 | Ctrl（macOS 為 Cmd） | |
| 新 tag | 提示後自動註冊 | |

---

## 12. 不在本期範圍（Roadmap）

- MCP server、CLI
- Git 整合（筆記版本控制、自動 commit、還原）
- 以 cheat sheet 為基礎的 subject 專屬學習／複習功能
- 網頁內 Markdown 編輯器
- build 成唯讀靜態網站並部署
- 列印／匯出 PDF（自動展開摺疊）
- cheat sheet 卡片內容快照備援
- 關聯圖（graph view）
