# Method

All calculations are in field units (psia, °R) internally, the units the correlations were published in. SI inputs are converted on entry and results converted back for display.

## 1. Pseudo-critical properties

**Gravity correlations** (γ<sub>g</sub> = gas specific gravity, air = 1):

| Correlation | T<sub>pc</sub> (°R) | P<sub>pc</sub> (psia) |
|---|---|---|
| Sutton (1985) | 169.2 + 349.5γ − 74.0γ² | 756.8 − 131.07γ − 3.6γ² |
| Standing (1977), natural gas | 168 + 325γ − 12.5γ² | 677 + 15γ − 37.5γ² |
| Standing (1977), gas condensate | 187 + 330γ − 71.5γ² | 706 − 51.7γ − 11.1γ² |

**Non-hydrocarbons.** With N₂, CO₂ or H₂S present, the correlation is applied to the hydrocarbon fraction only:

```
γ_HC = (γ_g − Σ y_i M_i / 28.9647) / (1 − Σ y_i)
```

and the result is mixed with the non-hydrocarbons' critical constants by Kay's rule:

```
T'pc = (1 − Σ y_i) Tpc,HC + Σ y_i Tc,i
P'pc = (1 − Σ y_i) Ppc,HC + Σ y_i Pc,i
```

| Component | M | T<sub>c</sub> (°R) | P<sub>c</sub> (psia) |
|---|---|---|---|
| N₂ | 28.013 | 227.16 | 493.1 |
| CO₂ | 44.010 | 547.58 | 1071 |
| H₂S | 34.080 | 672.12 | 1306 |

**Wichert–Aziz correction** for sour gas (A = y<sub>CO₂</sub> + y<sub>H₂S</sub>, B = y<sub>H₂S</sub>):

```
ε    = 120 (A^0.9 − A^1.6) + 15 (B^0.5 − B^4)
T*pc = T'pc − ε
P*pc = P'pc T*pc / (T'pc + B(1 − B) ε)
```

## 2. Pseudo-reduced conditions

```
Tpr = T / Tpc        (T in °R = °F + 459.67)
Ppr = P / Ppc
```

## 3. Z-factor

**Dranchuk–Abou-Kassem (1975)**, the default and the method that draws the chart. With the reduced density ρ<sub>r</sub> = 0.27 P<sub>pr</sub> / (Z T<sub>pr</sub>):

```
Z = 1 + (A1 + A2/Tpr + A3/Tpr³ + A4/Tpr⁴ + A5/Tpr⁵) ρr
      + (A6 + A7/Tpr + A8/Tpr²) ρr²
      − A9 (A7/Tpr + A8/Tpr²) ρr⁵
      + A10 (1 + A11 ρr²) (ρr² / Tpr³) exp(−A11 ρr²)
```

A<sub>1…11</sub> = 0.3265, −1.0700, −0.5339, 0.01569, −0.05165, 0.5475, −0.7361, 0.1844, 0.1056, 0.6134, 0.7210. Solved for ρ<sub>r</sub> by Newton's method from Z = 1, with the analytic derivative. Quoted range: 1.0 ≤ T<sub>pr</sub> ≤ 3.0, 0.2 ≤ P<sub>pr</sub> ≤ 30.

**Hall–Yarborough (1973).** With t = 1/T<sub>pr</sub>, solve for the reduced density y:

```
−A Ppr + (y + y² + y³ − y⁴)/(1 − y)³ − B y² + C y^D = 0
A = 0.06125 t exp(−1.2(1 − t)²)
B = 14.76t − 9.76t² + 4.58t³
C = 90.7t − 242.2t² + 42.4t³
D = 2.18 + 2.82t
Z = A Ppr / y
```

**Brill–Beggs (1974)**, explicit:

```
A = 1.39 (Tpr − 0.92)^0.5 − 0.36 Tpr − 0.101
B = (0.62 − 0.23 Tpr) Ppr + (0.066/(Tpr − 0.86) − 0.037) Ppr² + 0.32 Ppr⁶ / 10^(9(Tpr − 1))
C = 0.132 − 0.32 log10(Tpr)
D = 10^(0.3106 − 0.49 Tpr + 0.1824 Tpr²)
Z = A + (1 − A)/e^B + C Ppr^D
```

**Papay (1968)**, explicit:

```
Z = 1 − 3.53 Ppr / 10^(0.9813 Tpr) + 0.274 Ppr² / 10^(0.8157 Tpr)
```

## 4. Gas properties

```
M_a = 28.9647 γ_g
ρ_g = P M_a / (Z R T)                 R = 10.7316 psia·ft³/(lb-mol·°R)
B_g = 0.02827 Z T / P                 ft³/scf, standard conditions 14.696 psia and 60 °F
c_pr = 1/Ppr − (1/Z)(∂Z/∂Ppr)_Tpr     slope taken numerically from the selected Z method
c_g = c_pr / Ppc
```

