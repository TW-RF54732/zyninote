# Zyninote 語法參考

三種格式最後都會變成同一種區塊結構（`<section data-id data-level data-title data-fold>`），所以標題、連結、摺疊在三種格式裡的效果完全相同，只是寫法不同。

## 目錄

1. Markdown（.md）
2. MDX（.mdx）與它的陷阱
3. TSX（.tsx）筆記
4. 互動元件
5. 連結細節
6. `_subject.md`
7. `_cheats.json`

---

## 1. Markdown（.md）

```md
---
title: 網路概論
summary: 分層模型、封裝與傳輸延遲
order: 1
tags: [basic]
---

## OSI 七層 {#osi-layers}

說明文字。傳輸層見 [[ch2-tcp#three-way-handshake|三次握手]]。

| 層 | 名稱 |
|---|---|
| 4 | 傳輸層，見 [[ch2-tcp#tcp-flags\|旗標]] |

### 各層記憶法 {.fold}

### 封裝 {#encapsulation .fold}

```mermaid
graph LR
  A[應用資料] --> B[TCP 區段] --> C[IP 封包]
```

$$
d_{\text{nodal}} = d_{\text{proc}} + d_{\text{queue}} + d_{\text{trans}} + d_{\text{prop}}
$$
```

- 標題屬性放在標題最後：`{#id}`、`{.fold}`、`{#id .fold}`。
- 沒寫 `{#id}` 時，ID 由標題文字產生（github-slugger：轉小寫、去標點、空白變 `-`，中文保留）。例如「例子：傳輸延遲」→ `例子傳輸延遲`。會被連結的標題請寫明確 ID。
- 同一頁重複的 ID 會自動加 `-1`、`-2` 並警告。不要依賴這個行為。
- **表格裡的 wikilink**，`|` 要寫成 `\|`，否則會被當成欄位分隔。
- GFM（表格、刪除線、任務清單）、`$...$`、`$$...$$`、```` ```mermaid ```` 都支援。

## 2. MDX（.mdx）

frontmatter 和標題屬性的寫法與 `.md` 相同（系統會預先處理 `{#id .fold}`，不會被當成 JS）。

```mdx
---
title: TCP
summary: 連線建立、旗標與可靠傳輸
order: 2
tags: [傳輸層]
---

import HandshakeStepper from "../_components/HandshakeStepper.tsx";

## 三次握手 {#three-way-handshake}

<HandshakeStepper />
```

### MDX 陷阱（重要）

MDX 的內文是 JSX，不是純 Markdown：

| 寫法 | 結果 | 改成 |
|---|---|---|
| `集合 {1,2}` | **不報錯，默默顯示成「2」**（`{}` 被當成 JS 運算式） | `\{1,2\}` 或放進數學 `$\{1,2\}$` |
| `若 x<y 則` | 渲染失敗（`<` 被當成 JSX 標籤開頭） | `$x<y$` 或 `x &lt; y` |
| `<!-- 註解 -->` | 語法錯誤 | `{/* 註解 */}` |
| 手寫 `<a href="...">` | 不會被當成筆記連結處理 | 用 Markdown 連結、wikilink 或 `<Link>` |

數學區塊（`$...$`、`$$...$$`）與程式碼區塊裡的 `{}`、`<` 都安全。所以寫 `.mdx` 時：大括號和小於號只出現在數學或程式碼裡。

如果一篇筆記不需要元件，就用 `.md`，不必承擔這些陷阱。

## 3. TSX（.tsx）筆記

```tsx
import { Link, Section } from "zyninote";
import Chart from "../_components/Chart.tsx";

export const meta = {
  title: "路由",
  summary: "距離向量與鏈結狀態演算法",
  order: 3,
  tags: ["網路層"],
};

export default function Routing() {
  return (
    <>
      <p>
        路由屬於 <Link to="ch1-intro#osi-layers" quiet>網路層</Link> 的工作。
      </p>

      <Section id="link-state" title="鏈結狀態">
        <p>每個路由器知道整個拓撲。</p>
        <Section id="dijkstra" title="Dijkstra 步驟" fold>
          <ol><li>…</li></ol>
        </Section>
      </Section>
    </>
  );
}
```

- `<Section id title fold>`：最外層是 h2，巢狀一層加一級。`id` 必填，請寫明確的英文 ID。TSX 的重複 ID **不會**自動改名，只警告。
- `<Link to="..." quiet>`：預設是顯眼連結，加 `quiet` 變安靜連結。路徑相對於這篇筆記。
- `meta.tags` 用字串陣列字面值，不要用變數或展開。
- 可以用 React hooks、`map` 產生區塊等，但所有可見的標題都要用 `<Section>`，不要直接寫 `<h2>`，否則不會進目錄、搜尋和小抄。
- 數學在 TSX 裡沒有 `$...$` 語法；需要公式時考慮改用 `.mdx`。

## 4. 互動元件

```tsx
// <vault>/_components/Stepper.tsx（共用），或 <vault>/<subject>/_Stepper.tsx（科目專用，底線開頭）
import { useState } from "react";
import { Interactive } from "zyninote";

/** 一行說明元件用途。 */
export default function Stepper() {
  const [step, setStep] = useState(0);
  return (
    <Interactive description="TCP 三次握手逐步示範：1. Client 送 SYN（seq=x）；2. Server 回 SYN+ACK（seq=y, ack=x+1）；3. Client 回 ACK（ack=y+1）後連線建立。">
      <div>…</div>
    </Interactive>
  );
}
```

- **每個互動元件的輸出都必須包在 `<Interactive description="...">` 裡。** 搜尋、小抄和 AI 讀者看不到畫面，只看得到這段描述。描述要把元件呈現的**知識內容**完整寫出來（步驟、數值、結論），而不是「一個互動示範」。
- 引用路徑：科目內筆記引用共用元件是 `../_components/X.tsx`；科目專用元件是 `./_X.tsx`。
- 可以 import `react` 和 app 已安裝的套件；不要假設其他 npm 套件存在。
- 樣式：用 `className`，類名加上獨特前綴（例如 `demo-stepper-`），避免和 app 樣式衝突。不要寫死顏色，優先用 app 的 CSS 變數（`var(--...)`），或不設定顏色讓它繼承。
- 元件改了之後，所有引用它的頁面都會重建。

## 5. 連結細節

| 寫法 | 說明 |
|---|---|
| `[[ch2-tcp#tcp-flags\|顯示文字]]` | 安靜連結（`.md`／`.mdx`）。沒有 `\|顯示文字` 時顯示路徑本身 |
| `[顯示文字](ch2-tcp.mdx#tcp-flags)` | 顯眼連結 |
| `<Link to="..." quiet>` | TSX |
| `ch2-tcp`、`ch2-tcp.mdx` | 副檔名可省略 |
| `#tcp-flags` | 同一頁的標題 |
| `../calculus/ch1-limits#epsilon-delta` | 其他科目 |
| `../calculus/` 或 `_subject.md` | 科目首頁 |
| `figure.png`、`slides.pdf` | 附件（放在同一科目資料夾），會檢查檔案是否存在 |
| `https://...` | 外部連結，不處理不檢查 |

錯誤：以 `/` 開頭的絕對路徑、`..` 超出 vault，都會被停用並列為錯誤。

圖片：app 目前只改寫 `<a>` 連結，不改寫 `<img>` 的路徑，所以 `![說明](figure.png)` 這種相對路徑圖片可能顯示不出來。需要放圖時先告訴使用者這個限制，優先用 Mermaid、表格或文字描述取代。

## 6. `_subject.md`

```md
---
title: 計算機網路
summary: 從 OSI 模型到 TCP 與路由的課堂筆記
order: 1
tags: [basic, 傳輸層, 網路層]
---
```

只讀 frontmatter，內文不會顯示（裡面的連結仍會被索引）。`tags` 是本科目的 tag 註冊表。tag 名稱最多 40 字，不能含換行。

## 7. `_cheats.json`

一般不要動，小抄由使用者在 app 裡挑選。只有在搬移、拆分筆記導致卡片參照失效時才更新 `ref`。

```json
{
  "cards": [
    { "id": "c_8f3a", "ref": "ch2-tcp.mdx#tcp-flags", "added": "2026-10-26" }
  ]
}
```

- 每張卡片一行。`ref` 是相對於科目資料夾的連結，**必須**帶 `#id`（卡片一定是一個標題區塊）。
- 保留不認得的欄位；`id` 不可重複。
