/* ============================================================
 * 数学奇境 · 穿越数学史 —— 主逻辑 app.js
 * ============================================================ */
const $ = s => document.querySelector(s);
const todayStr = () => { const d = new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const addDays = (str, n) => { const d = new Date(str); d.setDate(d.getDate() + n); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };

/* ---------- 存档 + 共享钱包（与语文/英语两站互通） ---------- */
const LS_KEY = "mathQuest_v1";
const WALLET_KEY = "sharedWallet_v1";
const SRS_STEPS = [1, 2, 4, 7, 15, 30]; // lv1..6 的复习间隔（天）

function defState() {
  return {
    coins: 0, tickets: 0, walletMigrated: false,
    view: "map",
    srs: {},               // skillId -> {lv:1..6, due}
    stations: {},          // civId -> {core,extend,challenge}
    wonders: {},           // civId -> true（收集到的数学奇观）
    unlocked: { egypt: true },
    challengeDone: {},      // 挑战题 id -> true
    readCards: {},          // 拓展知识卡 已读
    daily: { date: todayStr(), correct: 0 },
    history: {},            // 日期 -> {right}  家长后台默默记录，不做打卡压力
    totalRight: 0,          // 累计做对题数（成就）
    testMode: false
  };
}
let S = defState();
try { const raw = localStorage.getItem(LS_KEY); if (raw) S = Object.assign(defState(), JSON.parse(raw)); } catch (e) {}
S.daily = Object.assign({ date: todayStr(), correct: 0 }, S.daily);
if (S.daily.date !== todayStr()) S.daily = { date: todayStr(), correct: 0 };

function walletOut() { try { localStorage.setItem(WALLET_KEY, JSON.stringify({ coins: S.coins || 0, tickets: S.tickets || 0 })); } catch (e) {} }
function walletIn() {
  let w = { coins: 0, tickets: 0 };
  try { const raw = localStorage.getItem(WALLET_KEY); if (raw) w = JSON.parse(raw) || w; } catch (e) {}
  if (!S.walletMigrated) { w.coins = (w.coins || 0) + (S.coins || 0); w.tickets = (w.tickets || 0) + (S.tickets || 0); S.walletMigrated = true; }
  S.coins = w.coins || 0; S.tickets = w.tickets || 0;
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
  walletOut();
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {} walletOut(); }

/* ---------- 奖励 ---------- */
function addCoins(n) {
  const w = (() => { try { return JSON.parse(localStorage.getItem(WALLET_KEY)) || {}; } catch (e) { return {}; } })();
  S.coins = (typeof w.coins === "number" ? w.coins : S.coins) + n;
  S.tickets = (typeof w.tickets === "number" ? w.tickets : S.tickets);
  save(); paintPurse();
}
function addTickets(n) {
  const w = (() => { try { return JSON.parse(localStorage.getItem(WALLET_KEY)) || {}; } catch (e) { return {}; } })();
  S.tickets = (typeof w.tickets === "number" ? w.tickets : S.tickets) + n;
  S.coins = (typeof w.coins === "number" ? w.coins : S.coins);
  save(); paintPurse();
}
/* 只默默记录数据（供家长后台看），不设每天打卡 / 连续天数压力 —— 想学就学 */
function markCorrect() {
  if (S.daily.date !== todayStr()) S.daily = { date: todayStr(), correct: 0 };
  S.daily.correct++;
  S.totalRight = (S.totalRight || 0) + 1;
  const t = todayStr();
  S.history[t] = S.history[t] || { right: 0 };
  S.history[t].right++;
  save();
}

/* ---------- SRS ---------- */
const ST = civ => STATIONS[civ || S.civ];   // 当前文明站内容
function srsDueList(civ) { const t = todayStr(); const st = ST(civ); if (!st) return []; return st.core.filter(s => { const r = S.srs[s.id]; return r && r.due <= t; }); }
function srsDueAll() { const t = todayStr(); return Object.values(STATIONS).flatMap(s => s.core).filter(s => { const r = S.srs[s.id]; return r && r.due <= t; }); }
function srsGrade(id, ok) {
  const t = todayStr();
  let r = S.srs[id] || { lv: 0, due: t };
  if (!ok) { r.lv = 1; r.due = addDays(t, SRS_STEPS[0]); }
  else { if (r.due > t) { S.srs[id] = r; return; } r.lv = Math.min(6, (r.lv || 0) + 1); r.due = addDays(t, SRS_STEPS[r.lv - 1]); }
  S.srs[id] = r; save();
}

/* ---------- 站点进度 / 奇观 ---------- */
function stStars(civ) { return S.stations[civ] || { core: false, extend: false, challenge: false }; }
function setStar(civ, key) {
  const s = Object.assign({ core: false, extend: false, challenge: false }, S.stations[civ]);
  if (s[key]) { S.stations[civ] = s; return; }
  s[key] = true; S.stations[civ] = s; save();
  toast("获得一颗探险星 ⭐");
  if (s.core && s.extend && s.challenge && !S.wonders[civ]) collectWonder(civ);
}
function collectWonder(civ) {
  S.wonders[civ] = true;
  const idx = CIVS.findIndex(c => c.id === civ);
  if (idx >= 0 && CIVS[idx + 1]) S.unlocked[CIVS[idx + 1].id] = true;
  save();
  addTickets(3);   // 转盘券靠「收集奇观」这种成就发放，不靠每日打卡
  const c = CIVS.find(c => c.id === civ);
  setTimeout(() => toast(`🎉 收集到数学奇观：${c.wonder.icon} ${c.wonder.name}！+3 🎡 新文明已解锁`), 700);
}

/* ---------- UI 基础 ---------- */
function paintPurse() {
  try { const w = JSON.parse(localStorage.getItem(WALLET_KEY)); if (w) { if (typeof w.coins === "number") S.coins = w.coins; if (typeof w.tickets === "number") S.tickets = w.tickets; } } catch (e) {}
  $("#coinN").textContent = S.coins || 0;
  $("#tkN").textContent = S.tickets || 0;
}
let toastTimer;
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2200); }

