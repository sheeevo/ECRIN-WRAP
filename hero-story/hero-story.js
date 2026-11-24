// Ecrin Wrap — scroll-driven garage intro ("hero story").
//
// The hero is a tall block with a sticky full-screen stage. Scrolling through
// it scrubs a sequence of chapters: the studio lights come on, the film is
// laid on the car, the colour changes, PPF, then hand-off to the site.
//
// Each chapter can be backed by a real frame sequence (WebP/JPG images
// extracted from an AI-generated or filmed clip, see hero-story/README.md).
// Until those exist, the chapter falls back to a canvas "placeholder" scene:
// a procedural studio with the client M2 cut out from its photo and recoloured.
//
// Usage: EcrinStory.mount(stageEl, scrollerEl); EcrinStory.start();
(function(){
  'use strict';

  // ── chapters ────────────────────────────────────────────────────────────
  // span: share of the total scroll length. seq: real frames, or null for the
  // placeholder. seq = { dir:'assets/hero-story/pose/', count:90, ext:'webp', pad:4 }
  // seqMobile: optional vertical (9:16) version used on portrait screens.
  const CHAPTERS = [
    { id:'studio',  label:'Studio',     span:0.12, seq:null, seqMobile:null },
    { id:'pose',    label:'Pose',       span:0.28, seq:null, seqMobile:null },
    { id:'teintes', label:'Teintes',    span:0.34, seq:null, seqMobile:null },
    { id:'ppf',     label:'Protection', span:0.14, seq:null, seqMobile:null },
    { id:'outro',   label:'',           span:0.12, seq:null, seqMobile:null },
  ];

  // films shown in the "teintes" chapter (first one is the film laid in "pose")
  const FILMS = [
    { name:'Satin Black',     line:'Avery Dennison SW900 · Satin',    tint:'#1f2124', gloss:.14, swatch:'#1b1d20',
      title:'Mode furtif.', sub:'Un noir satiné qui absorbe la lumière. Discret, jamais banal.' },
    { name:'Nardo Grey',      line:'Avery Dennison SW900 · Gloss',    tint:'#a3a7aa', gloss:.30, swatch:'#8d9195',
      title:'Le gris qui a tout compris.', sub:'La teinte béton préférée des puristes, sans toucher à la peinture.' },
    { name:'Candy Red',       line:'Avery Dennison SW900 · Gloss',    tint:'#c3121d', gloss:.42, swatch:'#b3121c',
      title:'Rouge, assumé.', sub:'Un brillant profond qui s’allume sous chaque néon.' },
    { name:'Midnight Purple', line:'Avery Dennison SW900 · ColorFlow', tint:'#4b2b95', flip:'#1d8a78', gloss:.38, swatch:'#4b2472',
      title:'Une couleur par angle.', sub:'Film caméléon : violet de face, émeraude de profil.' },
  ];

  // car cutout traced on assets/hero-m2.jpg (1616×1080)
  const CAR = {
    src:'assets/hero-m2.jpg', w:1616, h:1080, x0:306, x1:1314, top:474, ground:962,
    poly:[[312,868],[318,812],[340,778],[372,742],[392,706],[386,676],[400,664],[440,662],[458,664],
      [500,616],[548,572],[600,542],[700,514],[812,486],[880,492],[940,500],[1010,484],[1064,474],
      [1172,476],[1200,494],[1206,512],[1252,534],[1278,560],[1294,610],[1306,680],[1312,744],
      [1304,770],[1296,806],[1240,812],[1150,830],[1080,838],[1000,868],[880,898],[806,912],
      [790,934],[762,958],[702,966],[650,950],[626,912],[588,898],[420,906],[392,914],[380,930],
      [344,934],[320,916]]
  };

  const TAU = Math.PI*2;
  const clamp = (v,a,b) => v<a?a:v>b?b:v;
  const lerp = (a,b,t) => a+(b-a)*t;
  const smooth = (a,b,v) => { const t = clamp((v-a)/(b-a),0,1); return t*t*(3-2*t); };
  const ease = t => t<.5 ? 4*t*t*t : 1-Math.pow(-2*t+2,3)/2;

  // ── styles ──────────────────────────────────────────────────────────────
  const CSS = `
  .ecs-canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .ecs-layer{position:absolute;inset:0;pointer-events:none;z-index:3}
  .ecs-word{position:absolute;top:19%;left:0;right:0;text-align:center}
  .ecs-word-main{font-family:'Montserrat',sans-serif;font-weight:800;font-size:clamp(44px,8.6vw,140px);line-height:.9;letter-spacing:.04em;display:flex;justify-content:center;gap:.26em}
  .ecs-word-main span:first-child{background:linear-gradient(180deg,#fff 0%,#eef0f1 45%,#b9bdc0 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .ecs-word-main span:last-child{background:linear-gradient(180deg,#FF6067 0%,#EE3038 40%,#E4232B 62%,#A80D14 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .ecs-word-sub{margin-top:18px;font-family:'Montserrat',sans-serif;font-size:clamp(10px,1vw,13px);letter-spacing:.5em;text-transform:uppercase;color:var(--accent,#E4232B);font-weight:600;padding-left:.5em}
  .ecs-hint{position:absolute;bottom:34px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:.34em;text-transform:uppercase;color:#8c9095}
  .ecs-hint i{display:block;width:1px;height:34px;margin:12px auto 0;background:linear-gradient(180deg,var(--accent,#E4232B),transparent);animation:ecsBob 1.8s ease-in-out infinite}
  @keyframes ecsBob{0%,100%{transform:translateY(0);opacity:.45}50%{transform:translateY(7px);opacity:1}}
  .ecs-beat{position:absolute;left:clamp(20px,6vw,96px);bottom:clamp(64px,13vh,140px);max-width:min(560px,86vw)}
  .ecs-kicker{font-family:'Montserrat',sans-serif;font-size:11px;font-weight:700;letter-spacing:.34em;text-transform:uppercase;color:var(--accent,#E4232B);margin-bottom:14px}
  .ecs-title{font-family:'Montserrat',sans-serif;font-weight:800;font-size:clamp(34px,5.2vw,76px);line-height:.98;letter-spacing:-.01em;color:#F7F7F7;text-shadow:0 6px 40px rgba(0,0,0,.6)}
  .ecs-sub{margin-top:16px;font-size:clamp(14px,1.25vw,17px);line-height:1.6;font-weight:300;color:#c8ccd0;max-width:440px;text-shadow:0 2px 20px rgba(0,0,0,.8)}
  .ecs-chip{position:absolute;top:clamp(150px,23vh,230px);left:clamp(20px,6vw,96px);display:flex;align-items:center;gap:12px;padding:10px 16px 10px 10px;border-radius:6px;background:rgba(10,11,12,.62);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
  .ecs-chip-sw{width:30px;height:30px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.15),inset 0 8px 14px rgba(255,255,255,.12)}
  .ecs-chip-name{font-family:'Montserrat',sans-serif;font-size:13px;font-weight:700;color:#F7F7F7;letter-spacing:.02em}
  .ecs-chip-line{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8c9095;margin-top:3px}
  .ecs-rail{position:absolute;right:clamp(16px,3vw,42px);top:50%;transform:translateY(-50%);display:flex;flex-direction:column;gap:18px;align-items:flex-end}
  .ecs-rail div{display:flex;align-items:center;gap:12px;font-size:10px;letter-spacing:.24em;text-transform:uppercase;color:#6c7075;transition:color .4s}
  .ecs-rail div b{display:block;width:18px;height:1px;background:#3a3d40;transition:width .4s,background .4s}
  .ecs-rail div.on{color:#F7F7F7}
  .ecs-rail div.on b{width:34px;background:var(--accent,#E4232B);box-shadow:0 0 8px var(--glow,rgba(228,35,43,.5))}
  .ecs-outro{position:absolute;left:0;right:0;bottom:clamp(64px,14vh,150px);text-align:center;padding:0 20px}
  .ecs-outro .ecs-title{font-size:clamp(32px,4.6vw,66px)}
  .ecs-outro .ecs-sub{margin:16px auto 0}
  .ecs-cta{pointer-events:auto;display:inline-flex;align-items:center;gap:12px;margin-top:30px;padding:16px 30px;border:none;border-radius:4px;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:#fff;background:linear-gradient(180deg,#EE3038,#A80D14);box-shadow:0 14px 40px rgba(228,35,43,.35);transition:transform .3s,box-shadow .3s}
  .ecs-cta:hover{transform:translateY(-2px);box-shadow:0 18px 50px rgba(228,35,43,.5)}
  .ecs-badge{position:absolute;right:14px;bottom:12px;font-size:9px;letter-spacing:.2em;text-transform:uppercase;color:#6c7075;padding:5px 9px;border:1px dashed #3a3d40;border-radius:3px;background:rgba(5,5,5,.5)}
  .ecs-progress{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(255,255,255,.05)}
  .ecs-progress i{display:block;height:100%;width:0;background:var(--accent,#E4232B);box-shadow:0 0 10px var(--glow,rgba(228,35,43,.5))}
  @media (max-width:760px){
    .ecs-word{top:18%}
    .ecs-rail{display:none}
    .ecs-beat{bottom:clamp(48px,9vh,90px);left:20px;right:20px}
    .ecs-chip{top:22vh;left:20px}
    .ecs-title{font-size:clamp(30px,9vw,44px)}
  }`;

  // ── helpers ─────────────────────────────────────────────────────────────
  function el(tag, cls, html){ const e = document.createElement(tag); if(cls) e.className = cls; if(html != null) e.innerHTML = html; return e; }
  function canvas(w,h){ const c = document.createElement('canvas'); c.width = Math.max(1,w|0); c.height = Math.max(1,h|0); return c; }
  function loadImg(src){ return new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }

  // frame sequence: lazy-loads images, returns the nearest loaded frame
  function Sequence(cfg){
    const frames = new Array(cfg.count);
    const pad = n => String(n).padStart(cfg.pad||4,'0');
    let next = 0, loading = 0;
    function pump(){
      while(loading < 6 && next < cfg.count){
        const i = next++; loading++;
        loadImg(cfg.dir + pad(i+1) + '.' + (cfg.ext||'webp')).then(img => { frames[i] = img; loading--; pump(); });
      }
    }
    return {
      start: pump,
      ready(){ return !!frames[0]; },
      get(t){
        const want = Math.round(clamp(t,0,1)*(cfg.count-1));
        for(let d = 0; d < cfg.count; d++){
          if(frames[want-d]) return frames[want-d];
          if(frames[want+d]) return frames[want+d];
        }
        return null;
      }
    };
  }

  // ── the story ───────────────────────────────────────────────────────────
  function Story(stage, scroller){
    this.stage = stage;
    this.scroller = scroller || window;
    this.track = stage.parentElement;     // tall block whose scroll drives us
    this.progress = 0; this.target = 0;
    this.lit = 0; this.litTarget = 0; this.started = false;
    this.dirty = true;
    const tall = window.innerHeight > window.innerWidth*1.05;
    CHAPTERS.forEach(c => { const cfg = (tall && c.seqMobile) || c.seq; c.seqObj = cfg ? Sequence(cfg) : null; if(c.seqObj) c.seqObj.start(); });
    let acc = 0; CHAPTERS.forEach(c => { c.start = acc; acc += c.span; c.end = acc; });
    this.build();
    loadImg(CAR.src).then(img => { this.carImg = img; this.layout(); });
    if(document.fonts && document.fonts.ready) document.fonts.ready.then(() => { this.bg = null; this.dirty = true; });
    // ?ecs-p=0.4 freezes the story at that progress (for screenshots/review)
    const fp = parseFloat(new URLSearchParams(location.search).get('ecs-p'));
    if(!isNaN(fp)){ this.started = true; this.t0 = performance.now() - 1e5; }
    this.onScroll = () => { this.target = isNaN(fp) ? this.measure() : clamp(fp,0,1); };
    this.onResize = () => { this.layout(); this.onScroll(); };
    (this.scroller === window ? window : this.scroller).addEventListener('scroll', this.onScroll, { passive:true });
    window.addEventListener('resize', this.onResize);
    this.onScroll();
    this.progress = this.target;
    this.tick = this.tick.bind(this);
    requestAnimationFrame(this.tick);
  }

  Story.prototype.build = function(){
    if(!document.getElementById('ecs-css')){ const s = el('style'); s.id = 'ecs-css'; s.textContent = CSS; document.head.appendChild(s); }
    const st = this.stage;
    this.cv = el('canvas','ecs-canvas'); st.insertBefore(this.cv, st.firstChild);
    this.ctx = this.cv.getContext('2d');
    const L = this.layer = el('div','ecs-layer'); st.insertBefore(L, this.cv.nextSibling);

    this.word = el('div','ecs-word','<div class="ecs-word-main"><span>ECRIN</span><span>WRAP</span></div><div class="ecs-word-sub">Covering &middot; PPF &middot; Detailing</div>');
    this.hint = el('div','ecs-hint','Faites défiler<i></i>');
    L.append(this.word, this.hint);

    this.chip = el('div','ecs-chip','<div class="ecs-chip-sw"></div><div><div class="ecs-chip-name"></div><div class="ecs-chip-line"></div></div>');
    L.append(this.chip);

    // text beats: [start, end] in global progress
    const P = id => CHAPTERS.find(c => c.id === id);
    const pose = P('pose'), tei = P('teintes'), ppf = P('ppf'), out = P('outro');
    this.beats = [];
    const beat = (a, b, kicker, title, sub) => {
      const e = el('div','ecs-beat',`<div class="ecs-kicker">${kicker}</div><div class="ecs-title">${title}</div><div class="ecs-sub">${sub}</div>`);
      L.append(e); this.beats.push({ a, b, e });
    };
    beat(lerp(pose.start,pose.end,.06), lerp(pose.start,pose.end,.94), '01 — La pose', 'Chaque panneau,<br>posé à la main.', 'Film découpé sur mesure, bords repliés, raccords invisibles. Aucune bulle, aucun compromis.');
    const n = FILMS.length, seg = tei.span/n;
    FILMS.forEach((f,i) => beat(tei.start+seg*i+seg*.22, tei.start+seg*(i+1)+seg*.12, '02 — Les teintes', f.title, f.sub));
    beat(lerp(ppf.start,ppf.end,.08), lerp(ppf.start,ppf.end,.92), '03 — La protection', 'Invisible.<br>Increvable.', 'Film PPF autocicatrisant : gravillons, rayures et UV n’atteignent plus votre peinture.');

    this.outro = el('div','ecs-outro','<div class="ecs-kicker">Ecrin Wrap Studio</div><div class="ecs-title">À vous de choisir<br>votre signature.</div><div class="ecs-sub">Plus de 80 teintes Avery Dennison, essayez-les sur votre véhicule en 3D.</div>');
    const cta = el('button','ecs-cta','Configurer mon véhicule <span>&darr;</span>');
    cta.addEventListener('click', () => {
      const t = document.getElementById('configurateur');
      if(t) t.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    this.outro.append(cta); L.append(this.outro);
    this.outroRange = [out.start + out.span*.15, 1.01];

    this.rail = el('div','ecs-rail');
    this.railItems = CHAPTERS.filter(c => c.label).map(c => { const d = el('div','',`${c.label}<b></b>`); this.rail.append(d); return { c, d }; });
    L.append(this.rail);

    this.badge = el('div','ecs-badge','Visuel provisoire');
    this.bar = el('div','ecs-progress','<i></i>');
    L.append(this.badge, this.bar);
  };

  Story.prototype.measure = function(){
    const vh = this.scroller === window ? window.innerHeight : this.scroller.clientHeight;
    const top = this.track.getBoundingClientRect().top - (this.scroller === window ? 0 : this.scroller.getBoundingClientRect().top);
    const len = this.track.offsetHeight - vh;
    return len > 0 ? clamp(-top/len, 0, 1) : 0;
  };

  // canvas sizing + every cache that depends on it
  Story.prototype.layout = function(){
    const r = this.stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const W = Math.round(r.width*dpr), H = Math.round(r.height*dpr);
    if(!W || !H) return;
    this.cv.width = W; this.cv.height = H; this.W = W; this.H = H; this.dpr = dpr;
    const portrait = H > W*1.05;
    this.portrait = portrait;
    this.floorY = H*(portrait ? .56 : .66);
    // car box: ground line + width, cut from the photo's car bbox
    const carW = Math.min(W*(portrait ? .94 : .54), H*(portrait ? .9 : 1.05));
    const s = carW/(CAR.x1-CAR.x0);
    this.carS = s;
    this.carBox = { x: (W-carW)/2, w: carW, h: (CAR.ground-CAR.top)*s };
    this.groundY = H*(portrait ? .66 : .82);
    this.carBox.y = this.groundY - this.carBox.h;
    this.bg = null;
    if(this.carImg) this.buildCar();
    this.dirty = true;
  };

  // pre-render the car cutout + one recoloured layer per film
  Story.prototype.buildCar = function(){
    const s = this.carS, bw = Math.ceil(this.carBox.w), bh = Math.ceil(this.carBox.h);
    const cut = canvas(bw, bh), c = cut.getContext('2d');
    const mask = canvas(bw, bh), m = mask.getContext('2d');
    m.translate(-CAR.x0*s, -CAR.top*s);
    m.beginPath(); CAR.poly.forEach(([x,y],i) => i ? m.lineTo(x*s,y*s) : m.moveTo(x*s,y*s)); m.closePath();
    m.fillStyle = '#000';
    if('filter' in m) m.filter = `blur(${Math.max(.6, s*1.6)}px)`;
    m.fill();
    c.drawImage(this.carImg, -CAR.x0*s, -CAR.top*s, CAR.w*s, CAR.h*s);
    // grade the outdoor photo toward studio light: cooler, less sky cast
    c.globalCompositeOperation = 'saturation'; c.fillStyle = 'rgba(128,128,128,.55)'; c.fillRect(0,0,bw,bh);
    c.globalCompositeOperation = 'destination-in'; c.drawImage(mask,0,0);
    c.globalCompositeOperation = 'source-over';
    this.carCut = cut;
    this.carFilms = FILMS.map(f => {
      const t = canvas(bw, bh), x = t.getContext('2d');
      x.drawImage(cut,0,0);
      x.globalCompositeOperation = 'multiply';
      if(f.flip){
        const g = x.createLinearGradient(0,0,bw,bh*.4);
        g.addColorStop(0, f.flip); g.addColorStop(.45, f.tint); g.addColorStop(1, f.tint);
        x.fillStyle = g;
      } else x.fillStyle = f.tint;
      x.fillRect(0,0,bw,bh);
      // bring back some of the original reflections so it reads as gloss
      x.globalCompositeOperation = 'screen'; x.globalAlpha = f.gloss*.55; x.drawImage(cut,0,0);
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'destination-in'; x.drawImage(mask,0,0);
      return t;
    });
    this.carMask = mask;
    this.fx = canvas(bw, bh);
  };

  // static studio: walls, floor, wall wordmark (lights are drawn live)
  Story.prototype.buildBg = function(){
    const { W, H, floorY } = this;
    const bg = canvas(W, H), x = bg.getContext('2d');
    let g = x.createLinearGradient(0,0,0,floorY);
    g.addColorStop(0,'#08090a'); g.addColorStop(1,'#16171a');
    x.fillStyle = g; x.fillRect(0,0,W,floorY);
    // wall panels
    x.strokeStyle = 'rgba(255,255,255,.028)'; x.lineWidth = Math.max(1, W/1400);
    const cols = this.portrait ? 5 : 9;
    for(let i = 1; i < cols; i++){ const px = W*i/cols; x.beginPath(); x.moveTo(px, H*.24); x.lineTo(px, floorY); x.stroke(); }
    // wall wordmark
    x.save();
    x.font = `800 ${Math.round(W*(this.portrait ? .16 : .11))}px Montserrat, sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,.035)';
    x.fillText('ECRIN WRAP', W/2, lerp(H*.30, floorY, .38));
    x.restore();
    // floor
    g = x.createLinearGradient(0,floorY,0,H);
    g.addColorStop(0,'#1d1e21'); g.addColorStop(.35,'#121315'); g.addColorStop(1,'#08090a');
    x.fillStyle = g; x.fillRect(0,floorY,W,H-floorY);
    // epoxy floor sheen
    g = x.createRadialGradient(W/2, this.groundY, 0, W/2, this.groundY, W*.6);
    g.addColorStop(0,'rgba(255,255,255,.06)'); g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0,floorY,W,H-floorY);
    this.bg = bg;
  };

  // ceiling light bars: rows in perspective, each with an "on" level
  Story.prototype.lights = function(){
    const { W, H } = this;
    const rows = this.portrait
      ? [{y:.05,n:2,len:.34,gap:.14},{y:.095,n:2,len:.4,gap:.12},{y:.14,n:3,len:.28,gap:.05}]
      : [{y:.045,n:3,len:.2,gap:.07},{y:.095,n:3,len:.24,gap:.05},{y:.15,n:4,len:.2,gap:.025}];
    const out = []; let k = 0;
    rows.forEach((r, ri) => {
      const total = r.n*r.len + (r.n-1)*r.gap, x0 = (1-total)/2;
      for(let i = 0; i < r.n; i++) out.push({ x:(x0 + i*(r.len+r.gap))*W, y:r.y*H, w:r.len*W, h:Math.max(2, H*(.0045 + ri*.0018)), k:k++ });
    });
    return out;
  };

  Story.prototype.start = function(){
    if(this.started) return; this.started = true;
    this.t0 = performance.now();
  };

  // lights-on level for bar k (time-driven intro with a little flicker)
  Story.prototype.barOn = function(k, n){
    if(!this.started) return 0;
    const t = (performance.now() - this.t0)/1000;
    const a = .25 + k*(1.6/n);
    if(t < a) return 0;
    const u = t - a;
    if(u < .32) return (Math.sin(u*90) > .2 ? .9 : .08) * (u < .1 ? .5 : 1);
    return 1;
  };

  Story.prototype.tick = function(){
    requestAnimationFrame(this.tick);
    const d = this.target - this.progress;
    const moving = Math.abs(d) > .0002;
    this.progress = moving ? this.progress + d*.12 : this.target;
    const intro = this.started && performance.now() - this.t0 < 4200;
    if(!moving && !intro && !this.dirty && !(this.started && !this._litDone)) return;
    this.dirty = false;
    this.draw(this.progress);
    this.updateDom(this.progress);
  };

  Story.prototype.chapterAt = function(p){
    for(const c of CHAPTERS) if(p < c.end) return { c, t: clamp((p-c.start)/c.span,0,1) };
    const c = CHAPTERS[CHAPTERS.length-1]; return { c, t:1 };
  };

  // what the car looks like at progress p: base film, next film, wipe position
  Story.prototype.carState = function(p){
    const P = id => CHAPTERS.find(c => c.id === id);
    const pose = P('pose'), tei = P('teintes'), ppf = P('ppf');
    if(p < pose.start) return { base:-1, next:-1, wipe:0, clear:false };
    if(p < pose.end){
      const t = (p-pose.start)/pose.span;
      return { base:-1, next:0, wipe:ease(smooth(.12,.86,t)), clear:false };
    }
    if(p < tei.end){
      const n = FILMS.length, seg = tei.span/n;
      const i = Math.min(n-1, Math.floor((p-tei.start)/seg));
      const t = (p - tei.start - seg*i)/seg;
      // hold the colour, then sweep in the next one at the end of the segment
      if(i < n-1) return { base:i, next:i+1, wipe:ease(smooth(.62,1,t)), clear:false };
      return { base:i, next:i, wipe:0, clear:false };
    }
    if(p < ppf.end){
      const t = (p-ppf.start)/ppf.span;
      return { base:FILMS.length-1, next:FILMS.length-1, wipe:ease(smooth(.1,.8,t)), clear:true };
    }
    return { base:FILMS.length-1, next:FILMS.length-1, wipe:1, clear:true };
  };

  Story.prototype.draw = function(p){
    const { ctx, W, H } = this;
    if(!W) return;
    const { c, t } = this.chapterAt(p);

    // a real frame sequence replaces the whole placeholder scene; the outro
    // holds the last frame of the protection chapter when that one is real
    const ppfSeq = CHAPTERS.find(k => k.id === 'ppf').seqObj;
    const seq = c.id === 'outro' && ppfSeq ? ppfSeq : c.seqObj;
    if(seq && seq.ready()){
      const img = seq.get(c.id === 'outro' ? 1 : t);
      if(img){
        const s = Math.max(W/img.naturalWidth, H/img.naturalHeight);
        const w = img.naturalWidth*s, h = img.naturalHeight*s;
        ctx.drawImage(img, (W-w)/2, (H-h)/2, w, h);
        this.vignette(c.id === 'outro' ? smooth(0,1,t) : 0);
        this.usingPlaceholder = false;
        return;
      }
    }
    this.usingPlaceholder = true;
    if(!this.bg) this.buildBg();

    // slow camera push over the whole story
    const zoom = 1 + .07*ease(clamp(p/.9,0,1)) - .04*smooth(.9,1,p);
    ctx.save();
    ctx.fillStyle = '#050505'; ctx.fillRect(0,0,W,H);
    ctx.translate(W/2, this.groundY); ctx.scale(zoom, zoom); ctx.translate(-W/2, -this.groundY);
    ctx.drawImage(this.bg, 0, 0);

    const bars = this.lights();
    let litSum = 0;
    bars.forEach(b => { b.on = this.barOn(b.k, bars.length); litSum += b.on; });
    const lit = litSum/bars.length;
    if(this.started && performance.now() - this.t0 > 4200) this._litDone = true;

    // wall wash behind the car + red accent strip
    const accent = getComputedStyle(this.stage).getPropertyValue('--accent').trim() || '#E4232B';
    let g = ctx.createRadialGradient(W/2, this.floorY, 0, W/2, this.floorY, W*.55);
    g.addColorStop(0, `rgba(210,215,220,${.09*lit})`); g.addColorStop(1, 'rgba(210,215,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, this.floorY);
    ctx.save();
    ctx.globalAlpha = .25 + .55*lit;
    ctx.shadowColor = accent; ctx.shadowBlur = 24*this.dpr;
    ctx.fillStyle = accent;
    ctx.fillRect(W*.04, this.floorY - H*.012, W*.92, Math.max(1.5, H*.0022));
    ctx.restore();

    // light bar reflections on the floor
    bars.forEach(b => {
      if(b.on <= 0) return;
      const rx = b.x + b.w/2, rw = b.w*.5;
      const rg = ctx.createLinearGradient(0, this.floorY, 0, H);
      rg.addColorStop(0, 'rgba(255,255,255,0)');
      rg.addColorStop(.15, `rgba(255,255,255,${.05*b.on})`);
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rg;
      ctx.fillRect(rx - rw/2, this.floorY, rw, H - this.floorY);
    });

    // car
    if(this.carCut){
      const st = this.carState(p);
      const layer = this.composeCar(st, p);
      const { x, y, w, h } = this.carBox;
      // contact shadow
      ctx.save();
      const sh = ctx.createRadialGradient(W/2, this.groundY, 0, W/2, this.groundY, w*.55);
      sh.addColorStop(0,'rgba(0,0,0,.75)'); sh.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = sh; ctx.translate(0, this.groundY); ctx.scale(1, .12); ctx.translate(0, -this.groundY);
      ctx.fillRect(x - w*.1, this.groundY - w*.6, w*1.2, w*1.2);
      ctx.restore();
      // floor reflection: flipped car, faded out with distance from the ground
      const rc = this._refl && this._refl.width === layer.width && this._refl.height === layer.height ? this._refl : (this._refl = canvas(layer.width, layer.height));
      const rx = rc.getContext('2d');
      rx.globalCompositeOperation = 'source-over'; rx.clearRect(0, 0, rc.width, rc.height);
      rx.save(); rx.translate(0, rc.height); rx.scale(1, -1); rx.drawImage(layer, 0, 0); rx.restore();
      rx.globalCompositeOperation = 'destination-in';
      g = rx.createLinearGradient(0, 0, 0, rc.height*.6);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      rx.fillStyle = g; rx.fillRect(0, 0, rc.width, rc.height);
      ctx.globalAlpha = .18 + .1*lit;
      ctx.drawImage(rc, x, this.groundY, w, h);
      ctx.globalAlpha = 1;
      // the car itself
      ctx.globalAlpha = .25 + .75*lit;
      ctx.drawImage(layer, x, y, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // darkness before the lights come on (the bars themselves glow on top)
    if(lit < 1){ ctx.fillStyle = `rgba(3,3,4,${.88*(1-lit)})`; ctx.fillRect(0,0,W,H); }
    ctx.save();
    ctx.translate(W/2, this.groundY); ctx.scale(zoom, zoom); ctx.translate(-W/2, -this.groundY);
    bars.forEach(b => {
      if(b.on <= 0) return;
      ctx.globalAlpha = b.on;
      ctx.shadowColor = 'rgba(235,240,255,.9)'; ctx.shadowBlur = 26*this.dpr;
      ctx.fillStyle = '#f4f6fb';
      ctx.beginPath();
      if(ctx.roundRect) ctx.roundRect(b.x, b.y, b.w, b.h, b.h/2); else ctx.rect(b.x, b.y, b.w, b.h);
      ctx.fill();
    });
    ctx.restore();

    this.vignette(c.id === 'outro' ? smooth(.2,1,t) : 0);
  };

  // build the car for this frame into this.fx: base film + next film wiped in
  Story.prototype.composeCar = function(st, p){
    const fx = this.fx, x = fx.getContext('2d'), w = fx.width, h = fx.height;
    const layer = i => i < 0 ? this.carCut : this.carFilms[i];
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
    x.clearRect(0,0,w,h);
    x.drawImage(layer(st.base), 0, 0);
    if(st.wipe <= 0) return fx;

    // the incoming film (PPF = original paint, clear film on top)
    const inc = st.clear ? this.carCut : layer(st.next);
    const slant = h*.55;
    const edge = lerp(-slant, w + slant, st.wipe);
    if(!this._tmp || this._tmp.width !== w || this._tmp.height !== h) this._tmp = canvas(w, h);
    const t = this._tmp, tx = t.getContext('2d');
    tx.globalCompositeOperation = 'source-over'; tx.clearRect(0,0,w,h);
    tx.drawImage(inc, 0, 0);
    tx.globalCompositeOperation = 'destination-in';
    tx.beginPath(); tx.moveTo(-w, 0); tx.lineTo(edge + slant/2, 0); tx.lineTo(edge - slant/2, h); tx.lineTo(-w, h); tx.closePath();
    tx.fill();
    x.drawImage(t, 0, 0);

    // squeegee edge: a bright line along the wipe, clipped to the car
    if(st.wipe < 1){
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0,0,w,h);
      const lw = Math.max(6, w*.02);
      tx.save();
      tx.translate(edge, h/2); tx.rotate(Math.atan2(slant, h));
      const g = tx.createLinearGradient(-lw*3, 0, lw, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(.75, st.clear ? 'rgba(190,230,255,.55)' : 'rgba(255,255,255,.35)');
      g.addColorStop(.92, 'rgba(255,255,255,.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      tx.fillStyle = g; tx.fillRect(-lw*3, -h, lw*4, h*2);
      tx.restore();
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(this.carMask, 0, 0);
      x.globalCompositeOperation = 'screen'; x.drawImage(t, 0, 0);
      x.globalCompositeOperation = 'source-over';
    }
    // PPF: a gloss band sweeps behind the edge
    if(st.clear && st.wipe > 0){
      tx.globalCompositeOperation = 'source-over'; tx.clearRect(0,0,w,h);
      const bx = lerp(-w*.3, w*1.3, clamp(st.wipe*1.15 - .1, 0, 1));
      const g = tx.createLinearGradient(bx - w*.12, 0, bx + w*.12, 0);
      g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(.5,'rgba(255,255,255,.22)'); g.addColorStop(1,'rgba(255,255,255,0)');
      tx.fillStyle = g; tx.fillRect(0,0,w,h);
      tx.globalCompositeOperation = 'destination-in'; tx.drawImage(this.carMask, 0, 0);
      x.globalCompositeOperation = 'screen'; x.drawImage(t, 0, 0);
      x.globalCompositeOperation = 'source-over';
    }
    return fx;
  };

  Story.prototype.vignette = function(fade){
    const { ctx, W, H } = this;
    const g = ctx.createRadialGradient(W/2, H*.46, Math.min(W,H)*.35, W/2, H*.46, Math.max(W,H)*.78);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.6)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    // bottom fade so the outro text reads, then blend into the next section
    const b = ctx.createLinearGradient(0, H*.45, 0, H);
    b.addColorStop(0,'rgba(5,5,5,0)'); b.addColorStop(1,`rgba(5,5,5,${.55 + .4*fade})`);
    ctx.fillStyle = b; ctx.fillRect(0,0,W,H);
    if(fade > 0){ ctx.fillStyle = `rgba(5,5,5,${.62*fade})`; ctx.fillRect(0,0,W,H); }
  };

  Story.prototype.updateDom = function(p){
    const show = (e, o, dy) => { e.style.opacity = o.toFixed(3); e.style.transform = `translateY(${((1-o)*(dy||18)).toFixed(1)}px)`; e.style.visibility = o > .01 ? 'visible' : 'hidden'; };
    const lit = this.started ? clamp((performance.now() - this.t0 - 600)/1400, 0, 1) : 0;
    const w = (1 - smooth(.02, .085, p)) * lit;
    show(this.word, w, -24);
    show(this.hint, (1 - smooth(.005, .03, p)) * lit, 0);
    this.beats.forEach(b => show(b.e, smooth(b.a, b.a + .025, p) * (1 - smooth(b.b - .025, b.b, p))));
    show(this.outro, smooth(this.outroRange[0], this.outroRange[0] + .05, p));

    // film chip follows whatever film is on the car
    const st = this.carState(p);
    let fi = st.clear ? -2 : (st.base < 0 ? (st.wipe > .02 ? st.next : -1) : (st.wipe > .5 ? st.next : st.base));
    const chipOn = fi >= 0 ? 1 - smooth(.9, .94, p) : (st.clear ? 1 - smooth(.88, .91, p) : 0);
    if(fi !== this._chipFilm){
      this._chipFilm = fi;
      const f = fi >= 0 ? FILMS[fi] : { name:'PPF Ultra Clear', line:'Film de protection · 200 µm', swatch:'linear-gradient(135deg,rgba(255,255,255,.35),rgba(255,255,255,.05))' };
      this.chip.querySelector('.ecs-chip-sw').style.background = f.swatch;
      this.chip.querySelector('.ecs-chip-name').textContent = f.name;
      this.chip.querySelector('.ecs-chip-line').textContent = f.line;
    }
    show(this.chip, chipOn, -10);

    const cur = this.chapterAt(p).c;
    this.railItems.forEach(r => r.d.classList.toggle('on', r.c === cur));
    show(this.rail, smooth(.03, .08, p) * (1 - smooth(.88, .92, p)), 0);
    this.badge.style.display = this.usingPlaceholder ? '' : 'none';
    this.bar.firstChild.style.width = (p*100).toFixed(2) + '%';
  };

  let inst = null;
  window.EcrinStory = {
    mount(stage, scroller){ if(!inst && stage) inst = new Story(stage, scroller); return inst; },
    start(){ if(inst) inst.start(); },
    chapters: CHAPTERS, films: FILMS
  };
})();
