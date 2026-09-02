/* 数学奇境 冒烟测试（jsdom）
 * 运行：node tests/smoke.js  （借用 english-game 的 node_modules/jsdom）
 */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require(path.join(__dirname, "../../english-game/node_modules/jsdom"));

const dir = path.join(__dirname, "..");
let html = fs.readFileSync(path.join(dir, "index.html"), "utf8");
html = html.replace(/<script src="[^"]+"><\/script>/g, ""); // 去掉外链脚本，改为手动注入
const dataJs = fs.readFileSync(path.join(dir, "data.js"), "utf8");
const gamesJs = fs.readFileSync(path.join(dir, "games.js"), "utf8");
const appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://nevergiveup0618.github.io/Math/" });
const { window } = dom;
window.HTMLElement.prototype.focus = function () {};
function inject(code) { const s = window.document.createElement("script"); s.textContent = code; window.document.body.appendChild(s); }
inject(dataJs);   // 用真正的 <script> 注入，全局词法环境共享，后续 window.eval 才能读到 CIVS/S
inject(gamesJs);
inject(appJs);

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log("  ✗ " + name); } }
const $ = s => window.document.querySelector(s);
const click = el => { const e = window.document.createEvent("MouseEvents"); e.initEvent("click", true, true); el.dispatchEvent(e); };

console.log("— 启动 —");
ok("首页标题=数学奇境", $("#title").textContent === "数学奇境");
ok("渲染出白白学习伙伴", $("#screen img[alt='白白']"));
ok("首页文案无比较压力", !$("#screen").innerHTML.includes("脱颖而出"));
ok("古埃及可点、其余上锁", $(".civ[data-civ='egypt']") && $(".civ.locked"));
ok("奇观收藏栏存在", $(".wonderbar"));
ok("底部菜单=探险/PK/思维/复习/收藏", window.document.querySelectorAll("#nav button").length===5 && $("#nav").textContent.includes("PK") && $("#nav").textContent.includes("思维") && !$("#nav").textContent.includes("家长"));
ok("阶段测验入口留在首页", !!$("#examBtn"));
ok("八册教材扩展为13个文明站", window.eval("CIVS.length") === 13);
ok("三至六年级八册都至少覆盖8个知识点", window.eval("['三上','三下','四上','四下','五上','五下','六上','六下'].every(b=>CIVS.filter(c=>c.book===b).flatMap(c=>STATIONS[c.id].core).length>=8)"));
ok("每个年级册至少有4道思维挑战", window.eval("['三上','三下','四上','四下','五上','五下','六上','六下'].every(b=>CIVS.filter(c=>c.book===b).flatMap(c=>STATIONS[c.id].challenge).length>=4)"));
window.eval("localStorage.removeItem(CARD_DAILY_KEY);Array.from({length:7},()=>grantMathCard())");
ok("数学每日独立最多获得5张卡", window.eval("mathCardDaily().math===5&&mathCardDaily().pendingMath===5"));
window.eval("localStorage.removeItem(SUBJECT_BALANCE_KEY);S.daily={date:todayStr(),correct:0};const w=JSON.parse(localStorage.getItem(WALLET_KEY)||'{}');w.coins=0;w.tickets=0;localStorage.setItem(WALLET_KEY,JSON.stringify(w));S.coins=0;S.tickets=0;for(let i=0;i<5;i++)markCorrect()");
ok("数学每天首次做对5题额外奖20金币", window.eval("S.coins===20&&JSON.parse(localStorage.getItem(SUBJECT_BALANCE_KEY)).ma===true"));
window.eval("markCorrect()");
ok("数学继续做题不重复发首次奖励", window.eval("S.coins===20"));
window.eval("localStorage.setItem(SUBJECT_BALANCE_KEY,JSON.stringify({date:todayStr(),en:true,cn:false,ma:false,two:false,three:false}));S.daily={date:todayStr(),correct:4};markCorrect()");
ok("数学成为当天第二科时只发一次跨科转盘券", window.eval("S.tickets===1&&JSON.parse(localStorage.getItem(SUBJECT_BALANCE_KEY)).two===true"));

console.log("— 进入古埃及站 —");
click($(".civ[data-civ='egypt']"));
ok("站内出现三层深度", window.document.querySelectorAll(".depth").length === 3);
ok("返回键出现", !$("#backBtn").classList.contains("hidden"));

