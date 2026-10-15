/* ==========================================================================
   XUXU 照片共享工具  ——  嘘嘘真人照片统一接入层
   --------------------------------------------------------------------------
   所有游戏页面（assets/games/<名字>/index.html）和大厅首页都只需要：

     <script src="../../photos/../js/photos.js"></script>   ← 大厅用 assets/js/
     <script src="../../js/photos.js"></script>             ← 游戏页用这个

   然后用 window.XUXU 这一套 API，不用再各自写相对路径（写错就 404）。
   路径由本文件自己的 URL 推导，无论从哪里打开页面都不会错。
   ========================================================================== */
(function(){
"use strict";

/* 照片数量：assets/photos/ 下 01.jpg ... 11.jpg */
var COUNT = 11;

/* ---- 推导 photos 目录的绝对 URL ---------------------------------------- */
var base = '../../photos/';                 // 兜底：从游戏页深度打开时可用
try{
  var s = (document.currentScript && document.currentScript.src) || '';
  if(s){ base = s.replace(/js\/photos\.js(\?[^#]*)?(#.*)?$/, 'photos/'); }
}catch(e){}
if(base === s || !/photos\/$/.test(base)){ base = '../../photos/'; }

var URLS = [];
for(var i=0;i<COUNT;i++){
  URLS.push(base + (i<9 ? '0' : '') + (i+1) + '.jpg');
}

/* ---- 图片缓存：按需创建并加载 ------------------------------------------ */
var cache = new Array(COUNT);
function img(i){
  i = ((i % COUNT) + COUNT) % COUNT;        // 超范围自动回绕
  var im = cache[i];
  if(!im){
    im = new Image();
    im.onload  = function(){ ready[i] = true;  if(onReady) onReady(i); };
    im.onerror = function(){ failed[i] = true; };
    im.decoding = 'async';
    im.src = URLS[i];
    cache[i] = im;
  }
  return im;
}
var ready = new Array(COUNT), failed = new Array(COUNT);
var onReady = null;

/* 图片是否已经可以画 */
function ok(i){
  var im = img(i);
  return !!(im.complete && im.naturalWidth && !failed[i]);
}

/* 全部预加载；cb 每加载好一张回调一次（用于 canvas 游戏重绘） */
function preload(cb){
  onReady = cb || null;
  for(var i=0;i<COUNT;i++) img(i);
}

/* ---- CSS 用：背景图 url 字符串 / 直接 URL ------------------------------ */
function url(i){
  i = ((i % COUNT) + COUNT) % COUNT;
  return URLS[i];
}
function cssBg(i){
  return "url('" + url(i) + "')";
}

/* ---- canvas 用：圆形裁切画一张脸 ---------------------------------------
   ctx        : 2d context
   cx, cy, r  : 圆心与半径
   i          : 第几张照片（0 起，自动回绕）
   opts       : { ring:'#36b3e3', ringWidth:0.1, y:'12%' }  可选
   返回 true  = 已画出；false = 还没加载好，调用方自己画兜底（emoji/色块）
   --------------------------------------------------------------------- */
function drawFace(ctx, cx, cy, r, i, opts){
  if(r <= 0) return false;
  if(!ok(i)) { img(i); return false; }
  opts = opts || {};

  var im = img(i);
  var side = Math.min(im.naturalWidth, im.naturalHeight);
  var sx = (im.naturalWidth  - side) / 2;
  /* 略微取上半部分，避免圆裁之后下巴/领口顶掉脸 */
  var bias = opts.topBias == null ? 0.12 : opts.topBias;
  var sy = (im.naturalHeight - side) * bias;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI*2);
  ctx.clip();
  ctx.drawImage(im, sx, sy, side, side, cx-r, cy-r, r*2, r*2);
  ctx.restore();

  /* 描边：让脸和背景分开。
     r 很小时（消消乐消除缩放到尾声）r-lw/2 会变负，ctx.arc 抛 IndexSizeError */
  if(opts.ring !== 'none'){
    var lw = Math.max(1, r * (opts.ringWidth == null ? 0.09 : opts.ringWidth));
    var rr = r - lw/2;
    if(rr > 0){
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI*2);
      ctx.lineWidth = lw;
      ctx.strokeStyle = opts.ring || 'rgba(255,255,255,.92)';
      ctx.stroke();
      ctx.restore();
    }
  }
  return true;
}

/* canvas 用：方形圆角画一张脸（俄罗斯方块/砖块这类方格子更合适） */
function drawFaceRound(ctx, x, y, w, h, i, radius, opts){
  if(w <= 0 || h <= 0) return false;
  if(!ok(i)) { img(i); return false; }
  opts = opts || {};
  var r = Math.min(radius == null ? 8 : radius, w/2, h/2);

  ctx.save();
  roundPath(ctx, x, y, w, h, r);
  ctx.clip();
  var im = img(i);
  var side = Math.min(im.naturalWidth, im.naturalHeight);
  var sx = (im.naturalWidth  - side) / 2;
  var bias = opts.topBias == null ? 0.12 : opts.topBias;
  var sy = (im.naturalHeight - side) * bias;
  /* cover：短边贴满，长边居中溢出 */
  var scale = Math.max(w/side, h/side);
  var dw = side*scale, dh = side*scale;
  ctx.drawImage(im, sx, sy, side, side, x+(w-dw)/2, y+(h-dh)/2, dw, dh);
  ctx.restore();
  return true;
}

function roundPath(ctx, x, y, w, h, r){
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y,   x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
  ctx.lineTo(x+r, y+h);  ctx.quadraticCurveTo(x,   y+h, x,   y+h-r);
  ctx.lineTo(x, y+r);    ctx.quadraticCurveTo(x,   y,   x+r, y);
  ctx.closePath();
}

/* ---- DOM 用：把一张脸塞进元素 ------------------------------------------ */
function setFace(el, i){
  if(!el) return;
  el.classList.add('xuxu-face');
  el.style.backgroundImage = cssBg(i);
}

/* ---- 注入共用样式类 ---------------------------------------------------- */
var css = [
  '.xuxu-face{',
  '  background-size:cover;',
  '  background-position:center 15%;',   /* 偏上，保住脸 */
  '  background-repeat:no-repeat;',
  '}',
  '.xuxu-face-round{ border-radius:22%; }',
  '.xuxu-face-circle{ border-radius:50%; }'
].join('');
function injectStyle(){
  if(!document.head) return;
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);
}
if(document.head) injectStyle();
else document.addEventListener('DOMContentLoaded', injectStyle);

window.XUXU = {
  COUNT: COUNT,
  base: base,
  urls: URLS,
  url: url,
  cssBg: cssBg,
  img: img,
  ok: ok,
  preload: preload,
  drawFace: drawFace,
  drawFaceRound: drawFaceRound,
  setFace: setFace,
  roundPath: roundPath
};
})();
