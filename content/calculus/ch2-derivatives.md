---
title: 導數
tags: [公式]
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

$$
(fg)' = f'g + fg'
$$

### 連鎖律 {#chain-rule}

$$
\frac{d}{dx} f(g(x)) = f'(g(x)) \cdot g'(x)
$$

### 常見導數表 {.fold}

| $f(x)$ | $f'(x)$ |
|---|---|
| $x^n$ | $n x^{n-1}$ |
| $e^x$ | $e^x$ |
| $\ln x$ | $1/x$ |
| $\sin x$ | $\cos x$ |