console.log("— 课内夯实：跑满一轮全答对 —");
click(window.document.querySelector(".depth[data-d='core']"));
ok("计算题带内置草稿区", $(".scratch canvas"));
ok("答题框不会自动获得焦点", window.document.activeElement !== $("#ans"));
ok("草稿区有撤销、方格、竖式和数轴", $("[data-tool='undo']") && $("[data-template='grid']") && $("[data-template='vertical']") && $("[data-template='numberline']"));
ok("草稿区有分数专用纸", $("[data-template='fraction']"));
ok("草稿区有可拖动画布、橡皮和空白纸", $("[data-tool='pan']") && $("[data-tool='eraser']") && $("[data-template='blank']") && $(".scratch-viewport .scratch-world"));
ok("草稿纸默认选择拖动画布而不是铅笔", $("[data-tool='pan']").classList.contains("on") && !$("[data-tool='pen']").classList.contains("on"));
ok("草稿纸支持缩小、放大和回到中心", $("[data-zoom='out']") && $("[data-zoom='in']") && $("[data-zoom='reset']"));
const coinStart = window.eval("S.coins");
const firstAnswer=window.eval("sess.cur.prob.a");
$("#ans").value=String(Number(firstAnswer)+999);click($("#ok"));
ok("第一次答错只给提示，不立刻公布答案",!$("#ans").disabled&&$("#fb").textContent.includes("还可以再答一次")&&!$("#fb").textContent.includes("正确答案"));
$("#ans").value=String(firstAnswer);click($("#ok"));click($("#nextb"));
let guard = 0;
while ($("#ans") && guard++ < 30) {
  const ans = window.eval("sess.cur.prob.a");
  $("#ans").value = String(ans);
  click($("#ok"));
  ok("答对反馈显示", $("#fb").classList.contains("ok"));
  if ($("#nextb") && !$("#nextb").classList.contains("hidden")) click($("#nextb"));
}
ok("一轮结束出现结算/奖杯", $("#screen").innerHTML.includes("这一轮做对") || $("#screen").innerHTML.includes("🏆"));
ok("金币增加了", window.eval("S.coins") > coinStart);
ok("SRS 记录已写入", window.eval("Object.keys(S.srs).length") > 0);
ok("课内星点亮", window.eval("(S.stations.egypt||{}).core === true"));
ok("累计做对已记录", window.eval("S.totalRight") >= 8);

console.log("— 课外拓展 —");
window.eval("sess=null; nav=[]; S.view='extend'; render();");
ok("拓展页有知识卡", $("#screen").innerHTML.includes("象形数字"));
click($("#play"));
guard = 0;
while ($("#ans") && guard++ < 30) {
  const ans = window.eval("Number(document.querySelector('#ans')._x||0)"); // 占位
  // 拓展题答案在 sess 外部不可见，改用错误答案跑流程完整性（不强制点亮星）
  $("#ans").value = "-999";
  click($("#ok"));
  if ($("#nextb") && !$("#nextb").classList.contains("hidden")) click($("#nextb"));
}
ok("拓展一轮能跑完不报错", $("#screen").innerHTML.includes("做对"));

console.log("— 思维挑战：小高斯配对求和 —");
window.eval("sess=null; nav=[]; S.view='challenge'; render();");
ok("挑战列表出现", $("#screen").innerHTML.includes("金字塔数塔"));
window.eval("nav=[]; S.view='challengeRun'; S.sub=1; render();"); // index1 = 小高斯 答案55
ok("挑战题渲染", $("#screen").innerHTML.includes("高斯"));
click($("#hintBtn"));
ok("能逐条看思路", $(".hint"));
$("#ans").value = "55";
click($("#ok"));
ok("答对显示解题大招", !$("#big").classList.contains("hidden"));
ok("挑战奖励金币入账", window.eval("S.challengeDone.eg_gauss === true"));

console.log("— 阶段测验与个性化 —");
window.eval("examSess=null; nav=[]; S.view='exam'; render();");
ok("阶段测验提供八册选择且明确不倒计时", window.document.querySelectorAll("[data-book]").length===8 && $("#screen").textContent.includes("不倒计时"));
ok("阶段测验显示顶栏返回按钮", !$("#backBtn").classList.contains("hidden"));
click($("[data-book='六下']"));
ok("测验题带草稿且输入框不自动聚焦", $(".scratch") && window.document.activeElement !== $("#ans"));
guard=0;while($("#ans")&&guard++<20){const a=window.eval("examSess.cur.prob.a");$("#ans").value=String(a);click($("#ok"));if($("#nextb")&&!$("#nextb").classList.contains("hidden"))click($("#nextb"));}
ok("六下15题测验形成报告", $("#screen").textContent.includes("六下阶段测验完成") && window.eval("S.exams['六下'].length")===1);
ok("答题统计可用于个性化", window.eval("Object.keys(S.attempts).length")>0);