function scratchPadHtml() {
  return `<div class="scratch"><button class="scratch-toggle" type="button">✏️ 需要时打开草稿纸</button><div class="scratch-body hidden"><div class="scratch-tools"><button type="button" data-tool="pen" class="on">铅笔</button><button type="button" data-tool="eraser">橡皮</button><button type="button" data-tool="clear">清空</button></div><canvas width="600" height="380" aria-label="手写草稿区"></canvas></div></div>`;
}
function bindScratchPad(root) {
  const box = root.querySelector(".scratch"); if (!box) return;
  const body = box.querySelector(".scratch-body"), canvas = box.querySelector("canvas");
  box.querySelector(".scratch-toggle").onclick = () => body.classList.toggle("hidden");
  if (/jsdom/i.test(navigator.userAgent || "")) return;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  let drawing = false, eraser = false;
  box.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => {
    if (b.dataset.tool === "clear") { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
    eraser = b.dataset.tool === "eraser"; box.querySelectorAll("[data-tool]").forEach(x => x.classList.toggle("on", x === b));
  });
  const point = e => { const r = canvas.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [(p.clientX-r.left)*canvas.width/r.width,(p.clientY-r.top)*canvas.height/r.height]; };
  const start = e => { drawing=true; const [x,y]=point(e); ctx.beginPath(); ctx.moveTo(x,y); e.preventDefault(); };
  const move = e => { if(!drawing)return; const [x,y]=point(e); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.lineWidth=eraser?28:4; ctx.strokeStyle=eraser?"#fff":"#655474"; ctx.lineTo(x,y); ctx.stroke(); e.preventDefault(); };
  const stop = () => drawing=false;
  canvas.addEventListener("pointerdown",start); canvas.addEventListener("pointermove",move); canvas.addEventListener("pointerup",stop); canvas.addEventListener("pointerleave",stop);
}
function baibaiTip(text) { return `<div class="baibai-tip"><img src="assets/baibai-base.png" alt="白白"><span>${text}</span></div>`; }

