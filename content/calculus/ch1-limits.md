---
title: 極限
tags: [basic, 定義]
summary: 極限的直觀意義與 ε-δ 定義
---

## 直觀意義

當 $x$ 越來越接近 $a$ 時，$f(x)$ 越來越接近 $L$，記作

$$
\lim_{x \to a} f(x) = L
$$

## ε-δ 定義 {#epsilon-delta}

對任意 $\varepsilon > 0$，存在 $\delta > 0$，使得

$$
0 < |x - a| < \delta \implies |f(x) - L| < \varepsilon
$$

### 證明範例 {.fold}

證明 $\lim_{x \to 2} (3x - 1) = 5$：取 $\delta = \varepsilon / 3$，則

$$
|(3x - 1) - 5| = 3|x - 2| < 3\delta = \varepsilon
$$

## 重要極限

$$
\lim_{x \to 0} \frac{\sin x}{x} = 1, \qquad \lim_{n \to \infty} \left(1 + \frac{1}{n}\right)^n = e
$$
