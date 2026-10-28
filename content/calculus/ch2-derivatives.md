---
title: 導數
tags: []
summary: 導數定義與基本微分規則
links: visible
---

## 定義

導數是差商的 [[ch1-limits.md#直觀意義|極限]]，嚴格的意義見 [[ch1-limits.md#epsilon-delta|ε-δ 定義]]：

$$
f'(x) = \lim_{h \to 0} \frac{f(x + h) - f(x)}{h}
$$

## 微分規則

### 乘積法則 {#product-rule}

由 [[ch2-derivatives.md#定義|導數的定義]] 展開差商即可推得：

$$
(fg)' = f'g + fg'
$$

### 連鎖律 {#chain-rule}

處理複合函數，常與 [[ch2-derivatives.md#product-rule|乘積法則]] 一起使用：

$$
\frac{d}{dx} f(g(x)) = f'(g(x)) \cdot g'(x)
$$

### 常見導數表 {.fold}

這些結果都可以從 [[ch2-derivatives.md#定義|導數的定義]] 與 [[ch1-limits.md#重要極限|重要極限]] 算出：

| $f(x)$ | $f'(x)$ |
|---|---|
| $x^n$ | $n x^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $\sin x$ | $\cos x$ |