let nav = []; // 面包屑视图栈，用于返回
function go(view, opts) { nav.push({ view: S.view, civ: S.civ, sub: S.sub }); S.view = view; Object.assign(S, opts || {}); render(); }
function back() { const p = nav.pop(); if (p) { S.view = p.view; S.civ = p.civ; S.sub = p.sub; } else S.view = "map"; render(); }

/* ============================================================ 渲染 ============================================================ */
function render() {
  paintPurse();
  const scr = $("#screen");
  $("#backBtn").classList.toggle("hidden", S.view === "map" || S.view === "rewards" || S.view === "parent");
  $("#learningHome").classList.toggle("hidden", !(S.view === "map" || S.view === "rewards" || S.view === "parent"));
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
  if (S.view === "map") return renderMap(scr);
  if (S.view === "station") return renderStation(scr);
  if (S.view === "core") return renderCore(scr);
  if (S.view === "extend") return renderExtend(scr);
  if (S.view === "challenge") return renderChallengeList(scr);
  if (S.view === "challengeRun") return renderChallenge(scr);
  if (S.view === "rewards") return renderRewards(scr);
  if (S.view === "parent") return renderParent(scr);
}

/* ---------- 地图首页 ---------- */
function renderMap(scr) {
  $("#title").textContent = "数学奇境";
  const done = Object.keys(S.wonders).length;
  const greet = done === 0
    ? `<div class="hello">白白陪你逛数学世界</div>课本里的本领、历史里的发现、好玩的思维谜题，都可以按喜欢的顺序慢慢探索。<div class="soft">不赶进度，也不用打卡，想来就来。</div>`
    : `<div class="hello">又见面啦！</div>我们已经发现 <b>${done}</b> 个数学奇观。今天想去哪儿看看，由你决定。`;
  let civs = CIVS.map(c => {
    const unlocked = S.unlocked[c.id] || !c.locked;
    const st = stStars(c.id);
    const stars = ["core", "extend", "challenge"].map(k => st[k] ? "⭐" : "☆").join("");
    if (!unlocked) return `<div class="civ locked"><div class="ico">${c.icon}</div><div class="info"><div class="nm">${c.name}</div><div class="pl">${esc(c.place)}</div></div><div class="lockicon">🔒</div></div>`;
    return `<div class="civ" data-civ="${c.id}"><div class="ico">${c.icon}</div><div class="info">
      <div class="nm">${c.name}<span class="tag">${c.book}·${esc(c.unit)}</span></div>
      <div class="pl">${esc(c.place)}</div><div class="bl">${esc(c.blurb)}</div></div>
      <div class="st">${stars}</div></div>`;
  }).join("");
  const wrow = CIVS.map(c => `<span class="w ${S.wonders[c.id] ? "got" : ""}" title="${esc(c.wonder.name)}">${c.wonder.icon}</span>`).join("");
  scr.className = "map";
  scr.innerHTML = `<div class="map-hero"><h2>今天想解开哪个数学秘密？</h2><p>从课本出发，再多走一步。每一次尝试都算一次新发现。</p></div><div class="guide baibai"><img src="assets/baibai-base.png" alt="白白"><div class="bubble">${greet}</div></div>
    <div class="wonderbar"><div class="t">🏺 数学奇观收藏（集齐一站的三颗星就能点亮）</div><div class="row">${wrow}</div></div>
    ${civs}`;
  scr.querySelectorAll(".civ[data-civ]").forEach(el => el.onclick = () => go("station", { civ: el.dataset.civ }));
}

