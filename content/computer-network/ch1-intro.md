---
title: 網路概論
tags: [basic]
order: 1
summary: 分層模型、封裝與傳輸延遲
---

## OSI 七層 {#osi-七層}

OSI 模型把網路通訊拆成七層，每層只依賴下一層提供的服務。

| 層 | 名稱 | 例子 |
|---|---|---|
| 7 | 應用層 | HTTP、DNS |
| 4 | 傳輸層 | TCP、UDP |
| 3 | 網路層 | IP |
| 2 | 資料鏈結層 | Ethernet |

### 封裝

資料往下傳時，每一層都在前面加上自己的標頭：

```mermaid
graph LR
  A[應用資料] --> B[TCP 區段]
  B --> C[IP 封包]
  C --> D[Ethernet 訊框]
```

### 各層記憶法 {.fold}

「All People Seem To Need Data Processing」由上而下對應第 7 層到第 1 層。

## 延遲

一個封包的總延遲是四種延遲的和：

$$
d_{\text{nodal}} = d_{\text{proc}} + d_{\text{queue}} + d_{\text{trans}} + d_{\text{prop}}
$$

### 傳輸延遲

長度 $L$ 位元的封包在速率 $R$ 的鏈路上，傳輸延遲為 $L / R$。

### 傳播延遲

距離 $d$、傳播速率 $s$ 時，傳播延遲為 $d / s$。

## 例子

本節示範重複標題：兩個「例子」會得到不同的 ID。

## 例子

第二個「例子」的 ID 會自動加上 `-1` 後綴。
