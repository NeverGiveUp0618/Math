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
const CARD_DAILY_KEY = "sharedCardDaily_v1";
const JOURNEY_KEY = "sharedLearningJourney_v1";
const CARD_DAILY_LIMIT = 5;
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
    attempts: {},           // skillId -> {right,total,streak,lastWrong}
    timeLog: {},            // date -> {map,core,extend,challenge,exam} 秒数
    exams: {},              // book -> [{date,right,total}]
    scratchDrafts: {},      // 当前题草稿图片
    totalRight: 0,          // 累计做对题数（成就）
    tier: 1,                // 📏 当前难度档 1~5，跟着每轮成绩自动升降
    tierLock: false,        // 家长可锁死，不再自动调
    tierLog: [],            // 最近几次调档记录，家长后台看得见
    pk: { win:0, lose:0, draw:0, plays:0, rounds:0, roundWin:0, duo:0, handicap:0, streakWin:0, streakLose:0 },  // ⚔️ 擂台战绩（只累加，不掉段）
    gameWins: {},           // 🧩 思维游戏 id -> 通关次数
    ladderDone: {},         // 🌱 走完「课本→进阶→发散」三段的思维题
    testMode: false
  };
}
let S = defState();
try { const raw = localStorage.getItem(LS_KEY); if (raw) S = Object.assign(defState(), JSON.parse(raw)); } catch (e) {}
S.daily = Object.assign({ date: todayStr(), correct: 0 }, S.daily);
S.attempts = S.attempts || {}; S.timeLog = S.timeLog || {}; S.exams = S.exams || {}; S.scratchDrafts = S.scratchDrafts || {};
S.pk = Object.assign({ win:0, lose:0, draw:0, plays:0, rounds:0, roundWin:0, duo:0, handicap:0, streakWin:0, streakLose:0 }, S.pk); S.gameWins = S.gameWins || {}; S.ladderDone = S.ladderDone || {};
S.tier = Math.min(5, Math.max(1, Number(S.tier) || 1)); S.tierLog = Array.isArray(S.tierLog) ? S.tierLog : [];
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
function mathCardDaily(){let d=null;try{d=JSON.parse(localStorage.getItem(CARD_DAILY_KEY)||"null")}catch(e){}if(!d||d.date!==todayStr())d={date:todayStr(),english:0,chinese:0,math:0,pendingChinese:0,pendingMath:0};["english","chinese","math","pendingChinese","pendingMath"].forEach(k=>d[k]=Math.max(0,Number(d[k])||0));return d;}
function grantMathCard(){const d=mathCardDaily();if(d.math>=CARD_DAILY_LIMIT)return false;d.math++;d.pendingMath++;try{localStorage.setItem(CARD_DAILY_KEY,JSON.stringify(d))}catch(e){}return true;}
const SUBJECT_BALANCE_KEY="sharedSubjectBalance_v1";
function markBalancedSubject(subject){let d=null;try{d=JSON.parse(localStorage.getItem(SUBJECT_BALANCE_KEY)||"null")}catch(e){}if(!d||d.date!==todayStr())d={date:todayStr(),en:false,cn:false,ma:false,two:false,three:false};const first=!d[subject];d[subject]=true;const count=[d.en,d.cn,d.ma].filter(Boolean).length,two=count>=2&&!d.two,three=count===3&&!d.three;if(two)d.two=true;if(three)d.three=true;try{localStorage.setItem(SUBJECT_BALANCE_KEY,JSON.stringify(d))}catch(e){}return{first,two,three,count}}
function queueBalancedCard(){const d=mathCardDaily();d.pendingBalance=Math.max(0,Number(d.pendingBalance)||0)+1;try{localStorage.setItem(CARD_DAILY_KEY,JSON.stringify(d))}catch(e){}}

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
  grantMathCard();
  save();
  if(S.daily.correct===5){const r=markBalancedSubject("ma");if(r.first){addCoins(20);toast("🔭 今天首次做对5题，+20金币");if(r.two){addTickets(1);setTimeout(()=>toast("🎟️ 今天已探索两个学科，+1转盘券"),700)}if(r.three){queueBalancedCard();setTimeout(()=>toast("🌟 三科探索完成！限定白白卡已送往英语收藏册"),1400)}}}
}
function markAttempt(id, ok) {
  if (!id) return;
  const a = S.attempts[id] || { right:0,total:0,streak:0,lastWrong:"" };
  a.total++; if (ok) { a.right++; a.streak++; } else { a.streak=0; a.lastWrong=todayStr(); }
  S.attempts[id]=a; save();
}
function weakSkills(civ) {
  const skills=(civ?ST(civ).core:ALL_SKILLS());
  return skills.filter(x=>{const a=S.attempts[x.id];return a&&a.total>=2&&a.right/a.total<.75;}).sort((a,b)=>(S.attempts[a.id].right/S.attempts[a.id].total)-(S.attempts[b.id].right/S.attempts[b.id].total));
}


/* ---------- 📏 难度梯度（2026-09-02） ----------
 * 孩子反馈「有点难」。两条腿：
 *   ① poolForTier：低档只出低难度知识点，档位不够就退而取最简单的一半
 *   ② 一轮之内 sortByLv：先易后难，前几题先把信心立起来
 * 档位由 adjustTier 按每轮正确率自动升降，家长可在后台锁死。
 */
function skillLv(sk) {
  if (!sk) return 3;
  if (typeof sk.lv === "number") return sk.lv;                    // 热身口算自带
  if (SKILL_LV[sk.id]) return SKILL_LV[sk.id];
  const civ = CIVS.find(c => ((STATIONS[c.id] || {}).core || []).some(x => x.id === sk.id));
  return civ ? ({ "三上":2, "三下":2, "四上":3, "四下":3, "五上":4, "五下":4, "六上":5, "六下":5 }[civ.book] || 3) : 3;
}
function ALL_SKILLS() { return Object.values(STATIONS).flatMap(s => s.core).concat(WARMUP_SKILLS); }
function sortByLv(list) { return list.slice().sort((a, b) => skillLv(a) - skillLv(b)); }
function tierInfo() { return TIERS[Math.min(5, Math.max(1, S.tier)) - 1]; }
/* 按档位筛池：够 3 个就用筛出来的，不够就取整池里最简单的一半（宁可简单也别卡住） */
function poolForTier(pool, tier) {
  if (!pool || !pool.length) return [];
  const t = tier || S.tier;
  const fit = pool.filter(s => skillLv(s) <= t);
  if (fit.length >= 3) return fit;
  return sortByLv(pool).slice(0, Math.max(3, Math.ceil(pool.length / 2)));
}
/* 一轮结束按正确率调档。返回 "up"/"down"/null，调用方负责说人话。 */
function adjustTier(right, total) {
  if (S.tierLock || total < 5) return null;
  const rate = right / total;
  let moved = null;
  if (rate >= 0.85 && S.tier < 5) { S.tier++; moved = "up"; }
  else if (rate <= 0.45 && S.tier > 1) { S.tier--; moved = "down"; }
  if (moved) {
    S.tierLog.push({ date: todayStr(), to: S.tier, rate: Math.round(rate * 100) });
    S.tierLog = S.tierLog.slice(-12);
    save();
  }
  return moved;
}
function tierMovedNote(moved) {
  if (!moved) return "";
  const t = tierInfo();
  return moved === "up"
    ? `<div class="tiernote up">${t.icon} 这轮做得很稳，白白把难度调到「${esc(t.name)}」了 —— ${esc(t.blurb)}</div>`
    : `<div class="tiernote down">${t.icon} 白白把难度调回「${esc(t.name)}」了 —— ${esc(t.blurb)}。慢慢来，题会跟着你走。</div>`;
}
function tierChip() { const t = tierInfo(); return `<span class="tierchip">${t.icon} 难度：${esc(t.name)}</span>`; }

/* ---------- SRS ---------- */
/* 🌱 热身口算是个「假站」：只在 app 里存在，不进 STATIONS，
   免得全站结构体检（labels/extend/challenge 三件套）把它当成缺字段的文明站。 */
const WARMUP_STATION = { labels: { core: "🌱 热身口算 · 先把底子练熟，题目都很短", extend: "", challenge: "" },
  core: WARMUP_SKILLS, extend: { cards: [], tricks: [], play: [] }, challenge: [] };
const ST = civ => { const id = civ || S.civ; return id === "warmup" ? WARMUP_STATION : STATIONS[id]; };   // 当前文明站内容
function srsDueList(civ) { const t = todayStr(); const st = ST(civ); if (!st) return []; return st.core.filter(s => { const r = S.srs[s.id]; return r && r.due <= t; }); }
function srsDueAll() { const t = todayStr(); return ALL_SKILLS().filter(s => { const r = S.srs[s.id]; return r && r.due <= t; }); }
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