/* ---------- 站内三层 ---------- */
function renderStation(scr) {
  const c = CIVS.find(x => x.id === S.civ);
  $("#title").textContent = c.name;
  const station = ST();
  scr.className = "depths";
  if (!station) {  // 该文明内容还没铺好
    scr.innerHTML = `<div class="guide baibai"><img src="assets/baibai-base.png" alt="白白"><div class="bubble">这座 <b>${c.name}</b> 文明还在铺路，很快就能来探险。</div></div>`;
    return;
  }
  const st = stStars(S.civ), L = station.labels;
  scr.innerHTML = `
    <div class="guide baibai"><img src="assets/baibai-base.png" alt="白白"><div class="bubble"><div class="hello">白白找到一条新线索</div>${esc(c.blurb)}</div></div>
    <div class="depth" style="--c:#f2a5c4" data-d="core"><div class="ico">🌸</div>
      <div><div class="nm">课内夯实</div><div class="ds">${esc(L.core)}</div></div>${st.core ? '<span class="done">✓</span>' : ''}</div>
    <div class="depth" style="--c:#e6b98f" data-d="extend"><div class="ico">🚀</div>
      <div><div class="nm">课外拓展</div><div class="ds">${esc(L.extend)}</div></div>${st.extend ? '<span class="done">✓</span>' : ''}</div>
    <div class="depth" style="--c:#b8a4e3" data-d="challenge"><div class="ico">🧠</div>
      <div><div class="nm">思维挑战</div><div class="ds">${esc(L.challenge)}</div></div>${st.challenge ? '<span class="done">✓</span>' : ''}</div>`;
  scr.querySelectorAll(".depth").forEach(el => el.onclick = () => {
    const d = el.dataset.d;
    if (d === "core") go("core"); else if (d === "extend") go("extend"); else go("challenge");
  });
}

/* ---------- 🌱 课内夯实：跑题 ---------- */
let sess = null;
function renderCore(scr) {
  $("#title").textContent = "课内夯实";
  if (!sess || sess.mode !== "core") {
    sess = { mode: "core", civ: S.civ, i: 0, n: 8, right: 0, cur: null, revealed: false };
  }
  nextCore(scr);
}
function nextCore(scr) {
  if (sess.i >= sess.n) return coreDone(scr);
  // 优先出本站到期复习题，否则本站随机
  let skill;
  const due = srsDueList(sess.civ), pool = ST(sess.civ).core;
  if (due.length) skill = due[Math.floor(Math.random() * due.length)];
  else skill = pool[Math.floor(Math.random() * pool.length)];
  const prob = skill.gen();
  sess.cur = { skill, prob, isDue: !!(S.srs[skill.id] && S.srs[skill.id].due <= todayStr()) };
  sess.revealed = false;
  scr.className = "stage";
  scr.innerHTML = `<div class="progress"><i style="width:${sess.i / sess.n * 100}%"></i></div>
    <div class="qcard">
      <div class="qmeta"><span>${skill.icon} ${skill.name}${sess.cur.isDue ? " · 复习" : ""}</span><span>第 ${sess.i + 1}/${sess.n} 题</span></div>
      <div class="qtext">${prob.q}</div>
      <div class="answerbox"><input id="ans" type="number" inputmode="numeric" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}
      <div class="feedback" id="fb"></div>
    </div>
    <button class="btn ghost wide hidden" id="nextb">下一题 ›</button>`;
  const input = $("#ans");
  bindScratchPad(scr);
  const submit = () => {
    if (sess.revealed) return;
    const v = input.value.trim();
    if (v === "") return;
    const val = Number(v), ok = val === prob.a;
    sess.revealed = true;
    srsGrade(skill.id, ok);
    const fb = $("#fb");
    if (ok) {
      sess.right++; markCorrect(); addCoins(2);
      fb.className = "feedback ok show"; fb.innerHTML = `找到了！白白也看懂你的办法啦 🎉 <b>+2 🪙</b>` + (prob.hint ? `<br><span style="opacity:.75">小贴士：${prob.hint}</span>` : "");
    } else {
      fb.className = "feedback no show";
      let why = prob.trap && val === prob.trap.val ? `我猜你是——${prob.trap.why}。` : "";
      fb.innerHTML = `再看看，正确答案是 <b>${prob.a}</b>。${why ? "<br>" + why : ""}${prob.hint ? "<br>" + prob.hint : ""}<br><span style="opacity:.75">没关系，这道题过几天会再考你一次 💪</span>`;
    }
    input.disabled = true;
    $("#ok").classList.add("hidden");
    $("#nextb").classList.remove("hidden");
  };
  $("#ok").onclick = submit;
  input.onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#nextb").onclick = () => { sess.i++; nextCore(scr); };
}
function coreDone(scr) {
  const passed = sess.right >= 6;
  if (passed) setStar(sess.civ, "core");
  scr.className = "stage";
  scr.innerHTML = `<div class="qcard" style="text-align:center">
    <div style="font-size:52px">${passed ? "🏆" : "💪"}</div>
    <div class="qtext">这一轮做对 ${sess.right}/${sess.n} 题</div>
    <p style="font-size:14px;opacity:.8;line-height:1.6">${passed ? "课本练得又快又准，课内夯实这颗星拿下！" : "答对 6 题就能点亮这颗星，再来一轮就好～"}</p>
    <button class="btn wide" id="again">再练一轮</button>
    <button class="btn ghost wide" id="back">回到古埃及</button></div>`;
  sess = null;
  $("#again").onclick = () => renderCore(scr);
  $("#back").onclick = () => back();
}

