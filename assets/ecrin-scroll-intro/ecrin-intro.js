/*!
 * Écrin Wrap — intro au scroll (arrêts sur image + clips joués au scroll)
 * Usage :
 *   <section id="ecrin-intro" data-base="/ecrin-scroll-intro/assets"></section>
 *   <link rel="stylesheet" href="/ecrin-scroll-intro/ecrin-intro.css">
 *   <script src="/ecrin-scroll-intro/ecrin-intro.js" defer></script>
 * Le script remplit lui-même la section. Aucune dépendance.
 */
(function () {
  'use strict';

  var CLIPS = 6;          // 6 clips
  var FPC = 75;           // 5 s × 15 images/s par clip
  var N = CLIPS * FPC;    // 450 images
  var HOLD = 0.8;         // distance de scroll d'un arrêt (en hauteurs d'écran)
  var PLAY = 1.3;         // distance de scroll d'un clip (en hauteurs d'écran)
  var FADE = 0.14;        // part du clip utilisée pour le fondu avec l'arrêt

  var STEPS = [
    { cls: '', html: '<div class="ew-tag"><i style="--sw:#c8101a"></i>Peinture d’origine</div><h1>Votre voiture.<br>Notre écrin.</h1><p>Covering, PPF et detailing haut de gamme, posés à la main dans notre atelier liégeois. Scrollez pour suivre la transformation.</p>' },
    { cls: '', html: '<div class="ew-tag"><i style="--sw:#1d1e21"></i>Étape 1 · Covering noir mat</div><h2>Posé à la main,<br>panneau par panneau.</h2><ul><li>Film vinyle coulé, chauffé et étiré pour épouser chaque courbe</li><li>Marouflé à la raclette feutrée, sans bulle ni pli</li><li>Bords repliés, aucune découpe sur votre carrosserie</li></ul>' },
    { cls: '', html: '<div class="ew-tag"><i style="--sw:#1d1e21"></i>Covering terminé</div><h2>Le rouge a disparu.<br>Pas la peinture.</h2><p>La peinture d’origine reste intacte sous le film. Envie de changer dans quelques années ? Le covering se retire proprement.</p>' },
    { cls: '', html: '<div class="ew-tag"><i style="--sw:linear-gradient(135deg,#ffffff55,#9fe7ff33)"></i>Étape 2 · PPF</div><h2>Un bouclier<br>transparent par-dessus.</h2><p>Le PPF est un film polyuréthane épais et transparent, posé au liquide de pose sur toute la voiture ou seulement sur les zones exposées. Il protège le covering ou la peinture des gravillons, rayures et fientes — sans changer la teinte.</p>' },
    { cls: '', html: '<div class="ew-tag"><i style="--sw:#ff6a00"></i>Le test</div><h2>Un coup de cutter ?</h2><p>Une rayure qui marquerait n’importe quelle peinture. Sur la zone protégée, elle reste dans le film — la surface en dessous n’est pas touchée.</p>' },
    { cls: '', html: '<div class="ew-tag"><i style="--sw:#e3131b"></i>Auto-cicatrisant</div><h2>Un peu de chaleur.<br>Disparue.</h2><p>La couche supérieure du PPF se referme sous la chaleur — soleil, eau chaude ou pistolet thermique. Les micro-rayures s’effacent, la surface redevient lisse.</p>' },
    { cls: 'ew-center', html: '<p class="ew-sub">Covering · PPF · Detailing</p><div class="ew-cta"><a class="ew-btn" href="#contact" data-ew-devis>Demander un devis</a><a class="ew-btn ew-ghost" href="#portfolio">Nos réalisations</a></div>' }
  ];

  function init(root) {
    if (root._ewInit) return; root._ewInit = true;
    var base = (root.getAttribute('data-base') || 'assets').replace(/\/$/, '');
    var pad = function (i) { return String(i).padStart(3, '0'); };
    var frameSrc = function (i) { return base + '/seq/f' + pad(i + 1) + '.webp'; };

    // Timeline : arrêt 0, clip 1, arrêt 1, … arrêt 6
    var segs = [], tot = 0;
    for (var k = 0; k < STEPS.length; k++) {
      segs.push({ t: 'h', k: k, a: tot, b: tot + HOLD }); tot += HOLD;
      if (k < CLIPS) { segs.push({ t: 'p', k: k, a: tot, b: tot + PLAY }); tot += PLAY; }
    }

    root.classList.add('ew-intro');
    root.style.height = 'calc(' + (tot * 100) + 'vh + 100vh)';
    // téléphone : une image sur deux, pour diviser le poids par deux
    var steps = Math.min(window.innerWidth, window.innerHeight) < 600 ? [8, 4, 2] : [8, 4, 2, 1];
    root.innerHTML =
      '<div class="ew-stage">' +
        '<canvas class="ew-cv" aria-hidden="true"></canvas>' +
        '<div class="ew-loader"><span>Chargement de l’atelier… 0%</span><i></i></div>' +
        '<div class="ew-steps">' + STEPS.map(function (s) { return '<div class="ew-step ' + s.cls + '">' + s.html + '</div>'; }).join('') + '</div>' +
        '<div class="ew-progress" aria-hidden="true">' + STEPS.map(function () { return '<span></span>'; }).join('') + '</div>' +
        '<div class="ew-hint">Scrollez</div>' +
      '</div>';

    var stage = root.querySelector('.ew-stage');
    // « Demander un devis » : le site ouvre son propre formulaire
    root.querySelector('[data-ew-devis]').addEventListener('click', function (e) {
      if (!root.dispatchEvent(new CustomEvent('ew-devis', { cancelable: true }))) e.preventDefault();
    });

    var cv = root.querySelector('.ew-cv'), cx = cv.getContext('2d');
    var stepEls = [].slice.call(root.querySelectorAll('.ew-step'));
    var bars = [].slice.call(root.querySelectorAll('.ew-progress span'));
    var loader = root.querySelector('.ew-loader'), lt = loader.querySelector('span'), lb = loader.querySelector('i');
    var hint = root.querySelector('.ew-hint');

    var imgs = new Array(N), loaded = 0, view = null, curKey = '';
    var ok = function (im) { return im && im.complete && im.naturalWidth; };

    // Images d'arrêt en haute définition
    var stills = STEPS.map(function (_, k) {
      var im = new Image();
      im.onload = function () { if (k === 0) loader.classList.add('ew-done'); curKey = ''; draw(); };
      im.src = base + '/kf/k' + k + '.webp';
      return im;
    });

    // Chargement : arrêts d'abord, puis 1 image sur 8, puis le reste
    function load(i) {
      if (imgs[i]) return;
      var im = new Image(); im.decoding = 'async';
      im.onload = function () {
        loaded++;
        var pc = Math.round(loaded / N * 100);
        lt.textContent = 'Chargement de l’atelier… ' + pc + '%';
        lb.style.setProperty('--p', pc + '%');
        if (loaded >= 60) loader.classList.add('ew-done');
        curKey = ''; draw();
      };
      im.src = frameSrc(i); imgs[i] = im;
    }
    var order = [], seen = {};
    var add = function (i) { if (i >= 0 && i < N && !seen[i]) { seen[i] = 1; order.push(i); } };
    add(0); for (var c = 0; c < CLIPS; c++) add(c * FPC + FPC - 1);
    steps.forEach(function (st) { for (var i = 0; i < N; i += st) add(i); });
    var oi = 0;
    (function pump() { var n = 0; while (oi < order.length && n < 8) { load(order[oi++]); n++; } if (oi < order.length) setTimeout(pump, 50); })();

    function nearest(i) {
      for (var r = 0; r < N; r++) {
        if (ok(imgs[i - r])) return imgs[i - r];
        if (ok(imgs[i + r])) return imgs[i + r];
      }
      return null;
    }
    function paint(im, alpha) {
      var W = cv.width, H = cv.height, port = W / H < 1;
      var r = port ? (W / im.naturalWidth) * 1.45 : Math.max(W / im.naturalWidth, H / im.naturalHeight);
      var w = im.naturalWidth * r, h = im.naturalHeight * r;
      cx.globalAlpha = alpha;
      cx.drawImage(im, (W - w) / 2, port ? H * 0.36 - h / 2 : (H - h) / 2, w, h);
      cx.globalAlpha = 1;
      if (port) {
        // portrait : fondre le haut et le bas de l'image dans le noir
        var top = H * 0.36 - h / 2, band = h * 0.18;
        [[top - 1, top + band], [top + h + 1, top + h - band]].forEach(function (e) {
          var g = cx.createLinearGradient(0, e[0], 0, e[1]);
          g.addColorStop(0, '#000'); g.addColorStop(1, 'rgba(0,0,0,0)');
          cx.fillStyle = g; cx.fillRect(0, Math.min(e[0], e[1]), W, Math.abs(e[1] - e[0]));
        });
      }
    }
    function draw() {
      var v = view; if (!v) return;
      var key = JSON.stringify(v); if (key === curKey) return;
      var fr = v.frame != null ? nearest(v.frame) : null;
      var st = v.k != null ? stills[v.k] : null;
      if (!fr && !ok(st)) return;
      curKey = key;
      cx.fillStyle = '#000'; cx.fillRect(0, 0, cv.width, cv.height);
      if (v.frame == null) { paint(ok(st) ? st : fr, 1); return; }
      if (fr) paint(fr, 1);
      if (ok(st) && v.m > 0) paint(st, v.m); else if (!fr && ok(st)) paint(st, 1);
    }
    function size() {
      var d = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = cv.clientWidth * d; cv.height = cv.clientHeight * d;
      curKey = ''; draw();
    }
    var ease = function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; };
    var ticking = false;
    function onScroll() {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var r = root.getBoundingClientRect(), len = r.height - stage.clientHeight;
        var y = Math.min(1, Math.max(0, -r.top / len)) * tot;
        var sg = segs[segs.length - 1];
        for (var i = 0; i < segs.length; i++) if (y < segs[i].b) { sg = segs[i]; break; }
        if (sg.t === 'h') view = { k: sg.k, frame: null, m: 1 };
        else {
          var t = Math.min(1, (y - sg.a) / PLAY), f = sg.k * FPC + Math.round(ease(t) * (FPC - 1));
          if (t < FADE) view = { frame: f, k: sg.k, m: 1 - t / FADE };
          else if (t > 1 - FADE) view = { frame: f, k: sg.k + 1, m: (t - (1 - FADE)) / FADE };
          else view = { frame: f, k: null, m: 0 };
        }
        draw();
        var act = sg.t === 'h' ? sg.k : -1;
        stepEls.forEach(function (el, j) { el.classList.toggle('ew-on', j === act); });
        bars.forEach(function (b, j) { b.classList.toggle('ew-on', j === sg.k); });
        hint.style.opacity = y < 0.05 ? 1 : 0;
      });
    }
    // capture : le site défile dans un conteneur interne, pas dans la fenêtre
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', function () { size(); onScroll(); });
    size(); onScroll();
  }

  function boot() {
    var nodes = document.querySelectorAll('#ecrin-intro, [data-ecrin-intro]');
    for (var i = 0; i < nodes.length; i++) init(nodes[i]);
  }
  window.EcrinIntro = { init: init };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