function loadSharedPet(){try{return JSON.parse(localStorage.getItem("sharedPet_v1")||"null")||{}}catch(e){return{}}}
function petBody(){const b=String(loadSharedPet().body||"");return /^https:\/\/nevergiveup0618\.github\.io\/English\/assets\/(?:baibai-base\.png|poses\/pose-\d{2}\.webp)$/.test(b)?b:"assets/baibai-base.png";}
function safeNum(v,d,min,max){v=Number(v);return Number.isFinite(v)?Math.max(min,Math.min(max,v)):d;}
function baibaiAvatar(cls){const p=loadSharedPet(),layers=(p.items||[]).slice(0,20).map(it=>{const art=String(it.art||""),safe=/^https:\/\/nevergiveup0618\.github\.io\/English\/assets\/outfits\/[a-z0-9-]+\.(?:svg|webp)$/.test(art),x=safeNum(it.x,50,0,100),y=safeNum(it.y,50,0,100),s=safeNum(it.s,1,.3,3),r=safeNum(it.r,0,-360,360),base=safeNum(it.base,.3,.2,1.2);return `<span class="pet-layer" style="left:${x}%;top:${y}%;width:${Math.round(base*s*100)}%;transform:translate(-50%,-50%) rotate(${r}deg)">${safe?`<img src="${art}" alt="">`:esc(it.e||"")}</span>`}).join("");return `<span class="math-baibai ${cls||""}"><img class="pet-body" src="${petBody()}" alt="白白">${layers}</span>`;}

let activeModule="map", activeAt=Date.now();
let journeyScreen="",journeyAt=Date.now();
function flushJourney(){if(!journeyScreen)return;const seconds=Math.min(1800,Math.round((Date.now()-journeyAt)/1000));if(seconds<2)return;try{const rows=JSON.parse(localStorage.getItem(JOURNEY_KEY)||"[]");rows.push({subject:"ma",screen:journeyScreen,day:todayStr(),seconds,at:Date.now()});localStorage.setItem(JOURNEY_KEY,JSON.stringify(rows.slice(-500)));}catch(e){}journeyAt=Date.now();}
function journeyView(id){if(id===journeyScreen)return;flushJourney();journeyScreen=id;journeyAt=Date.now();}
function trackTime(next){const now=Date.now(),sec=Math.min(120,Math.max(0,Math.round((now-activeAt)/1000))),d=S.timeLog[todayStr()]||(S.timeLog[todayStr()]={map:0,core:0,extend:0,challenge:0,exam:0});d[activeModule]=(d[activeModule]||0)+sec;activeModule=next||S.view;activeAt=now;if(sec)save();}

function scratchPadHtml() {
  return `<div class="scratch"><button class="scratch-toggle" type="button">✏️ 需要时打开无限草稿纸</button><div class="scratch-body hidden"><div class="scratch-tools"><button type="button" data-tool="pen">✏️ 铅笔</button><button type="button" data-tool="eraser">🧽 橡皮</button><button type="button" data-tool="pan" class="on">✋ 拖动画布</button><button type="button" data-tool="undo">撤销</button><button type="button" data-tool="clear">清空笔迹</button><button type="button" data-zoom="out">－ 缩小</button><button type="button" data-zoom="in">＋ 放大</button><button type="button" data-zoom="reset">◎ 回中心</button><button type="button" data-template="blank">空白纸</button><button type="button" data-template="grid" class="on">方格</button><button type="button" data-template="vertical">竖式</button><button type="button" data-template="fraction">分数</button><button type="button" data-template="numberline">数轴</button></div><div class="scratch-tip">默认是拖动画布；需要书写时再点“铅笔”。可以缩放，橡皮只擦笔迹。</div><div class="scratch-viewport is-panning"><div class="scratch-world grid"><canvas width="2048" height="1536" aria-label="可拖动并缩放的无限草稿区"></canvas></div></div></div></div>`;
}
function scratchKey(){return `${S.view}:${S.civ||"all"}:${examSess?examSess.book+":"+examSess.i:sess?sess.mode+":"+sess.i:S.sub||0}`;}
function bindScratchPad(root) {
  const box = root.querySelector(".scratch"); if (!box) return;
  const body = box.querySelector(".scratch-body"), canvas = box.querySelector("canvas"), world=box.querySelector(".scratch-world"), viewport=box.querySelector(".scratch-viewport");
  box.querySelector(".scratch-toggle").onclick = () => body.classList.toggle("hidden");
  if (/jsdom/i.test(navigator.userAgent || "")) return;
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  let drawing=false,panning=false,tool="pan",strokes=[],currentStroke=null,panStart=null,baseImage=null,saveJob=null;const key=scratchKey(),prior=S.scratchDrafts[key];
  let offset={x:0,y:0},zoom=1,template="grid";
  const clamp=()=>{const vw=viewport.clientWidth,vh=viewport.clientHeight,ww=canvas.width*zoom,wh=canvas.height*zoom;offset.x=Math.min(0,Math.max(vw-ww,offset.x));offset.y=Math.min(0,Math.max(vh-wh,offset.y));};
  const place=()=>{clamp();world.style.transformOrigin="0 0";world.style.transform=`translate(${offset.x}px,${offset.y}px) scale(${zoom})`;};
  const center=()=>{offset={x:Math.round((viewport.clientWidth-canvas.width*zoom)/2),y:Math.round((viewport.clientHeight-canvas.height*zoom)/2)};place();};
  requestAnimationFrame(()=>{if(prior&&typeof prior==='object'&&prior.offset){offset=prior.offset;zoom=Math.max(.45,Math.min(2.25,Number(prior.zoom)||1));place();}else center();});
  if(prior){const src=typeof prior==='string'?prior:prior.image;template=typeof prior==='object'&&prior.template||"grid";world.className=`scratch-world ${template}`;box.querySelectorAll("[data-template]").forEach(b=>b.classList.toggle("on",b.dataset.template===template));if(src){const img=new Image();img.onload=()=>{baseImage=img;ctx.drawImage(img,0,0)};img.src=src;}}
  const remember=()=>{try{S.scratchDrafts[key]={image:canvas.toDataURL("image/webp",.68),template,offset:{...offset},zoom};const keys=Object.keys(S.scratchDrafts);while(keys.length>12)delete S.scratchDrafts[keys.shift()];localStorage.setItem(LS_KEY,JSON.stringify(S));}catch(e){}};
  const scheduleRemember=()=>{if(saveJob!==null){if(window.cancelIdleCallback)cancelIdleCallback(saveJob);else clearTimeout(saveJob);}const save=()=>{saveJob=null;remember()};saveJob=window.requestIdleCallback?requestIdleCallback(save,{timeout:1800}):setTimeout(save,500);};
  const paintStroke=s=>{if(s.tool==="clear"){ctx.clearRect(0,0,canvas.width,canvas.height);return;}if(!s.points.length)return;ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=s.tool==="eraser"?30:4;ctx.globalCompositeOperation=s.tool==="eraser"?"destination-out":"source-over";ctx.strokeStyle="#655474";ctx.beginPath();ctx.moveTo(s.points[0][0],s.points[0][1]);for(let i=1;i<s.points.length;i++)ctx.lineTo(s.points[i][0],s.points[i][1]);ctx.stroke();ctx.restore();};
  const repaint=()=>{ctx.clearRect(0,0,canvas.width,canvas.height);if(baseImage)ctx.drawImage(baseImage,0,0);strokes.forEach(paintStroke);};
  box.querySelectorAll("[data-tool]").forEach(b => b.onclick = () => {
    if (b.dataset.tool === "clear") { strokes.push({tool:"clear",points:[]});repaint();scheduleRemember();return; }
    if (b.dataset.tool === "undo") { if(strokes.length)strokes.pop();repaint();scheduleRemember();return; }
    tool=b.dataset.tool;box.querySelectorAll("[data-tool]").forEach(x=>x.classList.toggle("on",x===b));viewport.classList.toggle("is-panning",tool==="pan");
  });
  box.querySelectorAll("[data-template]").forEach(b=>b.onclick=()=>{template=b.dataset.template;world.className=`scratch-world ${template}`;box.querySelectorAll("[data-template]").forEach(x=>x.classList.toggle("on",x===b));scheduleRemember();});
  box.querySelectorAll("[data-zoom]").forEach(b=>b.onclick=()=>{const old=zoom,vw=viewport.clientWidth,vh=viewport.clientHeight;if(b.dataset.zoom==="reset"){zoom=1;center();}else{zoom=Math.max(.45,Math.min(2.25,+(zoom+(b.dataset.zoom==="in"?.2:-.2)).toFixed(2)));offset.x=vw/2-(vw/2-offset.x)*zoom/old;offset.y=vh/2-(vh/2-offset.y)*zoom/old;place();}scheduleRemember();});
  const point = e => { const r = canvas.getBoundingClientRect(), p = e.touches ? e.touches[0] : e; return [(p.clientX-r.left)*canvas.width/r.width,(p.clientY-r.top)*canvas.height/r.height]; };
  const start=e=>{if(tool==="pan"){panning=true;panStart={x:e.clientX-offset.x,y:e.clientY-offset.y};canvas.setPointerCapture?.(e.pointerId);e.preventDefault();return;}drawing=true;const p=point(e);currentStroke={tool,points:[p]};ctx.save();ctx.lineCap="round";ctx.lineJoin="round";ctx.lineWidth=tool==="eraser"?30:4;ctx.globalCompositeOperation=tool==="eraser"?"destination-out":"source-over";ctx.strokeStyle="#655474";ctx.beginPath();ctx.moveTo(p[0],p[1]);canvas.setPointerCapture?.(e.pointerId);e.preventDefault();};
  const move=e=>{if(panning){offset={x:e.clientX-panStart.x,y:e.clientY-panStart.y};place();e.preventDefault();return;}if(!drawing)return;const p=point(e);currentStroke.points.push(p);ctx.lineTo(p[0],p[1]);ctx.stroke();e.preventDefault();};
  const stop=e=>{if(panning){panning=false;scheduleRemember();}if(drawing){drawing=false;ctx.restore();if(currentStroke&&currentStroke.points.length>1)strokes.push(currentStroke);currentStroke=null;scheduleRemember();}try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){}};
  canvas.addEventListener("pointerdown",start);canvas.addEventListener("pointermove",move);canvas.addEventListener("pointerup",stop);canvas.addEventListener("pointercancel",stop);
}
function baibaiTip(text) { return `<div class="baibai-tip"><img src="assets/baibai-base.png" alt="白白"><span>${text}</span></div>`; }

