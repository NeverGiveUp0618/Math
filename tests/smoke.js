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
const appJs = fs.readFileSync(path.join(dir, "app.js"), "utf8");

const dom = new JSDOM(html, { runScripts: "dangerously", pretendToBeVisual: true, url: "https://nevergiveup0618.github.io/Math/" });
const { window } = dom;
window.HTMLElement.prototype.focus = function () {};
function inject(code) { const s = window.document.createElement("script"); s.textContent = code; window.document.body.appendChild(s); }
inject(dataJs);   // 用真正的 <script> 注入，全局词法环境共享，后续 window.eval 才能读到 CIVS/S
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
ok("底部菜单只保留探险/复习/测验/收藏", window.document.querySelectorAll("#nav button").length===4 && !$("#nav").textContent.includes("家长"));
ok("八册教材扩展为13个文明站", window.eval("CIVS.length") === 13);
ok("三至六年级八册都至少覆盖8个知识点", window.eval("['三上','三下','四上','四下','五上','五下','六上','六下'].every(b=>CIVS.filter(c=>c.book===b).flatMap(c=>STATIONS[c.id].core).length>=8)"));

console.log("— 进入古埃及站 —");
click($(".civ[data-civ='egypt']"));
ok("站内出现三层深度", window.document.querySelectorAll(".depth").length === 3);
ok("返回键出现", !$("#backBtn").classList.contains("hidden"));

console.log("— 课内夯实：跑满一轮全答对 —");
click(window.document.querySelector(".depth[data-d='core']"));
ok("计算题带内置草稿区", $(".scratch canvas"));
ok("答题框不会自动获得焦点", window.document.activeElement !== $("#ans"));
ok("草稿区有撤销、方格、竖式和数轴", $("[data-tool='undo']") && $("[data-template='grid']") && $("[data-template='vertical']") && $("[data-template='numberline']"));
ok("草稿区有可拖动画布、橡皮和空白纸", $("[data-tool='pan']") && $("[data-tool='eraser']") && $("[data-template='blank']") && $(".scratch-viewport .scratch-world"));
const coinStart = window.eval("S.coins");
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
    st.core.forEach(sk=>{ for(let k=0;k<20;k++){ const p=sk.gen(); if(typeof p.a!=="number"||!isFinite(p.a)) errs.push(id+"/"+sk.id+" 答案非数字"); if(!p.q) errs.push(id+"/"+sk.id+" 缺题面"); } });
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
ok("九站题目数据全部合法（含答案类型/思路/大招）", report.length === 0);
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

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
