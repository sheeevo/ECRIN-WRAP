/* Ecrin Wrap — real-time 3D car viewer (web component <ecrin-car-viewer>)
   Loads three.js r147 (UMD) + FBXLoader from CDN, renders uploads/svroadster.fbx
   Transparent canvas: the DC's studio background shows through.
   Events on window: 'ecrin-car-ready' | 'ecrin-car-error' | 'ecrin-car-progress' {detail:0..1}
   Attribute: mood = noir | platine | cobalt  (drives the paint finish) */
(function () {
  if (customElements.get('ecrin-car-viewer')) return;

  var CDN = 'https://cdn.jsdelivr.net/npm/';
  var BLANK = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  var libsPromise = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('script failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function loadLibs() {
    if (!libsPromise) {
      libsPromise = Promise.resolve()
        .then(function () { if (!window.THREE) return loadScript(CDN + 'three@0.147.0/build/three.min.js'); })
        .then(function () { if (!window.fflate) return loadScript(CDN + 'fflate@0.7.4/umd/index.js'); })
        .then(function () { if (!window.THREE.FBXLoader) return loadScript(CDN + 'three@0.147.0/examples/js/loaders/FBXLoader.js'); })
        .then(function () {
          if (!window.THREE.RoomEnvironment) {
            return loadScript(CDN + 'three@0.147.0/examples/js/environments/RoomEnvironment.js').catch(function () {});
          }
        });
    }
    return libsPromise;
  }

  var FINISHES = {
    noir:    { color: 0x24272b, metalness: 0.92, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.06, env: 1.2 },
    platine: { color: 0xcfc4ad, metalness: 1.0,  roughness: 0.30, clearcoat: 0.6, clearcoatRoughness: 0.22, env: 1.3 },
    cobalt:  { color: 0x14337f, metalness: 0.88, roughness: 0.14, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.9 },
    /* configurator wrap finishes */
    gloss:   { color: 0x14161a, metalness: 0.55, roughness: 0.07, clearcoat: 1.0, clearcoatRoughness: 0.03, env: 1.0 },
    matte:   { color: 0x34373b, metalness: 0.10, roughness: 0.95, clearcoat: 0.0, clearcoatRoughness: 0.6, env: 0.45 },
    satin:   { color: 0x5f6469, metalness: 0.55, roughness: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.45, env: 0.7 },
    frozen:  { color: 0xdfe3e6, metalness: 0.45, roughness: 0.88, clearcoat: 0.1, clearcoatRoughness: 0.7, env: 0.6 },
    chrome:  { color: 0xf4f6f8, metalness: 1.0,  roughness: 0.02, clearcoat: 0.0, clearcoatRoughness: 0.0, env: 1.6 },
    carbone: { color: 0x141619, metalness: 0.65, roughness: 0.32, clearcoat: 1.0, clearcoatRoughness: 0.10, env: 0.9 },
    brosse:  { color: 0xb9bdc1, metalness: 1.0,  roughness: 0.52, clearcoat: 0.0, clearcoatRoughness: 0.0, env: 1.2 },
    nacre:   { color: 0xf2efe6, metalness: 0.45, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.08, iridescence: 0.7, env: 1.2 },
    flip:    { color: 0x27306b, metalness: 0.85, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.05, iridescence: 1.0, env: 1.1 },
    or:      { color: 0xd4af37, metalness: 1.0,  roughness: 0.08, clearcoat: 0.4, clearcoatRoughness: 0.1, env: 1.5 },
    orrose:  { color: 0xb76e79, metalness: 1.0,  roughness: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.1, env: 1.4 },
    rouge:   { color: 0x8f0810, metalness: 0.15, roughness: 0.30, clearcoat: 0.85, clearcoatRoughness: 0.10, env: 0.45 },
    noir:    { color: 0x0b0c0e, metalness: 0.45, roughness: 0.11, clearcoat: 1.0, clearcoatRoughness: 0.04, env: 0.9 },
    blanc:   { color: 0xeef0f1, metalness: 0.30, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.06, env: 0.7 },
    bleu:    { color: 0x12377f, metalness: 0.25, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.5 },
    vert:    { color: 0x0f5230, metalness: 0.25, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.5 },
    orange:  { color: 0xc5560f, metalness: 0.25, roughness: 0.22, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.5 },
    violet:  { color: 0x46216e, metalness: 0.30, roughness: 0.20, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.5 }
  };

  function fire(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail: detail }));
  }

  // Self-contained placeholder shown until (or unless) the real 3D model
  // renders. Every instance owns and clears its own copy, so a failure in
  // one viewer (blocked CDN, no WebGL, GPU context limits, slow network...)
  // never leaves that spot visually blank, regardless of the cause.
  var FALLBACK_STYLE_ID = 'ecw-fallback-style';
  function ensureFallbackStyle() {
    if (document.getElementById(FALLBACK_STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = FALLBACK_STYLE_ID;
    st.textContent =
      '@keyframes ecwFbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}' +
      '@keyframes ecwFbPulse{0%,100%{opacity:.5}50%{opacity:.8}}' +
      '._ecw-fb{position:absolute;inset:0;display:flex;align-items:flex-end;justify-content:center;pointer-events:none;transition:opacity .8s ease;animation:ecwFbFloat 6s ease-in-out infinite}' +
      '._ecw-fb-wrap{position:relative;width:70%;max-width:420px;height:46%;min-height:110px}' +
      '._ecw-fb-wheel{position:absolute;bottom:8%;width:17%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a3d40,#0c0d0e 62%);box-shadow:inset 0 0 0 4px rgba(228,35,43,.18),0 6px 14px rgba(0,0,0,.5)}' +
      '._ecw-fb-wheel-l{left:6%}._ecw-fb-wheel-r{right:6%}' +
      '._ecw-fb-body{position:absolute;left:0;top:16%;width:100%;height:62%;clip-path:polygon(2% 78%,3% 60%,17% 55%,32% 40%,45% 20%,63% 15%,73% 22%,88% 52%,98% 60%,98% 78%);background:linear-gradient(172deg,#e9ecef 0%,#c3c8cc 18%,#82868b 42%,#33363a 62%,#5c6064 80%,#a9adb1 100%);opacity:.6;animation:ecwFbPulse 3.2s ease-in-out infinite}';
    document.head.appendChild(st);
  }
  function makeFallback() {
    ensureFallbackStyle();
    var fb = document.createElement('div');
    fb.className = '_ecw-fb';
    fb.innerHTML = '<div class="_ecw-fb-wrap">' +
      '<div class="_ecw-fb-wheel _ecw-fb-wheel-l"></div>' +
      '<div class="_ecw-fb-wheel _ecw-fb-wheel-r"></div>' +
      '<div class="_ecw-fb-body"></div>' +
      '</div>';
    return fb;
  }

  // Parse the 11 MB FBX exactly ONCE, then clone per viewer (shared geometry).
  var modelPromise = null;
  function loadModelOnce(THREE) {
    if (modelPromise) return modelPromise;
    modelPromise = new Promise(function (resolve, reject) {
      var manager = new THREE.LoadingManager();
      var UPLOADS = ['Image_1.016-f13b2f11.png'];
      manager.setURLModifier(function (url) {
        try {
          if (!url || typeof url !== 'string') return url;
          if (url.indexOf('data:') === 0) return url;
          var base = url.split('/').pop().split('\\').pop().split('?')[0].toLowerCase();
          var stem = base.replace(/\.(png|jpe?g|tga|dds|tiff?|bmp)$/i, '');
          if (stem.length > 3) {
            for (var i = 0; i < UPLOADS.length; i++) {
              if (UPLOADS[i].toLowerCase().indexOf(stem) === 0) return 'uploads/' + UPLOADS[i];
            }
          }
          if (base.indexOf('carbon') !== -1) return 'uploads/black-diagonal-carbon-fiber-seamless-texture-pattern-vector.png';
          if (base.indexOf('lamborghini') !== -1 || base.indexOf('bol-black') !== -1 || base.indexOf('automobi') !== -1)
            return 'uploads/lamborghini-brand-logo-car-symbol-black-design-italian-automobi-3f8db0e7.jpg';
          if (/\.(png|jpe?g|tga|dds|tiff?|bmp)$/i.test(base)) return BLANK;
          return url;
        } catch (e) { return BLANK; }
      });
      new THREE.FBXLoader(manager).load('uploads/svroadster.fbx',
        function (obj) { resolve(obj); },
        function (xhr) { if (xhr && xhr.total) fire('ecrin-car-progress', xhr.loaded / xhr.total); },
        function (err) { modelPromise = null; reject(err); });
    });
    return modelPromise;
  }

  // Cheap baked contact shadow (radial gradient) — replaces per-frame shadow maps.
  function makeBlobTexture(THREE) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(128, 128, 8, 128, 128, 128);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.30)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  class EcrinCarViewer extends HTMLElement {
    static get observedAttributes() { return ['mood', 'finish', 'paint']; }
    get mood() { return this.getAttribute('mood') || 'noir'; }
    set mood(v) { if (v) this.setAttribute('mood', v); }
    get finish() { return this.getAttribute('finish') || ''; }
    set finish(v) { if (v != null) this.setAttribute('finish', v); }

    connectedCallback() {
      if (this._init) return;
      this._init = true;
      if (!this.style.display) this.style.display = 'block';
      if (!this.clientHeight) this.style.minHeight = '460px';
      this._fallback = makeFallback();
      this.appendChild(this._fallback);
      // start when near the viewport; lazy instances never boot eagerly
      var self = this;
      var lazy = this.hasAttribute('lazy');
      var started = false;
      var go = function () { if (!started) { started = true; self._start(); } };
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
          for (var i = 0; i < entries.length; i++) {
            if (entries[i].isIntersecting) { io.disconnect(); go(); return; }
          }
        }, { rootMargin: lazy ? '200px' : '700px' });
        io.observe(this);
        if (!lazy) setTimeout(go, 1500);
      } else {
        go();
      }
    }

    disconnectedCallback() {
      cancelAnimationFrame(this._raf);
      if (this._onMove) window.removeEventListener('mousemove', this._onMove);
      if (this._onWheel) this.removeEventListener('wheel', this._onWheel);
      if (this._vio) this._vio.disconnect();
      if (this._ro) this._ro.disconnect();
      if (this._renderer) this._renderer.dispose();
    }

    attributeChangedCallback() { this._applyMood(); }

    _applyMood() {
      if (!this._paints || !window.THREE) return;
      var f;
      // paint="#rrggbb|kind" (Avery catalogue) takes priority
      var paint = this.getAttribute('paint');
      if (paint && paint.indexOf('#') === 0) {
        var parts = paint.split('|');
        var kind = parts[1] || 'gloss';
        var KINDS = {
          gloss:    { metalness: 0.30, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 0.6 },
          matte:    { metalness: 0.10, roughness: 0.92, clearcoat: 0.0, clearcoatRoughness: 0.6, env: 0.4 },
          satin:    { metalness: 0.40, roughness: 0.5,  clearcoat: 0.3, clearcoatRoughness: 0.4, env: 0.6 },
          metallic: { metalness: 0.85, roughness: 0.28, clearcoat: 1.0, clearcoatRoughness: 0.08, env: 0.9 },
          satinmet: { metalness: 0.8,  roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35, env: 0.8 },
          flip:     { metalness: 0.85, roughness: 0.16, clearcoat: 1.0, clearcoatRoughness: 0.05, env: 1.0, iridescence: 1.0 },
          chromef:  { metalness: 1.0,  roughness: 0.05, clearcoat: 0.0, clearcoatRoughness: 0.0, env: 1.5 }
        };
        var k = KINDS[kind] || KINDS.gloss;
        f = Object.assign({ color: parseInt(parts[0].slice(1), 16) }, k);
      } else {
        f = FINISHES[this.finish] || FINISHES[this.mood] || FINISHES.noir;
      }
      for (var i = 0; i < this._paints.length; i++) {
        var m = this._paints[i];
        m.color.setHex(f.color).convertSRGBToLinear();
        m.metalness = f.metalness;
        m.roughness = f.roughness;
        if ('clearcoat' in m) { m.clearcoat = f.clearcoat; m.clearcoatRoughness = f.clearcoatRoughness; }
        if ('iridescence' in m) m.iridescence = f.iridescence || 0;
        if ('envMapIntensity' in m) m.envMapIntensity = (f.env != null ? f.env : 1);
        m.needsUpdate = true;
      }
      if (this._renderer && this._scene && this._camera) {
        try { this._renderer.render(this._scene, this._camera); } catch (e) {}
      }
    }

    _start() {
      var self = this;
      loadLibs().then(function () { self._setupScene(); }).catch(function (e) {
        console.warn('[ecrin-car-viewer] libs failed', e);
        fire('ecrin-car-error');
      });
    }

    _setupScene() {
      var self = this, THREE = window.THREE;
      var canvas = document.createElement('canvas');
      canvas.style.cssText = 'width:100%;height:100%;display:block;opacity:0;transition:opacity 1.4s ease;';
      this.appendChild(canvas);

      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(window.innerWidth < 760 ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.LinearToneMapping;
      renderer.toneMappingExposure = 1.0;
      this._renderer = renderer;

      var scene = new THREE.Scene();
      this._scene = scene;

      try {
        if (THREE.RoomEnvironment) {
          var pmrem = new THREE.PMREMGenerator(renderer);
          scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
        }
      } catch (e) { /* lights-only fallback */ }

      var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 120);
      camera.position.set(0, 1.5, 9.2);
      this._camera = camera;

      var key = new THREE.DirectionalLight(0xffffff, 1.15);
      key.position.set(4.5, 7, 4);
      scene.add(key);
      var rim = new THREE.DirectionalLight(0xbcd2ff, 0.45);
      rim.position.set(-6, 3.5, -5);
      scene.add(rim);
      scene.add(new THREE.AmbientLight(0xffffff, 0.14));

      // baked contact shadow (no per-frame shadow map)
      var blob = new THREE.Mesh(
        new THREE.PlaneGeometry(9, 5),
        new THREE.MeshBasicMaterial({ map: makeBlobTexture(THREE), transparent: true, depthWrite: false, opacity: 0.9 })
      );
      blob.rotation.x = -Math.PI / 2;
      blob.position.y = 0.012;
      scene.add(blob);

      var group = new THREE.Group();
      scene.add(group);
      this._group = group;

      // responsive sizing
      var resize = function () {
        var w = self.clientWidth || 1, h = self.clientHeight || 1;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      resize();
      this._ro = new ResizeObserver(resize);
      this._ro.observe(this);

      // visibility gate — don't burn frames when the viewer is scrolled off-screen
      this._visible = true;
      if ('IntersectionObserver' in window) {
        this._vio = new IntersectionObserver(function (ents) {
          self._visible = ents[0] && ents[0].isIntersecting;
        }, { threshold: 0.01 });
        this._vio.observe(this);
      }

      // wheel zoom (hero only) — dolly camera + broadcast zoom level for the installer reveal
      this._zoom = 0; this._zoomTarget = 0;
      if (this.hasAttribute('zoomable')) {
        this._onWheel = function (e) {
          var dir = e.deltaY > 0 ? -1 : 1;
          var next = Math.max(0, Math.min(1, self._zoomTarget + dir * 0.12));
          // only capture the wheel while we're actually zooming; let the page scroll at the extremes
          if ((dir > 0 && self._zoomTarget < 1) || (dir < 0 && self._zoomTarget > 0)) {
            e.preventDefault();
            self._zoomTarget = next;
          }
        };
        this.addEventListener('wheel', this._onWheel, { passive: false });
      }

      // mouse sway
      this._mx = 0; this._my = 0;
      this._onMove = function (e) {
        self._mx = (e.clientX / window.innerWidth) * 2 - 1;
        self._my = (e.clientY / window.innerHeight) * 2 - 1;
      };
      window.addEventListener('mousemove', this._onMove);

      // FBX — parsed once globally, cloned here (shared geometry, no double parse)
      var attempt = function (n) {
        loadModelOnce(THREE).then(function (orig) {
          try { self._setupModel(orig.clone(true)); }
          catch (e) {
            console.warn('[ecrin-car-viewer] model setup failed', e);
            if (n < 1) { modelPromise = null; setTimeout(function () { attempt(n + 1); }, 300); }
            else fire('ecrin-car-error');
          }
        }, function (err) {
          console.warn('[ecrin-car-viewer] fbx failed', err);
          if (n < 1) setTimeout(function () { attempt(n + 1); }, 400);
          else fire('ecrin-car-error');
        });
      };
      attempt(0);

      // render loop
      var clock = new THREE.Clock();
      var tick = function () {
        var dt = Math.min(clock.getDelta(), 0.05);
        self._raf = requestAnimationFrame(tick);
        if (!self._visible) return;
        // ease zoom + broadcast
        self._zoom += (self._zoomTarget - self._zoom) * 0.12;
        if (Math.abs(self._zoom - (self._lastZoom || 0)) > 0.002) {
          self._lastZoom = self._zoom;
          if (self.hasAttribute('zoomable')) fire('ecrin-car-zoom', self._zoom);
        }
        var z = self._zoom;
        group.rotation.y += dt * 0.14 * (1 - z * 0.85);
        var dist = 9.2 - z * 4.6;
        var tx = self._mx * 1.1 * (1 - z * 0.6);
        camera.position.x += (tx - camera.position.x) * 0.05;
        camera.position.y += ((1.5 - self._my * 0.5 - z * 0.5) - camera.position.y) * 0.05;
        camera.position.z += (dist - camera.position.z) * 0.06;
        camera.lookAt(0, 0.65 - z * 0.1, 0);
        renderer.render(scene, camera);
      };
      tick();
      this._canvas = canvas;
    }

    _robustBox(obj) {
      var THREE = window.THREE;
      var box = new THREE.Box3();
      var tmp = new THREE.Box3();
      obj.updateWorldMatrix(true, true);
      obj.traverse(function (mesh) {
        if (!mesh.isMesh || !mesh.geometry) return;
        var g = mesh.geometry;
        if (!g.boundingBox) g.computeBoundingBox();
        var b = g.boundingBox;
        if (!b) return;
        var vals = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z];
        for (var i = 0; i < 6; i++) if (!isFinite(vals[i])) return;
        // ignore absurd outliers (bad verts far from origin)
        if (Math.max(Math.abs(vals[0]), Math.abs(vals[3])) > 1e6) return;
        tmp.copy(b).applyMatrix4(mesh.matrixWorld);
        box.union(tmp);
      });
      return box;
    }

    _normalize() {
      var THREE = window.THREE;
      var obj = this._car, refl = this._refl;
      if (!obj) return;
      obj.updateWorldMatrix(true, true);
      var box = new THREE.Box3().setFromObject(obj);
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      if (isFinite(maxDim) && maxDim > 0.0001) {
        var k = 4.8 / maxDim;
        if (Math.abs(k - 1) > 0.02) {
          obj.scale.multiplyScalar(k);
          obj.position.multiplyScalar(k);
          obj.updateWorldMatrix(true, true);
          box = new THREE.Box3().setFromObject(obj);
        }
        var center = box.getCenter(new THREE.Vector3());
        if (isFinite(center.x)) {
          obj.position.x -= center.x;
          obj.position.z -= center.z;
          obj.position.y -= box.min.y;
        }
      }
      if (refl) {
        refl.scale.set(obj.scale.x, -obj.scale.y, obj.scale.z);
        refl.position.set(obj.position.x, -obj.position.y, obj.position.z);
        refl.rotation.copy(obj.rotation);
      }
    }

    _setupModel(obj) {
      var THREE = window.THREE;
      // normalize scale + center on ground (robust to bad geometry)
      var box = this._robustBox(obj);
      var size = box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      if (!isFinite(maxDim) || maxDim <= 0) maxDim = 1;
      var k = 4.8 / maxDim;
      obj.scale.setScalar(k);
      box = this._robustBox(obj);
      var center = box.getCenter(new THREE.Vector3());
      if (isFinite(center.x)) { obj.position.x -= center.x; obj.position.z -= center.z; }
      if (isFinite(box.min.y)) obj.position.y -= box.min.y;

      // classify materials
      var carbonTex = new THREE.TextureLoader().load('uploads/black-diagonal-carbon-fiber-seamless-texture-pattern-vector.png');
      carbonTex.wrapS = carbonTex.wrapT = THREE.RepeatWrapping;
      carbonTex.repeat.set(6, 6);
      carbonTex.encoding = THREE.sRGBEncoding;

      var texCache = {};
      function atlasTex(path) {
        if (!texCache[path]) {
          var t = new THREE.TextureLoader().load(path);
          t.encoding = THREE.sRGBEncoding;
          t.flipY = true;
          texCache[path] = t;
        }
        return texCache[path];
      }
      var TEXMAP = [
        { re: /badge/i, f: 'uploads/Image_1.016-f13b2f11.png', alpha: true }
      ];

      var paints = [];
      var bodyCandidates = [];
      var glassRe = /glass|wind|vitre|windscreen|windshield/i;
      var bodyRe = /body|paint|carroc|shell|exterior|livery|main/i;
      var carbonRe = /carbon|fibre|fiber/i;
      var tireRe = /tyre|tire|pneu|rubber/i;
      var rimRe = /rim|wheel|jante|brake|disc|caliper/i;
      var lightRe = /light|lamp|phare|led|head|tail/i;
      var chromeRe = /chrome|metal|exhaust|steel|alu/i;

      var matCache = new Map();
      obj.traverse(function (mesh) {
        if (!mesh.isMesh) return;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        var mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        var out = mats.map(function (m) {
          if (m && matCache.has(m)) return matCache.get(m);
          var name = ((m && m.name) || '') + ' ' + (mesh.name || '');
          // atlas textures by material name (badges, interior, engine, lights, wheels)
          for (var ti = 0; ti < TEXMAP.length; ti++) {
            if (TEXMAP[ti].re.test(name)) {
              var at = atlasTex(TEXMAP[ti].f);
              return new THREE.MeshStandardMaterial({
                name: m.name, color: 0xffffff, map: at,
                metalness: 0.35, roughness: 0.5, envMapIntensity: 0.8,
                transparent: !!TEXMAP[ti].alpha, alphaTest: TEXMAP[ti].alpha ? 0.08 : 0
              });
            }
          }
          // interior / engine — deep matte black, no texture
          if (/fullinterior|interior|fullengine|engine/i.test(name)) {
            return new THREE.MeshStandardMaterial({ name: m.name, color: 0x0d0e10, metalness: 0.15, roughness: 0.85, envMapIntensity: 0.3 });
          }
          if (/red_glass/i.test(name)) {
            return new THREE.MeshPhysicalMaterial({ name: m.name, color: 0x5a0407, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.85, envMapIntensity: 1.4 });
          }
          if (/orange_glass/i.test(name)) {
            return new THREE.MeshPhysicalMaterial({ name: m.name, color: 0x7a2c05, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.85, envMapIntensity: 1.4 });
          }
          if (glassRe.test(name)) {
            return new THREE.MeshPhysicalMaterial({ name: m.name, color: 0x090c10, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.72, envMapIntensity: 1.4 });
          }
          // textured material (badges, logos) — preserve only maps whose image actually loaded
          if (m && m.map && m.map.image) {
            var keep = new THREE.MeshStandardMaterial({
              name: m.name,
              color: 0xffffff,
              map: m.map,
              normalMap: null,
              metalness: 0.35,
              roughness: 0.5,
              envMapIntensity: 0.8,
              transparent: !!m.transparent,
              opacity: (m.opacity !== undefined) ? m.opacity : 1,
              alphaTest: m.transparent ? 0.05 : 0
            });
            if (keep.map) keep.map.encoding = THREE.sRGBEncoding;
            return keep;
          }
          if (carbonRe.test(name)) {
            return new THREE.MeshStandardMaterial({ name: m.name, color: 0xffffff, map: carbonTex, metalness: 0.45, roughness: 0.4, envMapIntensity: 0.9 });
          }
          if (tireRe.test(name)) {
            return new THREE.MeshStandardMaterial({ name: m.name, color: 0x0b0c0d, metalness: 0, roughness: 0.95 });
          }
          if (rimRe.test(name)) {
            // black wheels (gloss anthracite) — keep brake/disc/caliper metallic
            if (/brake|disc|caliper|rotor|étrier|etrier/i.test(name)) {
              return new THREE.MeshStandardMaterial({ name: m.name, color: 0x9a9ea2, metalness: 0.9, roughness: 0.35, envMapIntensity: 1.1 });
            }
            return new THREE.MeshStandardMaterial({ name: m.name, color: 0x121316, metalness: 0.7, roughness: 0.28, envMapIntensity: 0.8 });
          }
          if (lightRe.test(name)) {
            return new THREE.MeshPhysicalMaterial({ name: m.name, color: 0xdfe6ec, metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.9, envMapIntensity: 1.6 });
          }
          if (bodyRe.test(name)) {
            var pm = new THREE.MeshPhysicalMaterial({ name: m.name });
            paints.push(pm);
            return pm;
          }
          // vivid saturated original color = livery paint (e.g. factory red shell)
          if (m && m.color) {
            var hsl = { h: 0, s: 0, l: 0 };
            m.color.getHSL(hsl);
            if (hsl.s > 0.5 && hsl.l > 0.06 && hsl.l < 0.65) {
              var pv = new THREE.MeshPhysicalMaterial({ name: m.name });
              paints.push(pv);
              return pv;
            }
          }
          if (chromeRe.test(name)) {
            return new THREE.MeshStandardMaterial({ name: m.name, color: 0xb6babe, metalness: 0.95, roughness: 0.22, envMapIntensity: 1.2 });
          }
          // default: dark neutral, keep any map that resolved
          var std = new THREE.MeshStandardMaterial({
            name: m.name,
            color: (m && m.color) ? m.color.clone() : new THREE.Color(0x2a2d30),
            map: (m && m.map && m.map.image) ? m.map : null,
            metalness: 0.35, roughness: 0.6, envMapIntensity: 0.8
          });
          return std;
        });
        mats.forEach(function (m, i) { if (m && !matCache.has(m)) matCache.set(m, out[i]); });
        mesh.material = Array.isArray(mesh.material) ? out : out[0];

        // track biggest meshes as body candidates (robust bbox surface heuristic; skip textured meshes)
        var hasMap = out.some(function (mm) { return mm && mm.map && mm.map !== carbonTex; });
        var g2 = mesh.geometry;
        if (g2 && !g2.boundingBox) g2.computeBoundingBox();
        if (!hasMap && g2 && g2.boundingBox) {
          var s = g2.boundingBox.getSize(new THREE.Vector3());
          if (isFinite(s.x) && isFinite(s.y) && isFinite(s.z)) {
            var area = 2 * (s.x * s.y + s.y * s.z + s.z * s.x);
            bodyCandidates.push({ mesh: mesh, area: area });
          }
        }
      });

      // no named body material? promote the largest mesh's material to paint
      if (paints.length === 0 && bodyCandidates.length) {
        bodyCandidates.sort(function (a, b) { return b.area - a.area; });
        var top = bodyCandidates.slice(0, 2);
        for (var i = 0; i < top.length; i++) {
          var pm2 = new THREE.MeshPhysicalMaterial({ name: 'promoted-paint' });
          var mm = top[i].mesh;
          if (Array.isArray(mm.material)) mm.material[0] = pm2; else mm.material = pm2;
          paints.push(pm2);
        }
      }
      this._paints = paints;
      this._car = obj;
      this._group.add(obj);

      // iterative self-correcting normalization (handles weird nested FBX scales)
      for (var it = 0; it < 4; it++) this._normalize();

      this._applyMood();

      if (this._canvas) this._canvas.style.opacity = '1';
      try { this._renderer.render(this._scene, this._camera); } catch (e) {}
      this._hideFallback();
      fire('ecrin-car-ready');
    }

    _hideFallback() {
      var fb = this._fallback;
      if (!fb) return;
      this._fallback = null;
      fb.style.opacity = '0';
      setTimeout(function () { if (fb.parentNode) fb.parentNode.removeChild(fb); }, 900);
    }
  }

  customElements.define('ecrin-car-viewer', EcrinCarViewer);
})();