let nav = []; // 面包屑视图栈，用于返回
try { history.scrollRestoration="manual"; } catch(e) {}
function restoreMathScroll(y){if(/jsdom/i.test(navigator.userAgent||""))return;const top=Math.max(0,Number(y)||0),restore=()=>window.scrollTo(0,top);restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore)});}
function go(view, opts) { trackTime(view); nav.push({ view: S.view, civ: S.civ, sub: S.sub, scrollY:window.scrollY }); S.view = view; Object.assign(S, opts || {}); render(); restoreMathScroll(0); }
function back() { trackTime(); const p = nav.pop(); if (p) { S.view = p.view; S.civ = p.civ; S.sub = p.sub; } else S.view = "map"; activeModule=S.view; render(); restoreMathScroll(p&&p.scrollY); }

/* ============================================================ 渲染 ============================================================ */
function render() {
  journeyView(S.view);
  paintPurse();
  const scr = $("#screen");
  $("#backBtn").classList.toggle("hidden", ["map","review","rewards","pk","think"].includes(S.view));
  $("#learningHome").classList.toggle("hidden", !["map","review","exam","rewards","pk","think"].includes(S.view));
  clearPkTimers();
  document.querySelectorAll("#nav button").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
  if (S.view === "map") return renderMap(scr);
  if (S.view === "station") return renderStation(scr);
  if (S.view === "core") return renderCore(scr);
  if (S.view === "extend") return renderExtend(scr);
  if (S.view === "challenge") return renderChallengeList(scr);
  if (S.view === "challengeRun") return renderChallenge(scr);
  if (S.view === "review") return renderReview(scr);
  if (S.view === "exam") return renderExam(scr);
  if (S.view === "rewards") return renderRewards(scr);
  if (S.view === "pk") return renderPk(scr);
  if (S.view === "pkRun") return renderPkRun(scr);
  if (S.view === "think") return renderThink(scr);
  if (S.view === "thinkGame") return renderThinkGame(scr);
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
  const weak=weakSkills(),recommend=weak.length?`白白发现「${esc(weak[0].name)}」值得再试一次。不是退步，是大脑正在长新路。`:`今天没有必须完成的内容，挑一个好奇的地方就行。`;
  scr.innerHTML = `<div class="map-hero"><h2>今天想解开哪个数学秘密？</h2><p>从课本出发，再多走一步。每一次尝试都算一次新发现。</p></div><div class="guide baibai">${baibaiAvatar()}<div class="bubble">${greet}</div></div>
    <div class="recommend"><b>🐾 白白的小建议</b><span>${recommend}</span><button class="btn" id="examBtn">📝 阶段测验</button></div>
    <div class="tierbar">${tierChip()}<span class="tiertip">题目会自己跟着你的水平走${S.tierLock ? "（家长已锁定）" : ""}</span><button class="btn" id="warmBtn">🌱 热身口算</button></div>
    <div class="wonderbar"><div class="t">🏺 数学奇观收藏（集齐一站的三颗星就能点亮）</div><div class="row">${wrow}</div></div>
    ${civs}<button class="math-parent-entry" id="mathParentEntry">🔐 家长设置</button>`;
  scr.querySelectorAll(".civ[data-civ]").forEach(el => el.onclick = () => go("station", { civ: el.dataset.civ }));
  $("#examBtn").onclick=()=>go("exam");
  $("#warmBtn").onclick=()=>{sess=null;go("core",{civ:"warmup"});};
  $("#mathParentEntry").onclick=()=>go("parent");
}

/* ---------- 站内三层 ---------- */
function renderStation(scr) {
  const c = CIVS.find(x => x.id === S.civ);
  $("#title").textContent = c.name;
  const station = ST();
  scr.className = "depths";
  if (!station) {  // 该文明内容还没铺好
    scr.innerHTML = `<div class="guide baibai">${baibaiAvatar()}<div class="bubble">这座 <b>${c.name}</b> 文明还在铺路，很快就能来探险。</div></div>`;
    return;
  }
  const st = stStars(S.civ), L = station.labels;
  scr.innerHTML = `
    <div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">白白找到一条新线索</div>${esc(c.blurb)}</div></div>
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
/* 排一轮的出题计划：按当前难度档筛池，到期复习和薄弱点优先占坑，
   最后整轮按难度从易到难排 —— 前几题先把信心立起来。 */
function buildPlan(pool, n, civ) {
  const fit = poolForTier(pool, S.tier);
  if (!fit.length) return [];
  const picks = [];
  const push = s => { if (s && fit.includes(s) && picks.length < Math.ceil(n / 2) && !picks.includes(s)) picks.push(s); };
  srsDueList(civ).forEach(push);
  weakSkills(civ).forEach(push);
  while (picks.length < n) picks.push(fit[Math.floor(Math.random() * fit.length)]);
  return sortByLv(picks.slice(0, n));
}
function renderCore(scr) {
  $("#title").textContent = ST(S.civ) === WARMUP_STATION ? "热身口算" : "课内夯实";
  if (!sess || sess.mode !== "core") {
    const pool = ST(S.civ).core;
    sess = { mode: "core", civ: S.civ, i: 0, n: 8, right: 0, cur: null, revealed: false, plan: buildPlan(pool, 8, S.civ) };
  }
  nextCore(scr);
}
function nextCore(scr) {
  if (sess.i >= sess.n) return coreDone(scr);
  // 计划在开轮时就排好了（按难度从易到难），这里按顺序取
  const pool = ST(sess.civ).core;
  const skill = (sess.plan && sess.plan[sess.i]) || pool[Math.floor(Math.random() * pool.length)];
  const prob = skill.gen();
  sess.cur = { skill, prob, isDue: !!(S.srs[skill.id] && S.srs[skill.id].due <= todayStr()) };
  sess.revealed = false;
  scr.className = "stage";
  scr.innerHTML = `<div class="progress"><i style="width:${sess.i / sess.n * 100}%"></i></div>
    <div class="qcard">
      <div class="qmeta"><span>${skill.icon} ${skill.name}${sess.cur.isDue ? " · 复习" : ""}</span><span>${"◆".repeat(skillLv(skill))}<span style="opacity:.35">${"◇".repeat(5 - skillLv(skill))}</span> · 第 ${sess.i + 1}/${sess.n} 题</span></div>
      <div class="qtext">${prob.q}</div>
      <div class="answerbox"><input id="ans" type="number" inputmode="numeric" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}
      <div class="feedback" id="fb"></div>
    </div>
    <button class="btn ghost wide hidden" id="nextb">下一题 ›</button>`;
  const input = $("#ans");
  bindScratchPad(scr);
  let tries = 0;
  const submit = () => {
    if (sess.revealed) return;
    const v = input.value.trim();
    if (v === "") return;
    const val = Number(v), ok = val === prob.a;
    const fb = $("#fb");
    if (!ok && tries++ === 0) {
      const why = prob.trap && val === prob.trap.val ? `我猜你是——${prob.trap.why}。` : "";
      fb.className = "feedback no show";
      fb.innerHTML = `先不公布答案。${why}${why ? "<br>" : ""}${prob.hint || "换一种方法，在草稿纸上再试一步。"}<br><b>你还可以再答一次。</b>`;
      input.value = "";
      return;
    }
    sess.revealed = true;
    markAttempt(skill.id,ok);
    srsGrade(skill.id, ok);
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
  const passed = sess.right >= 6, civ = sess.civ;
  if (passed && civ !== "warmup") setStar(civ, "core");
  const moved = adjustTier(sess.right, sess.n);
  const c = CIVS.find(x => x.id === civ);
  scr.className = "stage";
  scr.innerHTML = `<div class="qcard" style="text-align:center">
    <div style="font-size:52px">${passed ? "🏆" : "💪"}</div>
    <div class="qtext">这一轮做对 ${sess.right}/${sess.n} 题</div>
    <p style="font-size:14px;opacity:.8;line-height:1.6">${civ === "warmup" ? (passed ? "口算又快又准，底子稳了！" : "口算多练几轮就顺了，不着急～") : passed ? "课本练得又快又准，课内夯实这颗星拿下！" : "答对 6 题就能点亮这颗星，再来一轮就好～"}</p>
    ${tierMovedNote(moved)}
    <button class="btn wide" id="again">再练一轮</button>
    <button class="btn ghost wide" id="back">${c ? "回到" + esc(c.name) : "返回"}</button></div>`;
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
  scr.innerHTML = `<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">白白的课外发现</div>先随便读一张感兴趣的卡，再动手玩一玩。</div></div>
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
  scr.innerHTML = `<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">慢慢想也很厉害</div>这里不比速度。可以画一画、试一试，实在想不出再看提示。</div></div>${list}
    <button class="btn ghost wide" id="toThink">🧩 去思维乐园：看全部 ${ALL_CHALLENGES().length} 道思维题 + 6 个动手游戏</button>`;
  $("#toThink").onclick = () => { nav = []; S.view = "think"; render(); };
  scr.querySelectorAll(".readcard[data-i]").forEach(el => el.onclick = () => { chStep = 0; go("challengeRun", { sub: Number(el.dataset.i) }); });
}
/* 思维题走三段：📘 课本这一招 → 🧠 进阶挑战 → 🌱 再想远一点。
   用户要求「靠到教材的知识点上，再进阶，再发散」，chStep 就是这三段的游标。 */
