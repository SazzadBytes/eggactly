# 🥚 Eggactly

**Anyone can boil an egg. Boiling a perfect one is rocket science.**

Eggactly works out exactly how long to boil your eggs, using physics instead of guesswork.

1. Pick your yolk: **Soft**, **Half** (jammy) or **Hard**
2. Tell it about your eggs: size, how many, fridge or room temperature
3. Set the water amount and your altitude
4. Choose the flame: low, medium or high
5. Watch the calculation, then start the built-in timer

## The math

- **Boiling point** drops about 1 °C per 300 m of altitude.
- **Base time** comes from Charles Williams' egg equation (heat conduction into a sphere):
  `t = 0.451 · M^(2/3) · ln[0.76 · (T_water − T_egg) / (T_water − T_yolk)]` (minutes, M in grams)
- **Thermal shock**: cold eggs cool the water by `ΔT = C_eggs·(T_w − T_0) / (C_water + C_eggs)`.
- **Flame recovery**: the stove (at ~45% efficiency) needs `E / P` seconds to win that heat back; the eggs cook at roughly half speed during that window.

Plain HTML, CSS and JavaScript — no build step. Hosted on GitHub Pages.