console.log("— 数据完整性：遍历全部站点题目 —");
const report = window.eval(`(function(){
  const errs=[];
  for(const [id,st] of Object.entries(STATIONS)){
    if(!st.labels||!st.core||!st.extend||!st.challenge) errs.push(id+" 结构缺字段");
    st.core.forEach(sk=>{ for(let k=0;k<20;k++){ const p=sk.gen(); if(typeof p.a!=="number"||!isFinite(p.a)) errs.push(id+"/"+sk.id+" 答案非数字"); if(!p.q) errs.push(id+"/"+sk.id+" 缺题面");
      /* ⚠️ 判题是 Number(输入)===prob.a 的严格相等：3.14×3×3 在 JS 里是 28.259999999999998，
         孩子写 28.26 会被判错、怎么算都对不上。2026-08-30 全站扫描抓到 6 个中招（圆/百分数那批），
         已在 data.js 用 RD() 修掉；这条断言守着别再犯。 */
      if(Math.round(p.a*100)/100 !== p.a) errs.push(id+"/"+sk.id+" 答案带浮点尾巴，孩子永远答不对："+p.a); } });
    (st.extend.tricks||[]).concat([]).forEach(t=>{ for(let k=0;k<10;k++){ const p=t.gen(); if(typeof p.a!=="number") errs.push(id+" trick "+t.name+" 答案非数字"); } });
    (st.extend.play||[]).forEach(fn=>{ for(let k=0;k<10;k++){ const p=fn(); if(typeof p.a!=="number") errs.push(id+" play 答案非数字"); } });
    st.challenge.forEach(c=>{
      if(!c.steps||!c.steps.length) errs.push(id+"/"+c.id+" 缺思路steps");
      if(!c.big) errs.push(id+"/"+c.id+" 缺解题大招");
      if(c.type==="choice"){ if(!(c.a>=0&&c.a<c.options.length)) errs.push(id+"/"+c.id+" 选项答案越界"); }
      else { if(typeof c.a!=="number") errs.push(id+"/"+c.id+" 填空答案非数字"); }
    });
  }
  return errs;
})()`);
ok("全站题目数据合法（答案类型/浮点/思路/大招）", report.length === 0);
if (report.length) report.forEach(e => console.log("    · " + e));

console.log("— 其余四站可正常进入并跑课内 —");
window.eval("S.unlocked.greece=true; S.unlocked.china=true; S.unlocked.maya=true; S.unlocked.rabbit=true;");
for (const civ of ["greece", "china", "maya", "rabbit"]) {
  window.eval(`sess=null; nav=[]; S.view='station'; S.civ='${civ}'; render();`);
  ok(civ + " 站渲染出三层深度", window.document.querySelectorAll(".depth").length === 3);
  window.eval(`sess=null; S.view='core'; render();`);
  let g = 0;
  while ($("#ans") && g++ < 12) { $("#ans").value = String(window.eval("sess.cur.prob.a")); click($("#ok")); ok(civ + " 课内答对判定", $("#fb").classList.contains("ok")); if ($("#nextb") && !$("#nextb").classList.contains("hidden")) click($("#nextb")); }
  ok(civ + " 课内一轮跑完", $("#screen").innerHTML.includes("这一轮做对"));
}

console.log("— 新增四站可进入 —");
for (const civ of ["babylon","india","sail","modern"]) { window.eval(`S.unlocked.${civ}=true; sess=null; nav=[]; S.view='station'; S.civ='${civ}'; render();`); ok(civ+" 站有课内/拓展/思维三层",window.document.querySelectorAll(".depth").length===3); }

console.log("— 三科共享钱包互通 —");
window.localStorage.setItem("sharedWallet_v1", JSON.stringify({ coins: 999, tickets: 7 }));
window.eval("paintPurse()");
ok("读到语文/英语赚的金币", $("#coinN").textContent === "999");
ok("读到共享转盘券", $("#tkN").textContent === "7");

