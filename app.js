/* Eggactly — boil the perfect egg with math.
 * Core model: Charles D. H. Williams' egg-boiling equation (heat conduction in a sphere),
 * plus a correction for the temperature drop when cold eggs hit the water and the time the
 * flame needs to bring it back up.
 */
(() => {
  "use strict";

  // ---------- Data ----------
  const DONENESS = {
    soft: { label: "Soft", yolk: 64, desc: "runny" },
    half: { label: "Half", yolk: 70, desc: "jammy" },
    hard: { label: "Hard", yolk: 80, desc: "fully set" },
  };
  const SIZES = { S: 48, M: 55, L: 63, XL: 73 };
  const START = { fridge: 4, room: 20 };
  const FLAME = {
    low: { label: "Low", kw: 1.2, drop: 5, desc: "gentle simmer" },
    medium: { label: "Medium", kw: 2.0, drop: 1, desc: "steady boil" },
    high: { label: "High", kw: 2.8, drop: 0, desc: "rolling boil" },
  };
  const C_EGG = 3.7;      // J/(g·K) specific heat of egg
  const C_WATER = 4.186;  // J/(g·K) specific heat of water
  const EFFICIENCY = 0.45; // share of stove power that actually reaches the water
  const WILLIAMS_K = 0.451; // minutes per g^(2/3) — from c, ρ, k of egg

  const state = {
    screen: 0,
    done: null,
    size: "L",
    count: 2,
    start: "fridge",
    water: 1.5,
    altitude: 0,
    flame: null,
    result: null,
  };

  // Restore last-used settings (per-browser convenience only).
  try {
    const saved = JSON.parse(localStorage.getItem("eggactly") || "{}");
    ["size", "count", "start", "water", "altitude"].forEach((k) => {
      if (saved[k] !== undefined) state[k] = saved[k];
    });
  } catch (_) {}
  const persist = () => {
    try {
      const { size, count, start, water, altitude } = state;
      localStorage.setItem("eggactly", JSON.stringify({ size, count, start, water, altitude }));
    } catch (_) {}
  };

  // ---------- Helpers ----------
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fx = (n, d = 1) => Number(n).toFixed(d);
  const fmtTime = (s) => {
    s = Math.max(0, Math.round(s));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- Navigation ----------
  const screens = $$(".screen");
  const topbar = $("#topbar");
  const progressBar = $("#progressBar");

  function go(n, back = false) {
    if (state.screen === 6 && n !== 6) stopTimer(true);
    state.screen = n;
    screens.forEach((s) => {
      const on = Number(s.dataset.screen) === n;
      s.classList.toggle("active", on);
      s.classList.toggle("back", on && back);
    });
    topbar.hidden = n === 0;
    progressBar.style.width = `${Math.min(n, 4) * 25}%`;
    window.scrollTo(0, 0);
    if (n === 5) runCalculation();
    if (n === 6) showResult();
  }

  $("#backBtn").addEventListener("click", () => {
    const target = state.screen === 6 ? 4 : state.screen - 1;
    go(Math.max(0, target), true);
  });
  $$("[data-next]").forEach((b) => b.addEventListener("click", () => go(state.screen + 1)));

  // ---------- Step 1: doneness ----------
  $$("[data-done]").forEach((card) =>
    card.addEventListener("click", () => {
      state.done = card.dataset.done;
      selectIn("[data-done]", card);
      setTimeout(() => go(2), 280);
    })
  );

  function selectIn(selector, chosen) {
    $$(selector).forEach((el) => {
      const on = el === chosen;
      el.classList.toggle("selected", on);
      if (el.hasAttribute("role")) el.setAttribute("aria-checked", on);
    });
  }

  // ---------- Step 2: eggs ----------
  function renderEggs() {
    $$("#sizeSeg button").forEach((b) => b.classList.toggle("selected", b.dataset.size === state.size));
    $$("#startSeg button").forEach((b) => b.classList.toggle("selected", b.dataset.start === state.start));
    $("#countVal").textContent = state.count;
    $("#countEggs").textContent = state.count === 1 ? "egg" : "eggs";
    $("#countMinus").disabled = state.count <= 1;
    $("#countPlus").disabled = state.count >= 12;
    const row = $("#eggRow");
    while (row.children.length < state.count) row.appendChild(document.createElement("i"));
    while (row.children.length > state.count) row.lastChild.remove();
  }
  $$("#sizeSeg button").forEach((b) => b.addEventListener("click", () => { state.size = b.dataset.size; renderEggs(); persist(); }));
  $$("#startSeg button").forEach((b) => b.addEventListener("click", () => { state.start = b.dataset.start; renderEggs(); persist(); }));
  $("#countMinus").addEventListener("click", () => { state.count = Math.max(1, state.count - 1); renderEggs(); renderPot(); persist(); });
  $("#countPlus").addEventListener("click", () => { state.count = Math.min(12, state.count + 1); renderEggs(); renderPot(); persist(); });

  // ---------- Step 3: water ----------
  const waterRange = $("#waterRange");
  const altRange = $("#altRange");

  function paintRange(r) {
    const p = ((r.value - r.min) / (r.max - r.min)) * 100;
    r.style.setProperty("--p", `${p}%`);
  }

  function renderPot() {
    const bottom = 175, maxH = 135;
    const h = (state.water / 5) * maxH;
    const top = bottom - h;
    ["#waterRect", "#waterTop"].forEach((id) => {
      const el = $(id);
      el.setAttribute("y", top);
      el.setAttribute("height", h + 5);
    });
    $("#waterTop").setAttribute("height", 4);

    // Eggs sitting on the bottom of the pot, up to 6 per row.
    const g = $("#potEggs");
    g.innerHTML = "";
    const perRow = 6, rx = 9, ry = 11, gap = 24;
    let eggsTop = bottom;
    for (let i = 0; i < state.count; i++) {
      const row = Math.floor(i / perRow);
      const inRow = Math.min(perRow, state.count - row * perRow);
      const col = i % perRow;
      const cx = 130 - ((inRow - 1) * gap) / 2 + col * gap + (row % 2 ? 6 : 0);
      const cy = bottom - 3 - ry - row * (ry * 2 - 4);
      eggsTop = Math.min(eggsTop, cy - ry);
      const e = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      e.setAttribute("cx", cx); e.setAttribute("cy", cy);
      e.setAttribute("rx", rx); e.setAttribute("ry", ry);
      e.setAttribute("fill", "#F09E6F");
      e.setAttribute("stroke", "#D9805A"); e.setAttribute("stroke-width", "1.5");
      g.appendChild(e);
    }
    $("#coverWarn").hidden = top < eggsTop - 4;

    $("#waterVal").textContent = fx(state.water, 1);
    $("#altVal").textContent = `${state.altitude.toLocaleString()} m`;
    $("#bpVal").textContent = `boils at ${fx(boilingPoint(state.altitude))} °C`;
    waterRange.value = state.water;
    altRange.value = state.altitude;
    paintRange(waterRange); paintRange(altRange);
  }
  waterRange.addEventListener("input", () => { state.water = Number(waterRange.value); renderPot(); persist(); });
  altRange.addEventListener("input", () => { state.altitude = Number(altRange.value); renderPot(); persist(); });

  // ---------- Step 4: flame ----------
  $$("[data-flame]").forEach((card) =>
    card.addEventListener("click", () => {
      state.flame = card.dataset.flame;
      selectIn("[data-flame]", card);
      setTimeout(() => go(5), 280);
    })
  );

  // ---------- The math ----------
  function boilingPoint(h) { return 100 - 0.0033 * h; }

  function compute() {
    const d = DONENESS[state.done], f = FLAME[state.flame];
    const M = SIZES[state.size], n = state.count, T0 = START[state.start];
    const Tb = boilingPoint(state.altitude);
    const Tw = Tb - f.drop;
    const Ty = d.yolk;
    const M23 = Math.pow(M, 2 / 3);
    const ratio = (0.76 * (Tw - T0)) / (Tw - Ty);
    const lnR = Math.log(ratio);
    const baseMin = WILLIAMS_K * M23 * lnR;
    const baseSec = baseMin * 60;

    const Ce = n * M * C_EGG;
    const Cw = state.water * 1000 * C_WATER;
    const dT = (Ce * (Tw - T0)) / (Cw + Ce);
    const E = (Cw + Ce) * dT;
    const Peff = f.kw * 1000 * EFFICIENCY;
    const tRec = E / Peff;
    const penalty = tRec / 2;
    const total = Math.round(baseSec + penalty);

    const steps = [
      {
        t: "Boiling point at your altitude",
        f: `T_boil = 100 − 0.0033 × h\n       = 100 − 0.0033 × ${state.altitude}`,
        r: `= <b>${fx(Tb)} °C</b>`,
      },
      {
        t: `Water temp on ${f.label.toLowerCase()} flame`,
        f: `${f.desc} → T_water = T_boil − ${f.drop}`,
        r: `= <b>${fx(Tw)} °C</b>`,
      },
      {
        t: "Egg geometry",
        f: `M = ${M} g (${state.size}) · start ${T0} °C · target yolk ${Ty} °C\nM^(2/3) = ${M}^(0.667)`,
        r: `= <b>${fx(M23, 2)}</b>`,
      },
      {
        t: "Williams' equation (heat conduction in a sphere)",
        f: `t = 0.451 · M^⅔ · ln[0.76 · (T_w − T_0)/(T_w − T_yolk)]\n  = 0.451 × ${fx(M23, 2)} × ln[0.76 × ${fx(Tw - T0)} / ${fx(Tw - Ty)}]\n  = 0.451 × ${fx(M23, 2)} × ${fx(lnR, 3)}`,
        r: `= <b>${fx(baseMin, 2)} min</b> (${Math.round(baseSec)} s)`,
      },
      {
        t: "Thermal shock: cold eggs cool the water",
        f: `C_eggs  = ${n} × ${M} g × ${C_EGG} = ${Math.round(Ce)} J/K\nC_water = ${Math.round(state.water * 1000)} g × ${C_WATER} = ${Math.round(Cw)} J/K\nΔT = C_eggs·(T_w − T_0) / (C_water + C_eggs)`,
        r: `= <b>${fx(dT)} °C</b> drop`,
      },
      {
        t: "Flame recovery",
        f: `E = (C_water + C_eggs) · ΔT = ${fx(E / 1000, 1)} kJ\nP = ${f.kw} kW × ${EFFICIENCY * 100}% efficiency = ${fx(Peff / 1000, 2)} kW\nt_rec = E / P = ${Math.round(tRec)} s → cooks at ~half speed`,
        r: `= <b>+${Math.round(penalty)} s</b>`,
      },
      {
        t: "Total boiling time",
        f: `${Math.round(baseSec)} s + ${Math.round(penalty)} s`,
        r: `= <b>${total} s ≈ ${Math.floor(total / 60)} min ${total % 60} s</b>`,
        total: true,
      },
    ];
    return { total, steps, Tw, d, f, M, n, T0 };
  }

  // Briefly flicker digits before revealing the final value.
  async function scramble(el, html) {
    const plain = html.replace(/<[^>]+>/g, "");
    const frames = 8;
    for (let i = 0; i < frames; i++) {
      el.textContent = plain.replace(/\d/g, () => Math.floor(Math.random() * 10));
      await sleep(45);
    }
    el.innerHTML = html;
  }

  let calcRun = 0;
  async function runCalculation() {
    const run = ++calcRun;
    state.result = compute();
    const box = $("#calc");
    const btn = $("#toResult");
    const label = $("#calcLabel");
    btn.hidden = true;
    label.textContent = "Crunching numbers…";
    box.innerHTML = "";
    const fast = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    for (let i = 0; i < state.result.steps.length; i++) {
      if (run !== calcRun) return;
      const s = state.result.steps[i];
      const el = document.createElement("div");
      el.className = "calc-step" + (s.total ? " total" : "");
      el.innerHTML = `<div class="t"><em>${String(i + 1).padStart(2, "0")}</em>${s.t}</div><div class="f"></div><div class="r cursor"></div>`;
      box.appendChild(el);
      requestAnimationFrame(() => el.classList.add("show"));
      const fEl = $(".f", el), rEl = $(".r", el);
      if (fast) { fEl.textContent = s.f; rEl.innerHTML = s.r; rEl.classList.remove("cursor"); continue; }
      // type the formula
      const step = Math.max(2, Math.ceil(s.f.length / 30));
      for (let c = 0; c <= s.f.length; c += step) {
        if (run !== calcRun) return;
        fEl.textContent = s.f.slice(0, c);
        await sleep(16);
      }
      fEl.textContent = s.f;
      await scramble(rEl, s.r);
      rEl.classList.remove("cursor");
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      await sleep(260);
    }
    if (run !== calcRun) return;
    label.textContent = "Calculation complete ✓";
    btn.hidden = false;
    btn.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
  $("#toResult").addEventListener("click", () => go(6));

  // ---------- Result & timer ----------
  const CIRC = 2 * Math.PI * 96;
  const ring = $("#ringFg");
  const ringWrap = $(".ring-wrap");
  const timeEl = $("#timeDisplay");
  const startBtn = $("#startBtn");
  const resetBtn = $("#resetBtn");
  const timer = { total: 0, remaining: 0, endAt: 0, id: null, running: false };
  let audioCtx = null;

  function showResult() {
    const r = state.result || compute();
    state.result = r;
    timer.total = r.total;
    resetTimer();
    const eggs = r.n === 1 ? "egg" : "eggs";
    $("#summary").innerHTML =
      `<b>${r.n} ${state.size} ${eggs}</b> from the ${state.start}, <b>${r.d.label.toLowerCase()}</b> (${r.d.desc}) on a <b>${r.f.label.toLowerCase()}</b> flame in ${fx(state.water)} L of water.`;
  }

  function paintTimer() {
    timeEl.textContent = fmtTime(timer.remaining);
    const frac = timer.total ? timer.remaining / timer.total : 0;
    ring.style.strokeDashoffset = String(CIRC * (1 - frac));
  }

  function tick() {
    timer.remaining = Math.max(0, (timer.endAt - Date.now()) / 1000);
    paintTimer();
    document.title = `${fmtTime(timer.remaining)} · Eggactly`;
    if (timer.remaining <= 0) finish();
  }

  function startTimer() {
    if (timer.remaining <= 0) return;
    unlockAudio();
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.running = true;
    timer.id = setInterval(tick, 250);
    ringWrap.classList.add("running");
    startBtn.textContent = "❚❚ Pause";
    resetBtn.hidden = false;
    $("#hint").innerHTML = "Boiling… keep the flame steady.";
    $("#resultLabel").textContent = "Time remaining";
    $("#timeSub").textContent = "remaining";
  }

  function pauseTimer() {
    clearInterval(timer.id);
    timer.running = false;
    ringWrap.classList.remove("running");
    startBtn.textContent = "▶ Resume";
    document.title = "Paused · Eggactly";
  }

  function stopTimer() {
    clearInterval(timer.id);
    timer.running = false;
    ringWrap.classList.remove("running", "done");
    document.title = "Eggactly — Boil the perfect egg with math";
  }

  function resetTimer() {
    stopTimer();
    timer.remaining = timer.total;
    startBtn.hidden = false;
    startBtn.textContent = "▶ Start timer";
    resetBtn.hidden = true;
    $("#doneCard").hidden = true;
    $("#hint").hidden = false;
    $("#hint").innerHTML = "Drop the eggs in <b>once the water is boiling</b>, then hit start.";
    $("#resultLabel").textContent = "Your perfect egg needs";
    $("#timeSub").textContent = "min : sec";
    paintTimer();
  }

  function finish() {
    stopTimer();
    timer.remaining = 0;
    paintTimer();
    ringWrap.classList.add("done");
    startBtn.hidden = true;
    resetBtn.hidden = false;
    resetBtn.textContent = "Run again";
    $("#hint").hidden = true;
    $("#doneCard").hidden = false;
    $("#resultLabel").textContent = "Ding!";
    $("#timeSub").textContent = "done";
    document.title = "🥚 Ready! · Eggactly";
    alarm();
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
    try {
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification("Eggactly", { body: "Your eggs are ready! Into the ice bath they go.", icon: "assets/favicon.svg" });
      }
    } catch (_) {}
  }

  startBtn.addEventListener("click", () => (timer.running ? pauseTimer() : startTimer()));
  resetBtn.addEventListener("click", () => { resetBtn.textContent = "Reset"; resetTimer(); });
  $("#restartBtn").addEventListener("click", () => {
    state.done = null; state.flame = null;
    $$(".card.selected").forEach((c) => { c.classList.remove("selected"); c.setAttribute("aria-checked", "false"); });
    go(1, true);
  });

  function unlockAudio() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (_) {}
  }

  function alarm() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    for (let i = 0; i < 6; i++) {
      [0, 0.16].forEach((offset, j) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = "sine";
        o.frequency.value = j ? 1320 : 880;
        const t = now + i * 0.7 + offset;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g).connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.16);
      });
    }
  }

  // ---------- Init ----------
  ring.style.strokeDasharray = String(CIRC);
  renderEggs();
  renderPot();
})();