let chStep = 0;
function renderChallenge(scr) {
  const civ = S.civ, c = ST(civ).challenge[S.sub], L = CHALLENGE_LADDER[c.id];
  if (!L) chStep = 1;                                  // 万一哪道新题还没配阶梯，直接走原来的挑战
  if (chStep === 0) return renderChAnchor(scr, c, L);
  if (chStep === 2) return renderChOut(scr, c, L);
  return renderChMain(scr, civ, c, L);
}

/* ① 📘 课本这一招：先确认这道挑战靠在哪个教材知识点上 */
function renderChAnchor(scr, c, L) {
  $("#title").textContent = c.name;
  scr.className = "stage";
  scr.innerHTML = `<div class="ladderbar"><span class="on">📘 课本这一招</span><span>🧠 进阶挑战</span><span>🌱 再想远一点</span></div>
    <div class="qcard">
      <div class="qmeta"><span>📘 ${esc(L.unit)}</span><span>${"⭐".repeat(c.star)}</span></div>
      <div class="anchortag">这道挑战用的是课本上的：<b>${esc(L.point)}</b></div>
      <div class="qtext" style="font-size:20px">${L.anchor.q}</div>
      <div class="answerbox"><input id="ans" type="number" inputmode="decimal" placeholder="先做这一步" autocomplete="off"><button class="btn" id="ok">确定</button></div>
      <div class="feedback" id="fb"></div>
      <button class="btn wide hidden" id="goMain">好，去挑战 ›</button>
      <button class="btn ghost wide" id="skip">这一步我会了，直接挑战 ›</button>
    </div>`;
  let done = false;
  const pass = ok => {
    if (done) return; done = true;
    const fb = $("#fb");
    fb.className = `feedback ${ok ? "ok" : "no"} show`;
    fb.innerHTML = `${ok ? "对！" : `这一步的答案是 <b>${L.anchor.a}</b>。`}${L.anchor.why}`;
    $("#ans").disabled = true; $("#ok").classList.add("hidden");
    $("#skip").classList.add("hidden"); $("#goMain").classList.remove("hidden");
    if (ok) { addCoins(1); markCorrect(); }
  };
  const submit = () => { const v = $("#ans").value.trim(); if (v === "") return; pass(Number(v) === L.anchor.a); };
  $("#ok").onclick = submit;
  $("#ans").onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#skip").onclick = () => { chStep = 1; render(); };
  $("#goMain").onclick = () => { chStep = 1; render(); };
}