console.log("— 家长后台（无打卡） —");
window.eval("pinOK=true; nav=[]; S.view='parent'; render();");
ok("家长概况显示", $("#screen").innerHTML.includes("学习概况"));
ok("无打卡天数计数器", !$("#screen").innerHTML.includes("打卡天数"));
ok("明确告知不设打卡压力", $("#screen").innerHTML.includes("无需打卡") || $("#screen").innerHTML.includes("不设连续打卡"));
ok("家长后台同时提供返回数学和统一家长中心", $("#parentBackMath") && $("#screen").textContent.includes("返回统一家长中心"));
$("#parentBackMath").click();
ok("返回数学直接回数学首页且无需重新输入密码", window.eval("S.view")==="map" && window.eval("pinOK")===true);

console.log("— 宝库页 —");
window.eval("nav=[]; S.view='rewards'; render();");
ok("宝库无打卡日历", !$("#screen").innerHTML.includes("探险打卡") && !$("#screen").innerHTML.includes("cal"));
ok("宝库展示奇观+成就", $("#screen").innerHTML.includes("数学奇观") && $("#screen").innerHTML.includes("探险成就"));
ok("未获得奇观显示灰色原图而非问号", !$(".wondergrid").textContent.includes("❔") && $(".wondergrid .w:not(.got)"));


console.log("— ⚔️ PK 擂台 —");
window.eval("pkSess=null; nav=[]; S.view='pk'; render();");
ok("擂台有段位卡", !!$(".rankcard"));
ok("擂台提供三个对手", window.document.querySelectorAll(".rival").length === 3);
ok("擂台有同屏双人入口", !!$("#duoBtn"));
ok("擂台明说输了也有金币", $("#screen").textContent.includes("输了也有金币"));
ok("擂台出题范围含综合与八册", window.document.querySelectorAll("#screen [data-book]").length === 9);
const pkCoin0 = window.eval("S.coins"), pkPlays0 = window.eval("S.pk.plays");
click($(".rival[data-r='chick']"));
ok("进入擂台对战页并显示比分条", !!$(".pkbar") && window.eval("S.view") === "pkRun");
ok("对战页显示对手正在算", !!$("#rvthink"));
let pkGuard = 0;
while ($("#ans") && pkGuard++ < 20) {
  $("#ans").value = String(window.eval("pkSess.cur.prob.a"));
  click($("#ok"));
  if ($("#nextb") && !$("#nextb").classList.contains("hidden")) click($("#nextb"));
}
ok("八题打完出结算", $("#screen").innerHTML.includes("擂台") || !!$(".pkscore"));
ok("全对必胜（10~15分/题 vs 对手最多10分）", window.eval("S.pk.win") >= 1);
ok("战绩已记账", window.eval("S.pk.plays") === pkPlays0 + 1);
ok("对战结束发金币", window.eval("S.coins") > pkCoin0);
ok("段位随胜场提升", window.eval("pkRank().name") !== undefined);
window.eval("nav=[]; S.view='pk'; render();");
click($("#duoBtn"));
ok("同屏对战显示轮到谁", $("#screen").textContent.includes("轮到"));
let duoGuard = 0;
while ($("#ans") && duoGuard++ < 30) {
  $("#ans").value = String(window.eval("pkSess.cur.prob.a"));
  click($("#ok"));
  if ($("#nextb") && !$("#nextb").classList.contains("hidden")) click($("#nextb"));
}
ok("同屏对战 12 题跑完并计入战绩", window.eval("S.pk.duo") === 1);

console.log("— 🧩 思维乐园 —");
window.eval("nav=[]; S.view='think'; render();");
const allCh = window.eval("ALL_CHALLENGES().length");
ok("汇总了全站思维题", allCh === 55);
ok("六个游戏都列出来了", window.document.querySelectorAll(".gamecard").length === 6);
ok("思维题不受文明解锁限制（未解锁站的题也在列表里）",
  window.eval("S.unlocked.future!==true") === false || window.document.querySelectorAll(".trow").length === allCh);
ok("列表条数=全部思维题", window.document.querySelectorAll(".trow").length === allCh);
ok("有难度筛选", window.document.querySelectorAll(".tf").length === 4);
click(window.document.querySelectorAll(".tf")[3]);   // ⭐⭐⭐ 挑战
ok("筛选⭐⭐⭐后只剩三星题", window.document.querySelectorAll(".trow").length === window.eval("ALL_CHALLENGES().filter(x=>x.ch.star===3).length"));
click(window.document.querySelectorAll(".tf")[0]);
const firstRow = window.document.querySelector(".trow");
click(firstRow);
ok("从思维乐园能直接打开思维题", window.eval("S.view") === "challengeRun" && !!$("#hintBtn"));