/* ---------- 🚀 课外拓展 ---------- */
function extendPool(civ) { const e = ST(civ).extend; return (e.tricks || []).map(t => t.gen).concat(e.play || []); }
function renderExtend(scr) {
  $("#title").textContent = "课外拓展";
  scr.className = "stage";
  const e = ST().extend;
  const cards = e.cards.map(c => `<div class="readcard"><div class="h">${c.icon} ${esc(c.title)}</div><div class="b">${c.body}</div></div>`).join("");
  const tricks = (e.tricks || []).map(t => `<div class="readcard"><div class="h">${t.icon} 速算魔法：${esc(t.name)}</div><div class="b">${t.card}</div></div>`).join("");
  scr.innerHTML = `<div class="guide baibai"><img src="assets/baibai-base.png" alt="白白"><div class="bubble"><div class="hello">白白的课外发现</div>先随便读一张感兴趣的卡，再动手玩一玩。</div></div>
    ${cards}${tricks}
    <button class="btn wide" id="play">🎮 玩一玩拓展练习</button>`;
  e.cards.forEach((c, i) => { S.readCards[S.civ + "_c" + i] = true; }); save();
  $("#play").onclick = () => startExtendPlay(scr);
}
function startExtendPlay(scr) {
  sess = { mode: "extend", civ: S.civ, i: 0, n: 6, right: 0, revealed: false, pool: extendPool(S.civ) };
  nextExtend(scr);
}
function nextExtend(scr) {
  if (sess.i >= sess.n) {
    if (sess.right >= 4) setStar(sess.civ, "extend");
    scr.className = "stage";
    scr.innerHTML = `<div class="qcard" style="text-align:center"><div style="font-size:52px">${sess.right >= 4 ? "🌟" : "💪"}</div>
      <div class="qtext">做对 ${sess.right}/${sess.n}</div>
      <p style="font-size:14px;opacity:.8">${sess.right >= 4 ? "拓展星到手！这些都是课本外的本事。" : "答对 4 题点亮拓展星，再来一次～"}</p>
      <button class="btn wide" id="again">再来</button><button class="btn ghost wide" id="back">返回</button></div>`;
    sess = null;
    $("#again").onclick = () => startExtendPlay(scr); $("#back").onclick = () => back();
    return;
  }
  const prob = sess.pool[Math.floor(Math.random() * sess.pool.length)]();
  sess.revealed = false;
  scr.className = "stage";
  scr.innerHTML = `<div class="progress"><i style="width:${sess.i / sess.n * 100}%"></i></div>
    <div class="qcard"><div class="qmeta"><span>🚀 拓展练习</span><span>第 ${sess.i + 1}/${sess.n}</span></div>
    <div class="qtext">${prob.q}</div>
    <div class="answerbox"><input id="ans" type="number" inputmode="numeric" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}
    <div class="feedback" id="fb"></div></div>
    <button class="btn ghost wide hidden" id="nextb">下一题 ›</button>`;
  const input = $("#ans"); bindScratchPad(scr);
  const submit = () => {
    if (sess.revealed) return; const v = input.value.trim(); if (v === "") return;
    const ok = Number(v) === prob.a; sess.revealed = true;
    const fb = $("#fb");
    if (ok) { sess.right++; markCorrect(); addCoins(2); fb.className = "feedback ok show"; fb.innerHTML = "正确！🎉 <b>+2 🪙</b>"; }
    else { fb.className = "feedback no show"; fb.innerHTML = `正确答案是 <b>${prob.a}</b>。${prob.hint ? "<br>" + prob.hint : ""}`; }
    input.disabled = true; $("#ok").classList.add("hidden"); $("#nextb").classList.remove("hidden");
  };
  $("#ok").onclick = submit; input.onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#nextb").onclick = () => { sess.i++; nextExtend(scr); };
}

