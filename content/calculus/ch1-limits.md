---
title: 極限
tags: [basic]
summary: 極限的直觀意義與 ε-δ 定義
---

## 直觀意義

當 $x$ 越來越接近 $a$ 時，$f(x)$ 越來越接近 $L$，記作

$$
\lim_{x \to a} f(x) = L
$$

## ε-δ 定義 {#epsilon-delta}

這是把 [[ch1-limits.md#直觀意義|直觀意義]] 中「越來越接近」寫成嚴格的不等式：對任意 $\varepsilon > 0$，存在 $\delta > 0$，使得

$$
0 < |x - a| < \delta \implies |f(x) - L| < \varepsilon
$$

### 證明範例 {.fold}

證明 $\lim_{x \to 2} (3x - 1) = 5$：取 $\delta = \varepsilon / 3$，則

$$
|(3x - 1) - 5| = 3|x - 2| < 3\delta = \varepsilon
$$

## 重要極限

導數本身就是一個極限，見[導數的定義](ch2-derivatives.md#定義)；算導數時會用到的規則見 [[ch2-derivatives.md#微分規則|微分規則]]。這兩個極限的嚴格證明都要靠 [[ch1-limits.md#epsilon-delta|ε-δ 定義]]。

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1, \qquad \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$