**Viscosity, Lee–Gonzalez–Eakin (1966)** (T in °R, ρ<sub>g</sub> in g/cm³, μ<sub>g</sub> in cp):

```
K = (9.4 + 0.02 M_a) T^1.5 / (209 + 19 M_a + T)
X = 3.5 + 986/T + 0.01 M_a
Y = 2.4 − 0.2 X
μ_g = 10⁻⁴ K exp(X ρ_g^Y)
```

## 5. Reading the chart

Hovering reports the T<sub>pr</sub> whose DAK isotherm passes through the cursor, found by scanning T<sub>pr</sub> from 1.05 to 3.0 and refining each sign change by bisection. At high P<sub>pr</sub> the isotherms cross, so a point can lie on two isotherms; both are shown.

## 6. What this is, and what it is not

The curves are not a scan or digitisation of the printed Standing–Katz chart. They are the Dranchuk–Abou-Kassem equation, which was fitted to 1,500 points read from that chart and reproduces it with an average error of about 0.5%. Read the page as "the chart as DAK reproduces it". Very near T<sub>pr</sub> = 1.0 and P<sub>pr</sub> ≈ 1–2, the curves are steepest and every correlation is least accurate.

## 7. Where each equation was checked

The constants were cross-checked against published secondary sources (October 2026). The primary papers were not reproduced here.

| Item | Checked against | Notes |
|---|---|---|
| DAK constants A1–A11, ρ<sub>r</sub> definition, fit to 1,500 chart points | PetroWiki "Real gases"; Springer review in J. Petrol. Explor. Prod. Technol. (s13202-015-0209-3); Juttner (AGH) | One review prints A7 as +0.7361. PetroWiki and Juttner both give −0.7361, which is used here. |
| Hall–Yarborough | Springer review | Exact match |
| Brill–Beggs A, C, D, E/F | Springer review | D uses 0.3106 |
| Brill–Beggs B term, P<sub>pr</sub>⁶ | pychemqt (citing Brill & Beggs 1974 and Kumar 2004) | The Springer review prints P<sub>pr</sub>². The P<sub>pr</sub>⁶ form is used because it is the commonly cited one and it tracks DAK far more closely: at P<sub>pr</sub> = 2, T<sub>pr</sub> = 1.2, DAK gives 0.553, P<sub>pr</sub>⁶ gives 0.566 and P<sub>pr</sub>² gives 0.621. |
| Papay, 3.53 | TIU lecture notes; pychemqt (citing Ahmed 2016) | Earlier versions used 3.52, which is changed by 0.0003 in Z. |
| Sutton | Springer review; PetroWiki (0.57 < γ<sub>g</sub> < 1.68) | Exact match |
| Standing natural gas | KSU PGE 362 notes; TIU notes | One OCR'd copy shows "150" for the 15 coefficient |
| Standing gas condensate | Juttner (AGH) | Juttner describes it as for wet gases, γ<sub>g</sub> > 0.75 |
| Wichert–Aziz ε, T*pc, P*pc | PetroWiki; TIU notes | Exact match |
| Hydrocarbon-fraction gravity and Kay's rule | TIU notes (Whitson–Brulé procedure) | Exact match |
| Lee–Gonzalez–Eakin | TIU notes | Exact match. The 62.4 lb/ft³ to g/cm³ divisor is used as 62.428. LGE is not meant for sour gas. |
| B<sub>g</sub>, ρ<sub>g</sub> | TIU notes | 0.02827 and R = 10.73 are the rounded forms |

## References

1. Standing, M.B. & Katz, D.L. (1942). Density of natural gases. *Trans. AIME* 146, 140–149.
2. Dranchuk, P.M. & Abou-Kassem, J.H. (1975). Calculation of Z factors for natural gases using equations of state. *J. Can. Pet. Tech.* 14(3).
3. Hall, K.R. & Yarborough, L. (1973). A new equation of state for Z-factor calculations. *Oil & Gas Journal*.
4. Brill, J.P. & Beggs, H.D. (1974). *Two-Phase Flow in Pipes*. University of Tulsa.
5. Papay, J. (1968). A termelési technológiai paraméterek változása a gáztelepek művelése során. *OGIL Műszaki Tudományos Közlemények*, Budapest, 267–273.
6. Sutton, R.P. (1985). Compressibility factors for high-molecular-weight reservoir gases. SPE 14265.
7. Standing, M.B. (1977). *Volumetric and Phase Behavior of Oil Field Hydrocarbon Systems*. SPE.
8. Wichert, E. & Aziz, K. (1972). Calculate Z's for sour gases. *Hydrocarbon Processing* 51(5).
9. Lee, A.L., Gonzalez, M.H. & Eakin, B.E. (1966). The viscosity of natural gases. *JPT* 18(8).