/* ---------- 🧠 思维挑战 ---------- */
function renderChallengeList(scr) {
  $("#title").textContent = "思维挑战";
  scr.className = "stage";
  const list = ST().challenge.map((c, i) => {
    const done = S.challengeDone[c.id];
    return `<div class="readcard" data-i="${i}" style="cursor:pointer"><div class="h">${c.icon} ${esc(c.name)} ${"⭐".repeat(c.star)}${done ? ' <span style="color:#3ec98a;margin-left:auto">已破解 ✓</span>' : ''}</div>
      <div class="b" style="opacity:.7">${done ? "点开再想一遍，或看看还有没有别的思路" : "点开挑战 —— 先自己想，实在想不出再一条条看提示"}</div></div>`;
  }).join("");
  scr.innerHTML = `<div class="guide baibai"><img src="assets/baibai-base.png" alt="白白"><div class="bubble"><div class="hello">慢慢想也很厉害</div>这里不比速度。可以画一画、试一试，实在想不出再看提示。</div></div>${list}`;
  scr.querySelectorAll(".readcard[data-i]").forEach(el => el.onclick = () => go("challengeRun", { sub: Number(el.dataset.i) }));
}
function renderChallenge(scr) {
  const civ = S.civ, c = ST(civ).challenge[S.sub];
  $("#title").textContent = c.name;
  scr.className = "stage";
  let body;
  if (c.type === "choice") {
    body = `<div class="opts">${c.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
  } else {
    body = `<div class="answerbox"><input id="ans" type="number" inputmode="numeric" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}`;
  }
  scr.innerHTML = `<div class="qcard">
    <div class="qmeta"><span>${c.icon} ${esc(c.name)}</span><span>${"⭐".repeat(c.star)}</span></div>
    <div class="qtext" style="font-size:18px;text-align:left;line-height:1.6">${c.q}</div>
    ${body}
    <div class="feedback" id="fb"></div>
    <div class="hints" id="hints"></div>
    <button class="btn ghost wide" id="hintBtn">🤔 想不出？看一条思路</button>
    <div class="bigidea hidden" id="big"><div class="t">💡 解题大招</div>${c.big}</div>
    <button class="btn wide hidden" id="doneb">破解啦，返回 ›</button>
  </div>`;
  bindScratchPad(scr);
  let hi = 0, solved = false;
  const reveal = () => {
    if (solved) return; solved = true;
    if (!S.challengeDone[c.id]) { S.challengeDone[c.id] = true; addCoins(8); markCorrect(); toast("破解思维挑战 +8 🪙");
      const n = ST(civ).challenge.filter(x => S.challengeDone[x.id]).length; if (n >= 2) setStar(civ, "challenge"); }
    $("#big").classList.remove("hidden"); $("#doneb").classList.remove("hidden"); $("#hintBtn").classList.add("hidden");
  };
  const showHint = () => {
    if (hi >= c.steps.length) return;
    const h = document.createElement("div"); h.className = "hint"; h.innerHTML = `<b>思路 ${hi + 1}：</b>${c.steps[hi]}`;
    $("#hints").appendChild(h); hi++;
    if (hi >= c.steps.length) $("#hintBtn").textContent = "已经是最后一条思路啦";
  };
  $("#hintBtn").onclick = showHint;
  const right = () => { const fb = $("#fb"); fb.className = "feedback ok show"; fb.innerHTML = "答对了，思路很清晰！🎉"; reveal(); };
  const wrong = () => { const fb = $("#fb"); fb.className = "feedback no show"; fb.innerHTML = "还不对，别急——点下面看一条思路，再想想 💪"; };
  if (c.type === "choice") {
    scr.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      if (solved) return;
      const i = Number(b.dataset.i);
      if (i === c.a) { b.classList.add("right"); right(); }
      else { b.classList.add("wrong"); wrong(); }
    });
  } else {
    const submit = () => { const v = $("#ans").value.trim(); if (v === "") return; if (Number(v) === c.a) { $("#ans").disabled = true; $("#ok").classList.add("hidden"); right(); } else wrong(); };
    $("#ok").onclick = submit; $("#ans").onkeydown = e => { if (e.key === "Enter") submit(); };
  }
  $("#doneb").onclick = () => back();
}

/* ---------- 🎁 宝库（奖励页） ---------- */
function renderRewards(scr) {
  $("#title").textContent = "宝库";
  nav = [];
  const gotW = Object.keys(S.wonders).length, gotStar = CIVS.reduce((n, c) => { const s = stStars(c.id); return n + (s.core ? 1 : 0) + (s.extend ? 1 : 0) + (s.challenge ? 1 : 0); }, 0);
  const wonders = CIVS.map(c => `<div class="w ${S.wonders[c.id] ? "got" : ""}">${S.wonders[c.id] ? c.wonder.icon : "❔"}<span class="cap">${S.wonders[c.id] ? esc(c.wonder.name) : "未解锁"}</span></div>`).join("");
  scr.className = "rewards";
  scr.innerHTML = `
    <div class="panel"><h3>🏺 数学奇观收藏</h3><div class="wondergrid">${wonders}</div>
      <div class="note">集齐一个文明的三颗探险星（课内 + 拓展 + 思维）就能点亮它的奇观。<b>没有每天打卡，想来就来</b>——按自己的节奏探险。</div></div>
    <div class="panel"><h3>⭐ 探险成就</h3>
      <div style="font-size:15px;line-height:1.9">收集到的数学奇观：<b>${gotW}</b> / ${CIVS.length}<br>点亮的探险星：<b>${gotStar}</b><br>累计做对题目：<b>${S.totalRight || 0}</b> 道</div></div>
    <div class="panel"><h3>🪙 我的钱包（三科通用）</h3>
      <div style="font-size:15px;line-height:1.9">金币：<b>${S.coins || 0}</b> 🪙<br>转盘券：<b>${S.tickets || 0}</b> 🎡</div>
      <div class="note">数学、语文、英语三个网站是<b>同一个钱包</b>。数学收集到奇观会奖转盘券，可以到「魔法英语乐园」的幸运大转盘上转实物奖励。</div></div>`;
}

/* ---------- 👨‍👩‍👧 家长 ---------- */
let pinOK = false;
function renderParent(scr) {
  $("#title").textContent = "统一家长中心";
  nav = [];
  scr.className = "parent";
  if (!pinOK) {
    scr.innerHTML = `<div class="panel"><div class="parent-head"><img src="assets/baibai-base.png" alt="白白"><div><h3>统一家长中心</h3><p class="note">一个入口查看三科学习概况。请输入家长密码。</p></div></div>
      <div class="pinpad"><input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>
      <button class="btn wide" id="go">进入</button></div>`;
    const go2 = () => { if ($("#pin").value === PARENT_PIN) { pinOK = true; renderParent(scr); } else toast("密码不对"); };
    $("#go").onclick = go2; $("#pin").onkeydown = e => { if (e.key === "Enter") go2(); };
    return;
  }
  const activeDays = Object.keys(S.history).length;
  const recent = Object.keys(S.history).sort().slice(-7).reverse()
    .map(d => `<div class="setrow"><span>${d.slice(5)}</span><b>做对 ${S.history[d].right} 题</b></div>`).join("") || `<div class="note">还没有学习记录。</div>`;
  const allCore = Object.values(STATIONS).flatMap(s => s.core);
  const mastered = allCore.filter(s => (S.srs[s.id] || {}).lv >= 4).length;
  let en = {}, zh = {};
  try { en = JSON.parse(localStorage.getItem("magicEnglish_v1") || "{}"); } catch(e) {}
  try { zh = JSON.parse(localStorage.getItem("treasureWriting_v1") || "{}"); } catch(e) {}
  const enLearned = Object.keys(en.srs || {}).length;
  const zhWorks = (zh.works || zh.essays || zh.records || []).length || Object.keys(zh.history || {}).length;
  scr.innerHTML = `<div class="panel"><div class="parent-head"><img src="assets/baibai-base.png" alt="白白"><div><h3>三科学习总览</h3><p class="note">先看全貌，需要细节时再进入各学科。</p></div></div>
    <div class="subject-grid"><a class="subject-card" href="https://nevergiveup0618.github.io/English/"><span>🏰</span><b>英语</b><small>${enLearned} 个词已进入学习</small></a><a class="subject-card" href="https://nevergiveup0618.github.io/Chinese/"><span>🗺️</span><b>语文</b><small>${zhWorks} 条学习记录</small></a><a class="subject-card" href="#math-report"><span>🔭</span><b>数学</b><small>${S.totalRight || 0} 道做对</small></a></div></div>
    <div class="panel" id="math-report"><h3>📊 数学学习概况（自动记录，无需打卡）</h3>
    <div class="setrow"><span>今天做对题数</span><b>${S.daily.correct}</b></div>
    <div class="setrow"><span>累计做对题目</span><b>${S.totalRight || 0}</b></div>
    <div class="setrow"><span>有学习记录的天数</span><b>${activeDays}</b></div>
    <div class="setrow"><span>已收集数学奇观</span><b>${Object.keys(S.wonders).length} / ${CIVS.length}</b></div>
    <div class="setrow"><span>课内知识点已熟练</span><b>${mastered} / ${allCore.length}</b></div>
    <div class="setrow"><span>待复习知识点(到期)</span><b>${srsDueAll().length}</b></div></div>
    <div class="panel"><h3>🗓️ 最近学习记录</h3>${recent}
    <div class="note">孩子想学就学，这里只默默记录她每天做对了多少，供您了解进度——不设连续打卡，避免压力。</div></div>
    <div class="panel"><h3>⚙️ 设置</h3>
    <div class="setrow"><span>测试模式<br><span class="note">解锁全部文明，方便您预览。给孩子用前请关掉。</span></span>
      <div class="seg"><button id="tm0" class="${!S.testMode ? "on" : ""}">关</button><button id="tm1" class="${S.testMode ? "on" : ""}">开</button></div></div>
    </div>
    <div class="panel"><h3>ℹ️ 设计说明</h3><p class="note">数学奇境用于保持兴趣并自然拓展：课本知识练熟后，继续接触数学史、生活数学与思维方法。这里不设每日任务和连续打卡，孩子随时想来都可以。金币和转盘券与语文、英语互通。</p></div>`;
  $("#tm0").onclick = () => { S.testMode = false; CIVS.forEach(c => { if (c.locked) delete S.unlocked[c.id]; }); save(); renderParent(scr); };
  $("#tm1").onclick = () => { S.testMode = true; CIVS.forEach(c => S.unlocked[c.id] = true); save(); renderParent(scr); };
}

/* ---------- 导航 ---------- */
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => { nav = []; sess = null; S.view = b.dataset.v; render(); });
$("#backBtn").onclick = () => { sess = null; back(); };
document.addEventListener("visibilitychange", () => { if (!document.hidden) paintPurse(); });

/* ---------- 启动 ---------- */
walletIn();
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