/* ② 🧠 进阶挑战：原来那道思维题 */
function renderChMain(scr, civ, c, L) {
  $("#title").textContent = c.name;
  scr.className = "stage";
  let body;
  if (c.type === "choice") {
    body = `<div class="opts">${c.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join("")}</div>`;
  } else {
    body = `<div class="answerbox"><input id="ans" type="number" inputmode="numeric" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}`;
  }
  scr.innerHTML = `${L ? `<div class="ladderbar"><span class="done">📘 课本这一招</span><span class="on">🧠 进阶挑战</span><span>🌱 再想远一点</span></div>` : ""}
  <div class="qcard">
    <div class="qmeta"><span>${c.icon} ${esc(c.name)}</span><span>${"⭐".repeat(c.star)}</span></div>
    ${L ? `<div class="anchortag">同一招再往前一步：<b>${esc(L.point)}</b>（${esc(L.unit)}）</div>` : ""}
    <div class="qtext" style="font-size:18px;text-align:left;line-height:1.6">${c.q}</div>
    ${body}
    <div class="feedback" id="fb"></div>
    <div class="hints" id="hints"></div>
    <button class="btn ghost wide" id="hintBtn">🤔 想不出？看一条思路</button>
    <div class="bigidea hidden" id="big"><div class="t">💡 解题大招</div>${c.big}</div>
    <button class="btn wide hidden" id="doneb">${L ? "再想远一点 ›" : "破解啦，返回 ›"}</button>
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
  $("#doneb").onclick = () => { if (L) { chStep = 2; render(); } else back(); };
}

/* ③ 🌱 再想远一点：开放追问，不判对错 —— 目的是敢想，不是再考一次 */
function renderChOut(scr, c, L) {
  $("#title").textContent = c.name;
  scr.className = "stage";
  scr.innerHTML = `<div class="ladderbar"><span class="done">📘 课本这一招</span><span class="done">🧠 进阶挑战</span><span class="on">🌱 再想远一点</span></div>
    <div class="qcard">
      <div class="qmeta"><span>🌱 发散一下</span><span>不判对错</span></div>
      <div class="qtext" style="font-size:18px;text-align:left;line-height:1.65">${L.out.q}</div>
      <div class="outnote">先自己想一会儿，也可以说给爸爸妈妈听。想好了再看白白的想法 —— <b>想得跟白白不一样也很好</b>。</div>
      <button class="btn wide" id="showIdea">看看白白怎么想 ›</button>
      <div class="bigidea hidden" id="idea"><div class="t">🐾 白白的想法</div>${L.out.idea}</div>
      <button class="btn ghost wide hidden" id="outBack">想完了，返回 ›</button>
    </div>`;
  $("#showIdea").onclick = () => {
    $("#idea").classList.remove("hidden");
    $("#showIdea").classList.add("hidden");
    $("#outBack").classList.remove("hidden");
    if (!S.ladderDone[c.id]) { S.ladderDone[c.id] = true; addCoins(3); toast("走完三段阶梯 +3 🪙"); save(); }
  };
  $("#outBack").onclick = () => { chStep = 0; back(); };
}


/* ============================================================
 * ⚔️ PK 擂台
 * 2026-09-02 重做，起因是孩子反馈「人机对战看着假，机器人反应太快，赢不了」。
 * 对手是模拟的，但会打招呼、会卡壳、会算错、会认输；速度大幅放慢；
 * 计分以答对为主（12 分）速度为辅（4 分）；连输还会自动放水。
 * ============================================================ */
let pkSess = null, pkTimers = [];
function clearPkTimers() { pkTimers.forEach(t => clearTimeout(t)); pkTimers = []; }
const PK_BOOKS = ["适合我", "🌱 热身", "三上", "三下", "四上", "四下", "五上", "五下", "六上", "六下"];
function pkPool(book) {
  if (book === "🌱 热身") return WARMUP_SKILLS;
  if (book === "适合我") {           // 跟着当前难度档走：全站够得着的知识点 + 热身垫底
    const reach = CIVS.flatMap(c => (STATIONS[c.id] || { core: [] }).core).filter(s => skillLv(s) <= S.tier);
    return (S.tier <= 2 ? WARMUP_SKILLS : []).concat(reach.length ? reach : WARMUP_SKILLS);
  }
  return bookSkills(book);
}
function pkRank() { const w = S.pk.win || 0; return PK_RANKS.slice().reverse().find(r => w >= r.at) || PK_RANKS[0]; }
function pkNextRank() { const w = S.pk.win || 0; return PK_RANKS.find(r => w < r.at); }
const pkLine = k => PK_TALK[k][Math.floor(Math.random() * PK_TALK[k].length)];
/* 让分：连输就把对手调弱（算得更慢、更容易错），连赢再调回来。范围 -2 ~ +1。
   这是「赢不了」那条反馈的正面解法 —— 不改题目难度，改对手。 */
function pkRival(base) {
  const h = Math.max(-2, Math.min(1, S.pk.handicap || 0));
  return Object.assign({}, base, {
    acc: Math.max(.2, Math.min(.95, base.acc + h * 0.12)),
    fast: Math.round(base.fast * (1 - h * 0.18)),
    slow: Math.round(base.slow * (1 - h * 0.18)),
    handicap: h
  });
}

function renderPk(scr) {
  $("#title").textContent = "PK 擂台";
  scr.className = "stage"; nav = []; pkSess = null; clearPkTimers();
  const rank = pkRank(), nxt = pkNextRank(), p = S.pk;
  const rivals = PK_RIVALS.map(r => {
    const adj = pkRival(r);
    return `<div class="rival" data-r="${r.id}">
      <div class="ico">${r.icon}</div>
      <div class="info"><div class="nm">${esc(r.name)}<span class="lvl">${"🔥".repeat(PK_RIVALS.indexOf(r) + 1)}</span></div>
        <div class="ti">${esc(r.title)}</div><div class="bl">${esc(r.blurb)}</div>
        <div class="sp">大约 ${Math.round(adj.fast / 1000)}～${Math.round(adj.slow / 1000)} 秒交一题${adj.handicap < 0 ? "（今天状态一般）" : adj.handicap > 0 ? "（最近很来劲）" : ""}</div></div>
      <div class="go">对战 ›</div></div>`;
  }).join("");
  scr.innerHTML = `<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">想比一场吗？</div>擂台上一共 8 题。<b>答对 12 分是大头，先交卷只多 4 分</b> —— 算得慢但算得对，照样赢。<div class="soft">输了也有金币。连输两场，对手会自动放水。</div></div></div>
    <div class="rankcard"><div class="rk">${rank.icon}</div><div><div class="rkn">${esc(rank.name)}</div>
      <div class="rks">赢过 <b>${p.win}</b> 场 · 打平 <b>${p.draw}</b> · 惜败 <b>${p.lose}</b>${p.duo ? ` · 同屏对战 <b>${p.duo}</b> 局` : ""}</div>
      <div class="rks">${nxt ? `再赢 <b>${nxt.at - p.win}</b> 场就是「${esc(nxt.name)}」${nxt.icon}` : "已经是擂台最高段位啦 👑"}</div></div></div>
    <div class="panel"><h3>📚 出题范围 ${tierChip()}</h3><div class="exam-picks">${PK_BOOKS.map(b => `<button class="exam-pick ${(S.pkBook || "适合我") === b ? "on" : ""}" data-book="${b}">${b}<br><small>${b === "适合我" ? "跟着难度走" : pkPool(b).length + "个知识点"}</small></button>`).join("")}</div>
      <div class="note">「适合我」会按你现在的难度挑题；觉得吃力就选「🌱 热身」，全是口算。</div></div>
    <div class="panel"><h3>⚔️ 挑一个对手</h3>${rivals}</div>
    <div class="panel"><h3>👫 同屏对战</h3><div class="note">和家人、同学用同一台手机轮流答题，各 6 道，比谁答对得多。没有计时。</div>
      <button class="btn wide" id="duoBtn">两个人一起玩 ›</button></div>`;
  scr.querySelectorAll("[data-book]").forEach(b => b.onclick = () => { S.pkBook = b.dataset.book; save(); renderPk(scr); });
  scr.querySelectorAll(".rival").forEach(el => el.onclick = () => startPk(el.dataset.r));
  $("#duoBtn").onclick = () => startDuo();
}

function startPk(rivalId) {
  const base = PK_RIVALS.find(r => r.id === rivalId), book = S.pkBook || "适合我", pool = pkPool(book);
  if (!pool.length) return toast("这一册还没有题，换一个范围");
  pkSess = { mode: "solo", rival: pkRival(base), baseId: rivalId, book, pool, plan: buildPlan(pool, 8), i: 0, n: 8, me: 0, rv: 0, greeted: false };
  go("pkRun");
}
function startDuo() {
  const book = S.pkBook || "适合我", pool = pkPool(book);
  if (!pool.length) return toast("这一册还没有题，换一个范围");
  pkSess = { mode: "duo", book, pool, plan: buildPlan(pool, 12), i: 0, n: 12, a: 0, b: 0, names: ["玩家 1", "玩家 2"] };
  go("pkRun");
}

const PK_RIGHT = 12, PK_SPEED = 4;      // 答对是大头，速度只是零头 —— 算得慢也能赢

function renderPkRun(scr) {
  if (!pkSess) { S.view = "pk"; return render(); }
  clearPkTimers();
  scr.className = "stage";
  if (pkSess.mode === "duo") return duoRound(scr);
  if (pkSess.i >= pkSess.n) return pkDone(scr);
  const skill = (pkSess.plan && pkSess.plan[pkSess.i]) || pkSess.pool[Math.floor(Math.random() * pkSess.pool.length)];
  const prob = skill.gen();
  pkSess.cur = { skill, prob };
  const rival = pkSess.rival;
  const rivalOk = Math.random() < rival.acc;
  const stuck = Math.random() < 0.18;                       // 偶尔卡壳，像真人一样会想很久
  let rivalMs = rival.fast + Math.floor(Math.random() * (rival.slow - rival.fast));
  if (stuck) rivalMs = Math.round(rivalMs * 1.5);
  rivalMs = Math.max(9000, rivalMs);                        // 谁都不可能 9 秒内读完题就交卷
  const t0 = Date.now();
  let answered = false;
  $("#title").textContent = `擂台 · ${rival.name}`;
  const hello = pkSess.greeted ? "" : `<div class="rivalsay">${rival.icon} <b>${esc(rival.name)}</b>：${esc(pkLine("hello"))}</div>`;
  pkSess.greeted = true;
  scr.innerHTML = `<div class="progress"><i style="width:${pkSess.i / pkSess.n * 100}%"></i></div>
    <div class="pkbar"><div class="side me"><span>${baibaiAvatar("mini")}</span><b>${pkSess.me}</b><small>我</small></div>
      <div class="vs">VS</div>
      <div class="side rv"><span class="ric">${rival.icon}</span><b>${pkSess.rv}</b><small>${esc(rival.name)}</small></div></div>
    ${hello}
    <div class="qcard">
      <div class="qmeta"><span>${skill.icon} ${esc(skill.name)}</span><span>${"◆".repeat(skillLv(skill))}<span style="opacity:.35">${"◇".repeat(5 - skillLv(skill))}</span> · 第 ${pkSess.i + 1}/${pkSess.n} 题</span></div>
      <div class="qtext">${prob.q}</div>
      <div class="answerbox"><input id="ans" type="number" inputmode="decimal" placeholder="想好再填，不用抢" autocomplete="off"><button class="btn" id="ok">交卷</button></div>
      <div class="rivalthink" id="rvthink">${rival.icon} ${esc(rival.name)}正在读题……</div>
      ${scratchPadHtml()}
      <div class="feedback" id="fb"></div>
    </div>
    <button class="btn ghost wide hidden" id="nextb">下一题 ›</button>`;
  bindScratchPad(scr);
  /* 对手分三段推进：读题 → 打草稿 →（可能卡壳）→ 交卷。全程不剧透他答得对不对。 */
  const setThink = html => { const b = $("#rvthink"); if (b && !answered) b.innerHTML = html; };
  pkTimers.push(setTimeout(() => setThink(`${rival.icon} ${esc(rival.name)}在草稿纸上算……`), Math.round(rivalMs * 0.3)));
  if (stuck) pkTimers.push(setTimeout(() => setThink(`${rival.icon} <b>${esc(rival.name)}</b>：${esc(pkLine("stuck"))}`), Math.round(rivalMs * 0.55)));
  pkTimers.push(setTimeout(() => {
    const b = $("#rvthink"); if (b && !answered) { b.classList.add("done"); b.innerHTML = `${rival.icon} ${esc(rival.name)}交卷了 —— 别慌，<b>答对才是大头</b>。`; }
  }, rivalMs));

  const submit = () => {
    if (answered) return;
    const v = $("#ans").value.trim(); if (v === "") return;
    answered = true; clearPkTimers();
    const myMs = Date.now() - t0, ok = Number(v) === prob.a;
    const faster = myMs < rivalMs;
    let mine = 0, theirs = 0;
    if (ok) { mine = PK_RIGHT + (faster ? PK_SPEED : 0); pkSess.me += mine; markAttempt(skill.id, true); srsGrade(skill.id, true); markCorrect(); }
    else { markAttempt(skill.id, false); srsGrade(skill.id, false); }
    if (rivalOk) { theirs = PK_RIGHT + (faster ? 0 : PK_SPEED); pkSess.rv += theirs; }
    S.pk.rounds = (S.pk.rounds || 0) + 1; if (mine > theirs) S.pk.roundWin = (S.pk.roundWin || 0) + 1; save();
    const fb = $("#fb");
    fb.className = `feedback ${ok ? "ok" : "no"} show`;
    fb.innerHTML = `${ok ? `答对！<b>+${mine} 分</b>${faster ? `（还比${esc(rival.name)}快，速度分也拿到 ⚡）` : ""}` : `这题的答案是 <b>${prob.a}</b>。${prob.hint ? "<br>" + prob.hint : ""}`}
      <div class="rivalsay small">${rival.icon} <b>${esc(rival.name)}</b>：${esc(pkLine(rivalOk ? "right" : "wrong"))}${rivalOk ? `（+${theirs} 分）` : "（这题没拿到分）"}</div>`;
    $("#ans").disabled = true; $("#ok").classList.add("hidden"); $("#nextb").classList.remove("hidden");
    $("#rvthink").classList.add("hidden");
  };
  $("#ok").onclick = submit;
  $("#ans").onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#nextb").onclick = () => { pkSess.i++; renderPkRun(scr); };
}

function pkDone(scr) {
  const s = pkSess, rival = s.rival;
  const win = s.me > s.rv, draw = s.me === s.rv;
  S.pk.plays = (S.pk.plays || 0) + 1;
  if (win) S.pk.win++; else if (draw) S.pk.draw++; else S.pk.lose++;
  /* 让分：连输两场→对手放水一档；连赢三场→调回来。上下都封顶，不会滚成碾压或送分。 */
  if (win) { S.pk.streakWin = (S.pk.streakWin || 0) + 1; S.pk.streakLose = 0; }
  else if (!draw) { S.pk.streakLose = (S.pk.streakLose || 0) + 1; S.pk.streakWin = 0; }
  let handicapNote = "";
  if (S.pk.streakLose >= 2 && (S.pk.handicap || 0) > -2) { S.pk.handicap = (S.pk.handicap || 0) - 1; S.pk.streakLose = 0; handicapNote = `下一场${esc(rival.name)}会慢一点、也更容易算错 —— 白白偷偷帮你说好了。`; }
  if (S.pk.streakWin >= 3 && (S.pk.handicap || 0) < 1) { S.pk.handicap = (S.pk.handicap || 0) + 1; S.pk.streakWin = 0; handicapNote = `你连赢三场，${esc(rival.name)}要拿出真本事了。`; }
  const coin = win ? rival.coin : draw ? Math.round(rival.coin * .7) : Math.round(rival.coin * .5);
  addCoins(coin); save();
  const rank = pkRank();
  $("#title").textContent = "擂台结果";
  scr.innerHTML = `<div class="qcard" style="text-align:center">
    <div style="font-size:52px">${win ? "🏆" : draw ? "🤝" : "💪"}</div>
    <div class="qtext">${win ? "赢了这一场！" : draw ? "打成平手！" : "这场惜败"}</div>
    <div class="pkscore"><div><b>${s.me}</b><small>我</small></div><div class="vs">:</div><div><b>${s.rv}</b><small>${esc(rival.name)}</small></div></div>
    <div class="rivalsay">${rival.icon} <b>${esc(rival.name)}</b>：${esc(pkLine(win ? "lose" : draw ? "draw" : "win"))}</div>
    <p style="font-size:14px;opacity:.85;line-height:1.7"><b>+${coin} 🪙</b>${win ? "" : "（输赢都有金币）"}<br>当前段位：${rank.icon} ${esc(rank.name)}</p>
    ${handicapNote ? `<div class="tiernote down">${handicapNote}</div>` : ""}
    <button class="btn wide" id="again">再来一场</button>
    <button class="btn ghost wide" id="other">换个对手</button></div>`;
  pkSess = null; clearPkTimers();
  $("#again").onclick = () => startPk(s.baseId);
  $("#other").onclick = () => { nav = []; S.view = "pk"; render(); };
}

function duoRound(scr) {
  const s = pkSess;
  if (s.i >= s.n) {
    S.pk.duo = (S.pk.duo || 0) + 1; save(); addCoins(6);
    const who = s.a === s.b ? "平手" : (s.a > s.b ? s.names[0] : s.names[1]) + " 赢";
    $("#title").textContent = "同屏对战结果";
    scr.innerHTML = `<div class="qcard" style="text-align:center"><div style="font-size:52px">${s.a === s.b ? "🤝" : "🎉"}</div>
      <div class="qtext">${esc(who)}</div>
      <div class="pkscore"><div><b>${s.a}</b><small>${esc(s.names[0])}</small></div><div class="vs">:</div><div><b>${s.b}</b><small>${esc(s.names[1])}</small></div></div>
      <p style="font-size:14px;opacity:.85">两个人一起做完 12 道题，<b>+6 🪙</b> 进共享钱包。</p>
      <button class="btn wide" id="again">再来一局</button><button class="btn ghost wide" id="other">返回擂台</button></div>`;
    pkSess = null;
    $("#again").onclick = () => startDuo();
    $("#other").onclick = () => { nav = []; S.view = "pk"; render(); };
    return;
  }
  const turn = s.i % 2;                       // 0 号玩家先手，之后轮流
  const skill = (s.plan && s.plan[s.i]) || s.pool[Math.floor(Math.random() * s.pool.length)], prob = skill.gen();
  s.cur = { skill, prob };
  $("#title").textContent = "同屏对战";
  scr.innerHTML = `<div class="progress"><i style="width:${s.i / s.n * 100}%"></i></div>
    <div class="pkbar"><div class="side ${turn === 0 ? "turn" : ""}"><span class="ric">🐰</span><b>${s.a}</b><small>${esc(s.names[0])}</small></div>
      <div class="vs">VS</div>
      <div class="side ${turn === 1 ? "turn" : ""}"><span class="ric">🐻</span><b>${s.b}</b><small>${esc(s.names[1])}</small></div></div>
    <div class="duoturn">轮到 <b>${esc(s.names[turn])}</b> 答题（${turn === 0 ? "🐰" : "🐻"}）</div>
    <div class="qcard"><div class="qmeta"><span>${skill.icon} ${esc(skill.name)}</span><span>第 ${s.i + 1}/${s.n} 题</span></div>
      <div class="qtext">${prob.q}</div>
      <div class="answerbox"><input id="ans" type="number" inputmode="decimal" placeholder="填答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>
      ${scratchPadHtml()}<div class="feedback" id="fb"></div></div>
    <button class="btn ghost wide hidden" id="nextb">换人 ›</button>`;
  bindScratchPad(scr);
  let done = false;
  const submit = () => {
    if (done) return; const v = $("#ans").value.trim(); if (v === "") return;
    done = true; const ok = Number(v) === prob.a;
    if (ok) { if (turn === 0) s.a++; else s.b++; }
    const fb = $("#fb"); fb.className = `feedback ${ok ? "ok" : "no"} show`;
    fb.innerHTML = ok ? `${esc(s.names[turn])} 答对，得 1 分！` : `答案是 <b>${prob.a}</b>。${prob.hint ? "<br>" + prob.hint : ""}`;
    $("#ans").disabled = true; $("#ok").classList.add("hidden"); $("#nextb").classList.remove("hidden");
  };
  $("#ok").onclick = submit; $("#ans").onkeydown = e => { if (e.key === "Enter") submit(); };
  $("#nextb").onclick = () => { s.i++; duoRound(scr); };
}

/* ============================================================
 * 🧩 思维乐园
 * 55 道思维题全部汇总（不受文明解锁限制），按难度由易到难分组；
 * 外加 6 个能动手玩的游戏。每道题都走「课本 → 进阶 → 发散」三段。
 * ============================================================ */
function ALL_CHALLENGES() {
  return CIVS.flatMap(c => ((STATIONS[c.id] || {}).challenge || []).map((ch, i) => ({ ch, civ: c, i })));
}
function renderThink(scr) {
  $("#title").textContent = "思维乐园";
  scr.className = "stage"; nav = [];
  const all = ALL_CHALLENGES(), doneN = all.filter(x => S.challengeDone[x.ch.id]).length;
  const filter = S.thinkFilter || "all";
  const games = THINK_GAMES.map(g => {          // THINK_GAMES 在 data.js 里已按由易到难排好
    const n = S.gameWins[g.id] || 0;
    return `<div class="gamecard" data-g="${g.id}"><div class="gi">${g.icon}</div>
      <div class="gt"><div class="gn">${esc(g.name)} <span class="gstar">${"⭐".repeat(g.star)}</span>${n ? ` <span class="gdone">通关 ${n} 次 ✓</span>` : ""}</div>
      <div class="gs">🧠 ${esc(g.think)}</div><div class="gl">📘 ${esc(g.link)}</div></div><div class="go">开玩 ›</div></div>`;
  }).join("");
  const match = x => filter === "all" || (filter === "todo" ? !S.challengeDone[x.ch.id] : String(x.ch.star) === filter);
  /* ⭐ 由易到难：先按星级分组，组内再按册次先后排 —— 而不是按资料来源（册次）分组。
     孩子说「有点难」，很大一部分是因为列表第一道就可能是三星题。 */
  const bookOrder = b => ["三上", "三下", "四上", "四下", "五上", "五下", "六上", "六下"].indexOf(b);
  const groups = [2, 3].map(star => {
    const rows = all.filter(x => x.ch.star === star && match(x)).sort((a, b) => bookOrder(a.civ.book) - bookOrder(b.civ.book));
    if (!rows.length) return "";
    const label = star === 2 ? "⭐⭐ 入门 · 想一想就有头绪" : "⭐⭐⭐ 挑战 · 要多绕一个弯";
    return `<div class="tgroup"><div class="tgh">${label}（${rows.length} 道）</div>${rows.map(x => {
      const d = S.challengeDone[x.ch.id], L = CHALLENGE_LADDER[x.ch.id];
      return `<button class="trow ${d ? "done" : ""}" data-civ="${x.civ.id}" data-i="${x.i}">
        <span class="ti">${x.ch.icon}</span><span class="tn">${esc(x.ch.name)}<small>📘 ${esc(L ? L.unit : x.civ.book)}</small></span>
        <span class="ts">${S.ladderDone[x.ch.id] ? "三段走完 🌱" : d ? "已破解 ✓" : "去想想 ›"}</span></button>`;
    }).join("")}</div>`;
  }).join("");
  scr.innerHTML = `<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">这里不比谁快</div>动手玩的游戏在上面，动脑想的题在下面。<b>都是从易到难排的</b>，从最上面那个开始就行。<div class="soft">想不出来就看提示，看提示也算解出来。</div></div></div>
    <div class="panel"><h3>🎮 动手玩：${THINK_GAMES.length} 个思维游戏（由易到难）</h3>${games}</div>
    <div class="panel"><h3>🧠 动脑想：${all.length} 道思维题（已破解 ${doneN}）</h3>
      <div class="progress"><i style="width:${all.length ? doneN / all.length * 100 : 0}%"></i></div>
      <div class="tfilter">${[["all", "全部"], ["todo", "还没破解"], ["2", "⭐⭐ 入门"], ["3", "⭐⭐⭐ 挑战"]].map(([k, t]) => `<button class="tf ${filter === k ? "on" : ""}" data-f="${k}">${t}</button>`).join("")}</div>
      <div class="note">每道题都是<b>三段</b>：先做一道课本原型题（确认这一招学过），再挑战进阶，最后发散想一想。<b>不用先解锁文明</b>，随便点开哪一道都行。</div>
      ${groups || '<div class="note">这个筛选下暂时没有题，换一个看看。</div>'}</div>`;
  scr.querySelectorAll(".gamecard").forEach(el => el.onclick = () => go("thinkGame", { game: el.dataset.g }));
  scr.querySelectorAll(".tf").forEach(b => b.onclick = () => { S.thinkFilter = b.dataset.f; save(); renderThink(scr); });
  scr.querySelectorAll(".trow").forEach(b => b.onclick = () => { chStep = 0; go("challengeRun", { civ: b.dataset.civ, sub: Number(b.dataset.i) }); });
}

function renderThinkGame(scr) {
  const g = THINK_GAMES.find(x => x.id === S.game);
  if (!g || !MathGames[g.id]) { S.view = "think"; return render(); }
  $("#title").textContent = g.name;
  scr.className = "stage gamestage";
  MathGames[g.id].render(scr, {
    esc, toast,
    coin: n => { addCoins(n); markCorrect(); },
    win: id => { S.gameWins[id] = (S.gameWins[id] || 0) + 1; save(); if (Object.keys(S.gameWins).length === THINK_GAMES.length) toast("🎉 六个思维游戏你都通关过了！"); },
    back: () => back(),
    isWon: id => !!S.gameWins[id]
  });
}

/* ---------- 🧩 智能复习：首页级入口，只推荐真正需要回看的内容 ---------- */
function findSkillStation(skill){return CIVS.find(c=>(STATIONS[c.id]?.core||[]).some(x=>x.id===skill.id));}
function skillById(id){return ALL_SKILLS().find(s=>s.id===id);}
function renderReview(scr){
  $("#title").textContent="智能复习";scr.className="stage";nav=[];
  const due=srsDueAll(),weak=weakSkills(),list=[...new Map(due.concat(weak).map(x=>[x.id,x])).values()].slice(0,12);
  scr.innerHTML=`<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">只复习真正需要的</div>已经熟练的题会少出现；做错的知识点会换一种数字再回来。没有倒计时，也不扣金币。</div></div>
    ${list.length?`<div class="panel"><h3>今天适合再看一眼</h3>${list.map(s=>{const c=findSkillStation(s),a=S.attempts[s.id]||{};return `<button class="review-row" data-skill="${s.id}" data-civ="${c.id}"><span>${s.icon}</span><b>${esc(s.name)}</b><small>${a.total?`已练${a.total}次 · 正确${a.right}次`:"到复习时间了"}</small><i>开始 ›</i></button>`}).join("")}</div>`:`<div class="qcard" style="text-align:center">${baibaiTip("目前没有到期错题。可以去地图随便探索，或者做一次阶段测验。")}</div>`}`;
  scr.querySelectorAll(".review-row").forEach(b=>b.onclick=()=>{S.civ=b.dataset.civ;sess=null;go("core",{civ:b.dataset.civ})});
}

/* ---------- 📝 阶段测验：按教材册混合抽题，无倒计时 ---------- */
let examSess=null;
function bookSkills(book){return CIVS.filter(c=>c.book===book).flatMap(c=>(STATIONS[c.id]||{core:[]}).core);}
/* 测验按册次考，不按档位筛（要测的是这一册学没学会），但一样从易到难排 */
function buildExamPlan(pool,n){const out=[];while(out.length<n)out.push(pool[out.length%pool.length]);return sortByLv(out);}
function renderExam(scr){
  $("#title").textContent="阶段测验"; scr.className="stage";
  if(!examSess){
    scr.innerHTML=`<div class="guide baibai">${baibaiAvatar()}<div class="bubble"><div class="hello">看看哪些本领已经住进脑袋里</div>按人教版数学常用单元整理，每次15题，不倒计时。做错只会生成复习建议，不扣金币。</div></div><div class="qcard"><div class="qmeta"><span>人教版数学 · 选择册次</span><span>15题</span></div><div class="exam-picks">${["三上","三下","四上","四下","五上","五下","六上","六下"].map(b=>`<button class="exam-pick" data-book="${b}">${b}<br><small>${bookSkills(b).length}个知识点</small></button>`).join("")}</div></div>`;
    scr.querySelectorAll("[data-book]").forEach(b=>b.onclick=()=>{const pool=bookSkills(b.dataset.book);examSess={book:b.dataset.book,i:0,n:15,right:0,wrong:[],cur:null,pool,plan:buildExamPlan(pool,15)};nextExam(scr);}); return;
  }
  nextExam(scr);
}
function nextExam(scr){
  if(examSess.i>=examSess.n){
    const e=examSess,weak=[...new Set(e.wrong.map(x=>x.name))];(S.exams[e.book]||(S.exams[e.book]=[])).push({date:todayStr(),right:e.right,total:e.n,weak:weak.slice(0,5)});save();
    scr.innerHTML=`<div class="qcard" style="text-align:center">${baibaiTip(e.right>=12?"白白看见你认真检查的样子啦！":"错题已经收进复习路线，下次会换个样子再见。")}
      <div class="qtext">${e.book}阶段测验完成</div><div class="exam-summary"><div><b>${e.right}</b><small>答对</small></div><div><b>${e.n-e.right}</b><small>待复习</small></div><div><b>${Math.round(e.right/e.n*100)}%</b><small>本次正确率</small></div></div>
      <div class="note">${weak.length?`建议再看看：${weak.map(esc).join("、")}`:"这一轮全部掌握，可以去思维挑战逛逛。"}</div><button class="btn wide" id="againExam">再测一轮</button><button class="btn ghost wide" id="examBack">返回地图</button></div>`;
    examSess=null; $("#againExam").onclick=()=>renderExam(scr); $("#examBack").onclick=()=>{nav=[];S.view="map";render();}; return;
  }
  const skill=(examSess.plan&&examSess.plan[examSess.i])||examSess.pool[examSess.i%examSess.pool.length],prob=skill.gen();examSess.cur={skill,prob};
  scr.innerHTML=`<div class="progress"><i style="width:${examSess.i/examSess.n*100}%"></i></div><div class="qcard"><div class="qmeta"><span>${examSess.book} · ${skill.icon} ${esc(skill.name)}</span><span>${examSess.i+1}/${examSess.n}</span></div><div class="qtext">${prob.q}</div><div class="answerbox"><input id="ans" type="number" inputmode="decimal" placeholder="点这里填写答案" autocomplete="off"><button class="btn" id="ok">确定</button></div>${scratchPadHtml()}<div class="feedback" id="fb"></div></div><button class="btn ghost wide hidden" id="nextb">下一题 ›</button>`;
  bindScratchPad(scr); const input=$("#ans"); const submit=()=>{const v=input.value.trim();if(!v)return;const ok=Number(v)===prob.a;markAttempt(skill.id,ok);if(ok){examSess.right++;markCorrect();}else examSess.wrong.push(skill);const fb=$("#fb");fb.className=`feedback ${ok?"ok":"no"} show`;fb.innerHTML=ok?"答对了，继续探索！":"正确答案是 <b>"+prob.a+"</b>。"+(prob.hint?"<br>"+prob.hint:"");input.disabled=true;$("#ok").classList.add("hidden");$("#nextb").classList.remove("hidden");};
  $("#ok").onclick=submit;input.onkeydown=e=>{if(e.key==="Enter")submit()};$("#nextb").onclick=()=>{examSess.i++;nextExam(scr)};
}

/* ---------- 🎁 宝库（奖励页） ---------- */
function renderRewards(scr) {
  $("#title").textContent = "宝库";
  nav = [];
  const gotW = Object.keys(S.wonders).length, gotStar = CIVS.reduce((n, c) => { const s = stStars(c.id); return n + (s.core ? 1 : 0) + (s.extend ? 1 : 0) + (s.challenge ? 1 : 0); }, 0);
  const wonders = CIVS.map(c => `<div class="w ${S.wonders[c.id] ? "got" : ""}">${c.wonder.icon}<span class="cap">${S.wonders[c.id] ? esc(c.wonder.name) : `待发现 · ${esc(c.wonder.name)}`}</span></div>`).join("");
  scr.className = "rewards";
  scr.innerHTML = `
    <div class="panel"><h3>🏺 数学奇观收藏</h3><div class="wondergrid">${wonders}</div>
      <div class="note">集齐一个文明的三颗探险星（课内 + 拓展 + 思维）就能点亮它的奇观。<b>没有每天打卡，想来就来</b>——按自己的节奏探险。</div></div>
    <div class="panel"><h3>⭐ 探险成就</h3>
      <div style="font-size:15px;line-height:1.9">收集到的数学奇观：<b>${gotW}</b> / ${CIVS.length}<br>点亮的探险星：<b>${gotStar}</b><br>累计做对题目：<b>${S.totalRight || 0}</b> 道</div></div>
    <div class="panel"><h3>🪙 我的钱包（三科通用）</h3>
      <div style="font-size:15px;line-height:1.9">金币：<b>${S.coins || 0}</b> 🪙<br>转盘券：<b>${S.tickets || 0}</b> 🎡</div>
      <div class="note">数学、语文、英语三个网站是<b>同一个钱包</b>。数学每天首次做对 5 题额外得 20 金币；任意两科达标多 1 张转盘券，三科达标再得限定白白卡。</div></div>`;
}

/* ---------- 👨‍👩‍👧 家长 ---------- */
const PARENT_AUTH_KEY="learningParentAuth_v1";
let pinOK = sessionStorage.getItem(PARENT_AUTH_KEY)==="1";
function renderParent(scr) {
  $("#title").textContent = "数学家长设置";
  scr.className = "parent";
  if (!pinOK) {
    scr.innerHTML = `<div class="panel"><div class="parent-head">${baibaiAvatar()}<div><h3>数学家长设置</h3><p class="note">三科总览请从学习导航进入；这里保留数学详细数据和设置。</p></div></div>
      <div class="pinpad"><input id="pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••••"></div>
      <button class="btn wide" id="go">进入</button><button class="btn ghost wide" id="parentBackMath">← 返回数学奇境</button><a class="btn ghost wide parent-exit-center" href="https://nevergiveup0618.github.io/learning/?parent=1">🏠 返回统一家长中心</a></div>`;
    const go2 = () => { if ($("#pin").value === PARENT_PIN) { pinOK = true; sessionStorage.setItem(PARENT_AUTH_KEY,"1"); renderParent(scr); } else toast("密码不对"); };
    $("#go").onclick = go2; $("#pin").onkeydown = e => { if (e.key === "Enter") go2(); };
    $("#parentBackMath").onclick = () => { S.view="map"; nav=[]; render(); };
    return;
  }
  const activeDays = Object.keys(S.history).length;
  const recent = Object.keys(S.history).sort().slice(-7).reverse()
    .map(d => `<div class="setrow"><span>${d.slice(5)}</span><b>做对 ${S.history[d].right} 题</b></div>`).join("") || `<div class="note">还没有学习记录。</div>`;
  const allCore = ALL_SKILLS();
  const mastered = allCore.filter(s => (S.srs[s.id] || {}).lv >= 4).length;
  const weak=weakSkills();
  const fmtSec=n=>n<60?`${Math.round(n)}秒`:`${Math.floor(n/60)}分${Math.round(n%60)}秒`;
  const keys=Array.from({length:7},(_,i)=>addDays(todayStr(),i-6));
  const sumTime=(k,key)=>Number((S.timeLog[k]||{})[key]||0), weekKeys=["map","core","extend","challenge","exam"];
  const todaySecs=weekKeys.reduce((a,k)=>a+sumTime(todayStr(),k),0),weekSecs=keys.reduce((a,d)=>a+weekKeys.reduce((n,k)=>n+sumTime(d,k),0),0);
  const examRows=Object.entries(S.exams).flatMap(([book,rows])=>(rows||[]).map(x=>({book,...x}))).slice(-5).reverse();
  scr.innerHTML = `<div class="panel"><div class="parent-head">${baibaiAvatar()}<div><h3>数学详细报告</h3><p class="note">设置会自动保存。看完可直接回数学，也可去三科统一家长中心。</p></div></div><button class="btn wide" id="parentBackMath">← 返回数学奇境</button><a class="btn ghost wide parent-exit-center" href="https://nevergiveup0618.github.io/learning/?parent=1">🏠 返回统一家长中心</a></div>
    <div class="panel" id="math-report"><h3>📊 数学学习概况（自动记录，无需打卡）</h3>
    <div class="setrow"><span>今天有效学习</span><b>${fmtSec(todaySecs)}</b></div>
    <div class="setrow"><span>最近7天有效学习</span><b>${fmtSec(weekSecs)}</b></div>
    <div class="setrow"><span>今天做对题数</span><b>${S.daily.correct}</b></div>
    <div class="setrow"><span>累计做对题目</span><b>${S.totalRight || 0}</b></div>
    <div class="setrow"><span>有学习记录的天数</span><b>${activeDays}</b></div>
    <div class="setrow"><span>已收集数学奇观</span><b>${Object.keys(S.wonders).length} / ${CIVS.length}</b></div>
    <div class="setrow"><span>课内知识点已熟练</span><b>${mastered} / ${allCore.length}</b></div>
    <div class="setrow"><span>待复习知识点(到期)</span><b>${srsDueAll().length}</b></div>
    <div class="setrow"><span>当前难度档</span><b>${tierInfo().icon} ${esc(tierInfo().name)}（${S.tier}/5）</b></div>
    <div class="setrow"><span>擂台战绩</span><b>${S.pk.win}胜 ${S.pk.draw}平 ${S.pk.lose}负</b></div></div>
    <div class="panel"><h3>🎯 当前需要关注</h3><div class="note">${weak.length?weak.slice(0,6).map(x=>esc(x.name)).join("、"):"暂时没有连续出错的知识点。"}</div></div>
    <div class="panel"><h3>📝 最近阶段测验</h3>${examRows.length?examRows.map(x=>`<div class="setrow"><span>${x.date} · ${x.book}</span><b>${x.right}/${x.total}</b></div>`).join(""):"<div class='note'>还没有阶段测验记录。</div>"}</div>
    <div class="panel"><h3>🗓️ 最近学习记录</h3>${recent}
    <div class="note">孩子想学就学，这里只默默记录她每天做对了多少，供您了解进度——不设连续打卡，避免压力。</div></div>
    <div class="panel"><h3>📏 难度档位</h3>
    <div class="setrow"><span>当前难度<br><span class="note">${tierInfo().icon} ${esc(tierInfo().name)} —— ${esc(tierInfo().blurb)}</span></span><b>${S.tier} / 5</b></div>
    <div class="tierpick">${TIERS.map(t=>`<button class="tierbtn ${S.tier===t.n?"on":""}" data-tier="${t.n}">${t.icon}<br>${esc(t.name)}</button>`).join("")}</div>
    <div class="setrow"><span>自动调难度<br><span class="note">一轮答对 85% 以上升一档，低于 45% 降一档。锁定后只按您选的档位出题。</span></span>
      <div class="seg"><button id="tl1" class="${S.tierLock ? "on" : ""}">锁定</button><button id="tl0" class="${!S.tierLock ? "on" : ""}">自动</button></div></div>
    ${S.tierLog.length?`<div class="note">最近调档：${S.tierLog.slice(-5).reverse().map(x=>`${x.date.slice(5)} → 第${x.to}档（正确率${x.rate}%）`).join("；")}</div>`:'<div class="note">还没有调过档。</div>'}
    </div>
    <div class="panel"><h3>⚔️ 关于 PK 擂台</h3>
    <p class="note">擂台上的猫小九、麦克狐、猴子警长是<b>程序模拟的对手</b>，不是联网真人 —— 只是给了名字、说话的口气和会算错的毛病，让对战有意思一点。<br>
    孩子连输两场，对手会自动变慢、变得更容易出错；连赢三场再调回来。当前让分档：<b>${S.pk.handicap||0}</b>（负数＝对手已放水）。<br>
    计分是<b>答对 12 分、先交卷只多 4 分</b>，所以算得慢但算得对一样能赢。</p></div>
    <div class="panel"><h3>⚙️ 设置</h3>
    <div class="setrow"><span>测试模式<br><span class="note">解锁全部文明，方便您预览。给孩子用前请关掉。</span></span>
      <div class="seg"><button id="tm0" class="${!S.testMode ? "on" : ""}">关</button><button id="tm1" class="${S.testMode ? "on" : ""}">开</button></div></div>
    </div>
    <div class="panel"><h3>ℹ️ 设计说明</h3><p class="note">数学奇境用于保持兴趣并自然拓展：课本知识练熟后，继续接触数学史、生活数学与思维方法。这里不设每日任务和连续打卡，孩子随时想来都可以。金币和转盘券与语文、英语互通。</p></div>`;
  scr.querySelectorAll("[data-tier]").forEach(b=>b.onclick=()=>{S.tier=Number(b.dataset.tier);save();renderParent(scr);});
  $("#tl1").onclick = () => { S.tierLock = true; save(); renderParent(scr); };
  $("#tl0").onclick = () => { S.tierLock = false; save(); renderParent(scr); };
  $("#tm0").onclick = () => { S.testMode = false; CIVS.forEach(c => { if (c.locked) delete S.unlocked[c.id]; }); save(); renderParent(scr); };
  $("#tm1").onclick = () => { S.testMode = true; CIVS.forEach(c => S.unlocked[c.id] = true); save(); renderParent(scr); };
  $("#parentBackMath").onclick = () => { S.view="map"; nav=[]; render(); };
}

/* ---------- 导航 ---------- */
document.querySelectorAll("#nav button").forEach(b => b.onclick = () => { trackTime(b.dataset.v); nav = []; sess = null; examSess=null; pkSess=null; S.view = b.dataset.v; render(); });
$("#backBtn").onclick = () => { sess = null; if (["pkRun"].includes(S.view)) pkSess = null; back(); };
document.addEventListener("visibilitychange", () => { if(document.hidden)flushJourney();else{journeyAt=Date.now();paintPurse();} });

/* ---------- 启动 ---------- */
walletIn();
if(new URLSearchParams(location.search).get("parent")==="1")S.view="parent";
render();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