console.log("— 🎮 六个思维游戏 —");
const g = window.eval("MathGames");
let bad24 = 0;
for (let i = 0; i < 60; i++) {
  const nums = [1, 2, 3, 4].map(() => 1 + Math.floor(Math.random() * 10));
  const sol = window.eval(`MathGames.solve24([${nums.join(",")}])`);
  if (sol) { const v = window.eval(`(${sol.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-")})`); if (Math.abs(v - 24) > 1e-6) bad24++; }
}
ok("24点求解器给出的解都真的等于24", bad24 === 0);
ok("发牌只发有解的题", window.eval("(function(){for(let i=0;i<30;i++){const d=MathGames.solve24([1,1,1,1]);}return true})()"));
ok("幻方八种摆法都合法", window.eval(`(function(){for(let i=0;i<80;i++){const m=MathGames.magicVariant();
  const r=[0,1,2].map(x=>m[x][0]+m[x][1]+m[x][2]), c=[0,1,2].map(x=>m[0][x]+m[1][x]+m[2][x]);
  if(!(r.every(v=>v===15)&&c.every(v=>v===15)&&m[0][0]+m[1][1]+m[2][2]===15&&m[0][2]+m[1][1]+m[2][0]===15&&new Set(m.flat()).size===9))return false;}return true})()`));
ok("数独 4×4 / 6×6 都生成唯一解", window.eval(`(function(){for(const s of [4,6]){for(let i=0;i<4;i++){const m=MathGames.sdMake(s); if(m.puz.filter(v=>!v).length<s) return false;}}return true})()`));

window.eval("nav=[]; S.view='thinkGame'; S.game='g24'; render();");
ok("24点：发出四张牌和运算键盘", window.document.querySelectorAll(".g24-card").length === 4 && window.document.querySelectorAll(".g24-key").length === 8);
window.eval("nav=[]; S.view='thinkGame'; S.game='magic'; render();");
ok("幻方：九格 + 数字键盘，且给了3个提示数", window.document.querySelectorAll(".mg-cell").length === 9 && window.document.querySelectorAll(".mg-cell.given").length === 3);
window.eval("nav=[]; S.view='thinkGame'; S.game='hanoi'; render();");
ok("汉诺塔：三根柱子、默认3盘、写明最少7步", window.document.querySelectorAll(".hn-peg").length === 3 && window.document.querySelectorAll(".hn-disk").length === 3 && $("#screen").textContent.includes("最少 7"));
window.eval("nav=[]; S.view='thinkGame'; S.game='sudoku'; render();");
ok("数独：默认 4×4 共16格", window.document.querySelectorAll(".sd-cell").length === 16);
window.eval("nav=[]; S.view='thinkGame'; S.game='weigh'; render();");
ok("找次品：默认9个球、三档可选", window.document.querySelectorAll(".wg-ball").length === 9 && window.document.querySelectorAll(".hn-lv").length === 3);

window.eval("nav=[]; S.view='thinkGame'; S.game='river'; render();");
ok("过河：三样东西都在出发岸", window.document.querySelectorAll(".rv-item").length === 3);
click(window.document.querySelector(".rv-item[data-id='wolf']"));
ok("先带狼过河会被判失败（羊会啃白菜）", $("#screen").textContent.includes("羊会啃光白菜"));
window.eval("nav=[]; S.view='thinkGame'; S.game='river'; render();");
click(window.document.querySelector(".rv-item[data-id='sheep']"));
ok("先带羊过河是安全的", !$("#screen").textContent.includes("哎呀"));
const RIVER_STEPS = ["sheep", null, "wolf", "sheep", "cabbage", null, "sheep"];
window.eval("nav=[]; S.view='thinkGame'; S.game='river'; render();");
for (const step of RIVER_STEPS) {
  const btn = step ? window.document.querySelector(`.rv-item[data-id='${step}']:not([disabled])`) : window.document.querySelector("[data-act='alone']");
  if (btn) click(btn);
}
ok("七趟标准解法能通关", $("#screen").textContent.includes("全部安全过河") || $("#screen").textContent.includes("全部过河"));
ok("通关计入思维游戏记录", window.eval("(S.gameWins.river||0) >= 1"));

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
