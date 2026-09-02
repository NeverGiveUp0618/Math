/* ============================================================
 * 数学奇境 · 思维游戏引擎 games.js（2026-09-02 新增）
 *
 * 这里只放「能上手点」的思维游戏逻辑；题面文字、关卡配置在 data.js。
 * 每个游戏对外只暴露一个 render(host, api)：
 *   host = 要填充的 DOM 容器
 *   api  = { esc, toast, coin(n), win(id), back, isWon(id) }
 * 不碰存档结构，赢了只回调 api.win()，由 app.js 记账。
 *
 * ⚠️ 判题一律用整数或带 EPS 的比较；24 点里出现除法，浮点尾巴必须容错。
 * ============================================================ */
const MathGames = (() => {
  const EPS = 1e-6;
  const rnd = n => Math.floor(Math.random() * n);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const el = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstElementChild; };
  const head = (g, extra) => `<div class="gm-head"><div class="gm-ico">${g.icon}</div><div><div class="gm-nm">${g.name} ${"⭐".repeat(g.star || 1)}</div><div class="gm-th">🧠 练的是：${g.think}</div></div></div>
    <div class="gm-how">${g.how}
      <div class="gm-ladder">
        <div><b>📘 靠着课本</b>${g.link}${g.point ? " · " + g.point : ""}</div>
        ${g.up ? `<div><b>🧠 再进一步</b>${g.up}</div>` : ""}
        ${g.out ? `<div><b>🌱 想远一点</b>${g.out}</div>` : ""}
      </div></div>${extra || ""}`;

  /* ==========================================================
   * 🃏 算 24 点
   * ========================================================== */
  /* 返回一个解的字符串，无解返回 null。noDiv=true 时只用 + − ×（入门档） */
  function solve24(nums, noDiv) {
    const start = nums.map(n => ({ v: n, s: String(n) }));
    const walk = list => {
      if (list.length === 1) return Math.abs(list[0].v - 24) < EPS ? list[0].s : null;
      for (let i = 0; i < list.length; i++) for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i], b = list[j], rest = list.filter((_, k) => k !== i && k !== j);
        const cand = [
          { v: a.v + b.v, s: `(${a.s}+${b.s})` },
          { v: a.v * b.v, s: `(${a.s}×${b.s})` },
          { v: a.v - b.v, s: `(${a.s}−${b.s})` }
        ];
        if (!noDiv && Math.abs(b.v) > EPS) cand.push({ v: a.v / b.v, s: `(${a.s}÷${b.s})` });
        for (const c of cand) { const r = walk(rest.concat(c)); if (r) return r; }
      }
      return null;
    };
    return walk(start);
  }
  /* 只发有解的牌。入门档还要求「不用除法也解得开」，并且数字都不大。 */
  function deal24(easy) {
    const hi = easy ? 9 : 10;
    for (let t = 0; t < 600; t++) {
      const nums = [1, 2, 3, 4].map(() => 1 + rnd(hi));
      const sol = solve24(nums, easy);
      if (sol) return { nums, sol, easy };
    }
    return { nums: [4, 6, 2, 3], sol: solve24([4, 6, 2, 3], easy), easy };
  }
  const g24 = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "g24");
      let round = null, easy = true;            // 默认入门档：一定存在只用 + − × 的解
      const deal = () => { round = deal24(easy); round.used = [false, false, false, false]; round.expr = []; paint(); };
      const exprText = () => round.expr.map(t => t.t).join(" ");
      function paint(msg, cls) {
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="hn-pick"><button class="hn-lv ${easy ? "on" : ""}" data-easy="1">入门 · 只用 ＋−×</button><button class="hn-lv ${easy ? "" : "on"}" data-easy="0">标准 · 可能要用 ÷</button></div>
            <div class="g24-cards">${round.nums.map((n, i) => `<button class="g24-card ${round.used[i] ? "used" : ""}" data-n="${i}">${n}</button>`).join("")}</div>
            <div class="g24-expr" id="g24expr">${exprText() ? api.esc(exprText()) : '<span class="ph">点上面的数字和下面的符号，拼出一个算式</span>'}</div>
            <div class="g24-keys">
              ${["+", "−", "×", "÷", "(", ")"].map(k => `<button class="g24-key" data-op="${k}">${k}</button>`).join("")}
              <button class="g24-key ghost" data-act="del">⌫</button>
              <button class="g24-key ghost" data-act="clr">清空</button>
            </div>
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}" id="g24fb">${msg || ""}</div>
            <button class="btn wide" data-act="ok">算算看是不是 24</button>
            <button class="btn ghost wide" data-act="hint">🤔 给我一条思路</button>
            <button class="btn ghost wide" data-act="new">换一组数字</button>
          </div>`;
        host.querySelectorAll(".g24-card").forEach(b => b.onclick = () => {
          const i = +b.dataset.n; if (round.used[i]) return;
          round.used[i] = true; round.expr.push({ t: String(round.nums[i]), card: i }); paint();
        });
        host.querySelectorAll("[data-op]").forEach(b => b.onclick = () => { round.expr.push({ t: b.dataset.op }); paint(); });
        host.querySelector("[data-act='del']").onclick = () => { const t = round.expr.pop(); if (t && t.card !== undefined) round.used[t.card] = false; paint(); };
        host.querySelector("[data-act='clr']").onclick = () => { round.expr = []; round.used = [false, false, false, false]; paint(); };
        host.querySelector("[data-act='new']").onclick = deal;
        host.querySelectorAll("[data-easy]").forEach(b => b.onclick = () => { easy = b.dataset.easy === "1"; deal(); });
        host.querySelector("[data-act='hint']").onclick = () => {
          const first = round.sol.match(/\(([\d.]+)([+−×÷])([\d.]+)\)/);
          paint(first ? `白白偷偷告诉你：可以先算 <b>${first[1]} ${first[2]} ${first[3]}</b>，再想剩下的两个数怎么办。<br><span style="opacity:.75">这组一定有解，别放弃～</span>`
            : "这组一定有解，先试试把两个数乘起来看看接近 24 没有。", "no");
        };
        host.querySelector("[data-act='ok']").onclick = check;
      }
      function check() {
        const raw = exprText();
        if (!raw.trim()) return;
        const usedNums = round.expr.filter(t => t.card !== undefined).map(t => round.nums[t.card]).sort((a, b) => a - b);
        const want = round.nums.slice().sort((a, b) => a - b);
        if (usedNums.length !== 4 || usedNums.join(",") !== want.join(",")) {
          return paint(`每个数字都要用上、而且只能用一次。现在用了 <b>${usedNums.length}</b> 个。`, "no");
        }
        const js = raw.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/\s/g, "");
        if (!/^[0-9+\-*/().]+$/.test(js)) return paint("算式里有看不懂的符号，清空重来一次吧。", "no");
        let v; try { v = Function(`"use strict";return (${js})`)(); } catch (e) { v = NaN; }
        if (!Number.isFinite(v)) return paint("这个算式算不出来（括号没配好？），检查一下再试。", "no");
        if (Math.abs(v - 24) < EPS) {
          api.coin(4); api.win("g24");
          paint(`<b>${api.esc(raw)} = 24</b> 🎉 成了！<br><span style="opacity:.8">再点「换一组数字」继续挑战。</span>`, "ok");
        } else {
          paint(`${api.esc(raw)} = <b>${Math.round(v * 1000) / 1000}</b>，还不是 24。<br><span style="opacity:.75">离 24 差多少？想想把哪一步换成乘或除会更接近。</span>`, "no");
        }
      }
      deal();
    }
  };

  /* ==========================================================
   * 🔲 九宫格幻方（1～9，每行每列每条对角线都是 15）
   * ========================================================== */
  const MAGIC_BASE = [[2, 7, 6], [9, 5, 1], [4, 3, 8]];
  function magicVariant() {                       // 旋转 + 翻转，共 8 种摆法
    let m = MAGIC_BASE.map(r => r.slice());
    for (let t = rnd(4); t > 0; t--) m = m[0].map((_, i) => m.map(r => r[i]).reverse());
    if (rnd(2)) m = m.map(r => r.slice().reverse());
    return m;
  }
  const magic = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "magic");
      let sol, grid, given, sel = -1;
      const start = () => {
        sol = magicVariant().flat();
        given = new Array(9).fill(false);
        shuffle([...Array(9).keys()]).slice(0, 3).forEach(i => given[i] = true);   // 送 3 个数当扶手
        grid = sol.map((v, i) => given[i] ? v : 0);
        sel = -1; paint();
      };
      const sums = () => {
        const at = (r, c) => grid[r * 3 + c];
        const rows = [0, 1, 2].map(r => [0, 1, 2].reduce((s, c) => s + at(r, c), 0));
        const cols = [0, 1, 2].map(c => [0, 1, 2].reduce((s, r) => s + at(r, c), 0));
        const d1 = at(0, 0) + at(1, 1) + at(2, 2), d2 = at(0, 2) + at(1, 1) + at(2, 0);
        return { rows, cols, d1, d2 };
      };
      function paint(msg, cls) {
        const s = sums(), full = grid.every(v => v > 0);
        const usedCount = n => grid.filter(v => v === n).length;
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="mg-wrap">
              <div class="mg-grid">${grid.map((v, i) => `<button class="mg-cell ${given[i] ? "given" : ""} ${sel === i ? "sel" : ""}" data-i="${i}">${v || ""}</button>`).join("")}</div>
              <div class="mg-side">${s.rows.map(x => `<span class="${x === 15 ? "good" : ""}">${x}</span>`).join("")}</div>
              <div class="mg-bottom">${s.cols.map(x => `<span class="${x === 15 ? "good" : ""}">${x}</span>`).join("")}</div>
            </div>
            <div class="mg-diag">斜着看：↘ <b class="${s.d1 === 15 ? "good" : ""}">${s.d1}</b>　↙ <b class="${s.d2 === 15 ? "good" : ""}">${s.d2}</b>　<span class="note">全部凑成 15 就赢</span></div>
            <div class="mg-pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="mg-num ${usedCount(n) ? "used" : ""}" data-n="${n}">${n}</button>`).join("")}
              <button class="mg-num ghost" data-n="0">擦掉</button></div>
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}">${msg || ""}</div>
            <button class="btn ghost wide" data-act="hint">🤔 给我一条思路</button>
            <button class="btn ghost wide" data-act="new">换一题</button>
          </div>`;
        host.querySelectorAll(".mg-cell").forEach(b => b.onclick = () => { const i = +b.dataset.i; if (given[i]) return api.toast("这个数是题目给的，不能改"); sel = sel === i ? -1 : i; paint(); });
        host.querySelectorAll(".mg-num").forEach(b => b.onclick = () => {
          if (sel < 0) return api.toast("先点一个空格子，再点数字");
          grid[sel] = +b.dataset.n; sel = -1;
          if (grid.every(v => v > 0)) return judge();
          paint();
        });
        host.querySelector("[data-act='new']").onclick = start;
        host.querySelector("[data-act='hint']").onclick = () => paint(
          "1～9 加起来是 45，三行平分 ⇒ <b>每行必须是 15</b>。<br>再想：中间那个格子同时属于 4 条线，只有 <b>5</b> 待在那里才凑得齐；偶数只能待在四个角上。", "no");
        if (full) judgeSilent();
      }
      function judgeSilent() { }
      function judge() {
        const s = sums(), uniq = new Set(grid).size === 9;
        const ok = uniq && s.rows.every(x => x === 15) && s.cols.every(x => x === 15) && s.d1 === 15 && s.d2 === 15;
        if (ok) { api.coin(5); api.win("magic"); paint("九个数各就各位，八条线全是 15！🎉 这就是最小的幻方。", "ok"); }
        else paint(!uniq ? "有数字重复了 —— 1～9 每个只能用一次。" : "还差一点：把不是 15 的那几行 / 那几列调一调。<br><span style='opacity:.75'>试试先固定中间的 5，再调四个角。</span>", "no");
      }
      start();
    }
  };

  /* ==========================================================
   * 🗼 汉诺塔
   * ========================================================== */
  const hanoi = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "hanoi");
      let n = 3, pegs, moves, from = -1;
      const start = () => { pegs = [Array.from({ length: n }, (_, i) => n - i), [], []]; moves = 0; from = -1; paint(); };
      const best = () => Math.pow(2, n) - 1;
      function paint(msg, cls) {
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="hn-pick">${[3, 4, 5].map(k => `<button class="hn-lv ${k === n ? "on" : ""}" data-n="${k}">${k} 个盘</button>`).join("")}</div>
            <div class="hn-meta">已经搬了 <b>${moves}</b> 步　·　理论最少 <b>${best()}</b> 步</div>
            <div class="hn-pegs">${pegs.map((p, i) => `<div class="hn-peg ${from === i ? "sel" : ""}" data-p="${i}"><div class="hn-rod"></div>
              ${p.slice().reverse().map(d => `<div class="hn-disk d${d}" style="width:${28 + d * 15}%"></div>`).join("")}
              <div class="hn-base">${["起点", "中转", "终点"][i]}</div></div>`).join("")}</div>
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}">${msg || ""}</div>
            <button class="btn ghost wide" data-act="hint">🤔 给我一条思路</button>
            <button class="btn ghost wide" data-act="reset">重新摆好</button>
          </div>`;
        host.querySelectorAll(".hn-lv").forEach(b => b.onclick = () => { n = +b.dataset.n; start(); });
        host.querySelectorAll(".hn-peg").forEach(b => b.onclick = () => tap(+b.dataset.p));
        host.querySelector("[data-act='reset']").onclick = start;
        host.querySelector("[data-act='hint']").onclick = () => paint(
          `想搬走最下面那个大盘，就得先把<b>上面 ${n - 1} 个</b>整体挪到中转柱 —— 这又是一个一模一样、但小一号的问题。<br>${n} 个盘最少 2<sup>${n}</sup>−1 = <b>${best()}</b> 步：每多一个盘，步数就翻倍再加一。`, "no");
      }
      function tap(i) {
        if (from < 0) { if (!pegs[i].length) return api.toast("这根柱子上没有盘子"); from = i; return paint(); }
        if (from === i) { from = -1; return paint(); }
        const d = pegs[from][pegs[from].length - 1], top = pegs[i][pegs[i].length - 1];
        if (top && top < d) { from = -1; return paint("大盘不能压在小盘上面 —— 换一根柱子试试。", "no"); }
        pegs[from].pop(); pegs[i].push(d); moves++; from = -1;
        if (pegs[2].length === n) {
          const perfect = moves === best();
          api.coin(perfect ? 6 : 4); api.win("hanoi");
          return paint(perfect ? `全部搬完，而且正好 ${moves} 步 —— 一步没多走，完美！🎉` : `搬完啦！用了 ${moves} 步，理论最少是 ${best()} 步。<br><span style="opacity:.8">再来一次，试试能不能一步不多。</span>`, "ok");
        }
        paint();
      }
      start();
    }
  };

  /* ==========================================================
   * 🔢 迷你数独（4×4 / 6×6，保证唯一解）
   * ========================================================== */
  function boxOf(size, r, c) { const bh = size === 4 ? 2 : 2, bw = size === 4 ? 2 : 3; return Math.floor(r / bh) * (size / bw) + Math.floor(c / bw); }
  function sdOk(g, size, r, c, v) {
    for (let i = 0; i < size; i++) { if (g[r * size + i] === v && i !== c) return false; if (g[i * size + c] === v && i !== r) return false; }
    const b = boxOf(size, r, c);
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (boxOf(size, i, j) === b && g[i * size + j] === v && !(i === r && j === c)) return false;
    return true;
  }
  function sdFill(g, size, p = 0) {
    if (p === size * size) return true;
    const r = Math.floor(p / size), c = p % size;
    for (const v of shuffle(Array.from({ length: size }, (_, i) => i + 1))) {
      if (sdOk(g, size, r, c, v)) { g[p] = v; if (sdFill(g, size, p + 1)) return true; g[p] = 0; }
    }
    return false;
  }
  function sdCount(g, size, p = 0, found = { n: 0 }) {            // 数解的个数，超过 1 就提前收手
    if (found.n > 1) return found.n;
    if (p === size * size) { found.n++; return found.n; }
    if (g[p]) return sdCount(g, size, p + 1, found);
    const r = Math.floor(p / size), c = p % size;
    for (let v = 1; v <= size; v++) if (sdOk(g, size, r, c, v)) { g[p] = v; sdCount(g, size, p + 1, found); g[p] = 0; if (found.n > 1) break; }
    return found.n;
  }
  function sdMake(size) {
    const sol = new Array(size * size).fill(0); sdFill(sol, size);
    const puz = sol.slice();
    for (const i of shuffle([...Array(size * size).keys()])) {     // 逐个挖空，挖到会出现第二解就还回去
      const keep = puz[i]; puz[i] = 0;
      if (sdCount(puz.slice(), size) !== 1) puz[i] = keep;
    }
    return { sol, puz };
  }
  const sudoku = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "sudoku");
      let size = 4, puz, sol, grid, sel = -1;
      const start = () => { const m = sdMake(size); puz = m.puz; sol = m.sol; grid = puz.slice(); sel = -1; paint(); };
      function paint(msg, cls) {
        const bw = size === 4 ? 2 : 3;
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="hn-pick">${[4, 6].map(k => `<button class="hn-lv ${k === size ? "on" : ""}" data-s="${k}">${k}×${k}</button>`).join("")}</div>
            <div class="sd-grid s${size}">${grid.map((v, i) => {
              const r = Math.floor(i / size), c = i % size;
              const edge = `${c % bw === bw - 1 && c !== size - 1 ? "br" : ""} ${r % 2 === 1 && r !== size - 1 ? "bb" : ""}`;
              return `<button class="sd-cell ${puz[i] ? "given" : ""} ${sel === i ? "sel" : ""} ${edge}" data-i="${i}">${v || ""}</button>`;
            }).join("")}</div>
            <div class="mg-pad">${Array.from({ length: size }, (_, k) => `<button class="mg-num" data-n="${k + 1}">${k + 1}</button>`).join("")}
              <button class="mg-num ghost" data-n="0">擦掉</button></div>
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}">${msg || ""}</div>
            <button class="btn ghost wide" data-act="hint">🤔 帮我填一格</button>
            <button class="btn ghost wide" data-act="new">换一题</button>
          </div>`;
        host.querySelectorAll(".sd-cell").forEach(b => b.onclick = () => { const i = +b.dataset.i; if (puz[i]) return api.toast("这个数是题目给的"); sel = sel === i ? -1 : i; paint(); });
        host.querySelectorAll(".mg-num").forEach(b => b.onclick = () => {
          if (sel < 0) return api.toast("先点一个空格子，再点数字");
          grid[sel] = +b.dataset.n; sel = -1;
          if (grid.every(v => v > 0)) return judge();
          paint();
        });
        host.querySelectorAll(".hn-lv").forEach(b => b.onclick = () => { size = +b.dataset.s; start(); });
        host.querySelector("[data-act='new']").onclick = start;
        host.querySelector("[data-act='hint']").onclick = () => {
          const empty = grid.map((v, i) => v ? -1 : i).filter(i => i >= 0);
          if (!empty.length) return;
          const i = empty[rnd(empty.length)]; grid[i] = sol[i];
          paint(`帮你填了第 ${Math.floor(i / size) + 1} 行第 ${i % size + 1} 列。<br><span style="opacity:.75">找空格的窍门：看哪一行、哪一列已经填得最满，那里的空格往往<b>只剩一种可能</b>。</span>`, "no");
          if (grid.every(v => v > 0)) judge();
        };
      }
      function judge() {
        const ok = grid.every((v, i) => sdOk(grid, size, Math.floor(i / size), i % size, v));
        if (ok) { api.coin(size === 4 ? 4 : 6); api.win("sudoku"); paint(`${size}×${size} 全部推理正确！🎉 每行每列每宫都不重复。`, "ok"); }
        else paint("有地方重复了。<br><span style='opacity:.75'>逐行、逐列、逐宫检查一遍，同一个数字出现两次的地方就是问题所在。</span>", "no");
      }
      start();
    }
  };

  /* ==========================================================
   * 🚣 农夫过河
   * ========================================================== */
  const river = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "river");
      let left, boat, trips, over;
      const start = () => { left = RIVER_ITEMS.map(x => x.id); boat = "left"; trips = 0; over = false; paint(); };
      const rightSide = () => RIVER_ITEMS.map(x => x.id).filter(id => !left.includes(id));
      function danger(side) {
        for (const [a, b, why] of RIVER_BAD) if (side.includes(a) && side.includes(b)) return why;
        return "";
      }
      function paint(msg, cls) {
        const R = rightSide();
        const box = (ids, who) => `<div class="rv-bank ${boat === who ? "here" : ""}">
          <div class="rv-bt">${who === "left" ? "🏠 出发这岸" : "🎯 对岸"}${boat === who ? ' <span class="rv-boat">⛵农夫在这</span>' : ""}</div>
          <div class="rv-items">${ids.length ? ids.map(id => { const it = RIVER_ITEMS.find(x => x.id === id); return `<button class="rv-item" data-id="${id}" ${boat === who && !over ? "" : "disabled"}>${it.icon}<span>${it.name}</span></button>`; }).join("") : '<span class="rv-empty">空空的</span>'}</div></div>`;
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="rv-meta">已经渡了 <b>${trips}</b> 趟　·　最少需要 <b>7</b> 趟</div>
            ${box(left, "left")}
            <div class="rv-river">〰️〰️〰️〰️〰️〰️〰️</div>
            ${box(R, "right")}
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}">${msg || ""}</div>
            <button class="btn wide" data-act="alone" ${over ? "disabled" : ""}>⛵ 农夫空手划过去</button>
            <button class="btn ghost wide" data-act="hint">🤔 给我一条思路</button>
            <button class="btn ghost wide" data-act="reset">从头再来</button>
          </div>`;
        host.querySelectorAll(".rv-item").forEach(b => b.onclick = () => cross(b.dataset.id));
        host.querySelector("[data-act='alone']").onclick = () => cross(null);
        host.querySelector("[data-act='reset']").onclick = start;
        host.querySelector("[data-act='hint']").onclick = () => paint(
          "羊是唯一「和谁都处不来」的那个 —— 所以<b>第一趟一定先带羊</b>。<br>还有一招很多人想不到：<b>可以把已经运过去的东西再带回来</b>。允许「退一步」，题目才解得开。", "no");
      }
      function cross(id) {
        if (over) return;
        if (id) { if (boat === "left") left = left.filter(x => x !== id); else left = left.concat(id); }
        const stay = boat === "left" ? left : rightSide();      // 农夫要离开的那一岸，剩下的没人看着
        boat = boat === "left" ? "right" : "left"; trips++;
        const why = danger(stay);
        if (why) { over = true; return paint(`哎呀 —— ${why}。<br><span style="opacity:.8">别灰心，这一步几乎每个人都会踩。点「从头再来」，这次想想<b>什么东西不能被单独留下</b>。</span>`, "no"); }
        if (!left.length) {
          over = true; const perfect = trips === 7;
          api.coin(perfect ? 6 : 4); api.win("river");
          return paint(perfect ? "七趟，一趟不多，全部安全过河！🎉 你找到了最优解。" : `全部过河啦！用了 ${trips} 趟，最少是 7 趟。🎉`, "ok");
        }
        paint();
      }
      start();
    }
  };

  /* ==========================================================
   * ⚖️ 找次品（人教版五下「数学广角」）
   * ========================================================== */
  const weigh = {
    render(host, api) {
      const g = THINK_GAMES.find(x => x.id === "weigh");
      let lv = WEIGH_LEVELS[1], bad, pos, log, over, guessing;
      const start = () => { bad = 1 + rnd(lv.n); pos = new Array(lv.n).fill(0); log = []; over = false; guessing = false; paint(); };
      function paint(msg, cls) {
        const L = pos.map((p, i) => p === 1 ? i + 1 : 0).filter(Boolean), R = pos.map((p, i) => p === 2 ? i + 1 : 0).filter(Boolean);
        host.innerHTML = head(g) + `
          <div class="gm-board">
            <div class="hn-pick">${WEIGH_LEVELS.map(x => `<button class="hn-lv ${x.n === lv.n ? "on" : ""}" data-n="${x.n}">${x.n} 个球</button>`).join("")}</div>
            <div class="wg-meta">已经称了 <b>${log.length}</b> 次　·　保证找出来最少 <b>${lv.minWeigh}</b> 次<div class="note">其中有 1 个偏重，其余一样重。点球把它放上左盘 → 右盘 → 拿下来。</div></div>
            <div class="wg-pans"><div class="wg-pan">左盘<b>${L.length ? L.join(" ") : "—"}</b></div><div class="wg-mid">⚖️</div><div class="wg-pan">右盘<b>${R.length ? R.join(" ") : "—"}</b></div></div>
            <div class="wg-balls">${pos.map((p, i) => `<button class="wg-ball p${p} ${guessing ? "guess" : ""}" data-i="${i}">${i + 1}</button>`).join("")}</div>
            <div class="wg-log">${log.length ? log.map((x, i) => `<div>第 ${i + 1} 次：${x}</div>`).join("") : '<div class="note">称量记录会显示在这里。</div>'}</div>
            <div class="feedback ${cls || ""} ${msg ? "show" : ""}">${msg || ""}</div>
            ${guessing ? `<div class="wg-tip">现在点一个球，指认它是次品。</div>` : `<button class="btn wide" data-act="go" ${over ? "disabled" : ""}>⚖️ 称一称</button>
            <button class="btn ghost wide" data-act="guess" ${over ? "disabled" : ""}>💡 我知道是哪个了</button>`}
            <button class="btn ghost wide" data-act="hint">🤔 给我一条思路</button>
            <button class="btn ghost wide" data-act="reset">换一堆球</button>`;
        host.querySelectorAll(".wg-ball").forEach(b => b.onclick = () => {
          const i = +b.dataset.i;
          if (guessing) return finish(i + 1);
          if (over) return;
          pos[i] = (pos[i] + 1) % 3; paint();
        });
        const goBtn = host.querySelector("[data-act='go']"); if (goBtn) goBtn.onclick = doWeigh;
        const gsBtn = host.querySelector("[data-act='guess']"); if (gsBtn) gsBtn.onclick = () => { guessing = true; paint(); };
        host.querySelectorAll(".hn-lv").forEach(b => b.onclick = () => { lv = WEIGH_LEVELS.find(x => x.n === +b.dataset.n); start(); });
        host.querySelector("[data-act='reset']").onclick = start;
        host.querySelector("[data-act='hint']").onclick = () => paint(lv.tip + "<br><span style='opacity:.75'>要点是<b>每称一次都要把范围缩到三分之一</b>：天平只有三种结果（左重 / 右重 / 平），所以分三组最划算。</span>", "no");
      }
      function doWeigh() {
        const L = pos.map((p, i) => p === 1 ? i + 1 : 0).filter(Boolean), R = pos.map((p, i) => p === 2 ? i + 1 : 0).filter(Boolean);
        if (!L.length || !R.length) return paint("两边都要放球才能称。", "no");
        if (L.length !== R.length) return paint("两边球数不一样，这样称不出东西来 —— 天平只比得出「谁更重」。", "no");
        const res = L.includes(bad) ? "左边沉下去了" : R.includes(bad) ? "右边沉下去了" : "两边一样平";
        log.push(`左 [${L.join(" ")}] ⚖️ 右 [${R.join(" ")}] → <b>${res}</b>`);
        pos = new Array(lv.n).fill(0);
        paint(`${res}。<br><span style="opacity:.75">${res === "两边一样平" ? "说明次品不在天平上，就在没称的那几个里。" : "次品就在沉下去的那一盘里。"}</span>`, "no");
      }
      function finish(pickN) {
        guessing = false; over = true;
        if (pickN === bad) {
          const perfect = log.length <= lv.minWeigh;
          api.coin(perfect ? 6 : 3); api.win("weigh");
          paint(perfect ? `${pickN} 号正是次品，而且只称了 ${log.length} 次 —— 正好是最少次数！🎉` : `找对了，是 ${pickN} 号！不过你称了 ${log.length} 次，其实 ${lv.minWeigh} 次就够。<br><span style="opacity:.8">${lv.tip}</span>`, "ok");
        } else {
          paint(`不是 ${pickN} 号哦，真正的次品是 <b>${bad}</b> 号。<br><span style="opacity:.8">${lv.tip}</span>`, "no");
        }
      }
      start();
    }
  };

  return { g24, magic, hanoi, sudoku, river, weigh, solve24, sdMake, magicVariant };
})();
