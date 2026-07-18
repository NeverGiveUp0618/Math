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
ok("渲染出向导欧几", $("#screen").innerHTML.includes("欧几"));
ok("古埃及可点、其余上锁", $(".civ[data-civ='egypt']") && $(".civ.locked"));
ok("奇观收藏栏存在", $(".wonderbar"));

console.log("— 进入古埃及站 —");
click($(".civ[data-civ='egypt']"));
ok("站内出现三层深度", window.document.querySelectorAll(".depth").length === 3);
ok("返回键出现", !$("#backBtn").classList.contains("hidden"));

console.log("— 课内夯实：跑满一轮全答对 —");
click(window.document.querySelector(".depth[data-d='core']"));
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
ok("挑战奖励金币入账", window.eval("S.challengeDone.gauss === true"));

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

console.log("— 宝库页 —");
window.eval("nav=[]; S.view='rewards'; render();");
ok("宝库无打卡日历", !$("#screen").innerHTML.includes("探险打卡") && !$("#screen").innerHTML.includes("cal"));
ok("宝库展示奇观+成就", $("#screen").innerHTML.includes("数学奇观") && $("#screen").innerHTML.includes("探险成就"));

console.log(`\n结果：${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
