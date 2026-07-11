// Ecrin Wrap — client account (Supabase auth + data)
// Loaded the same way as avery-colors.js: dynamic import with a <script> fallback.
// Exposes window.EcrinAuth. The publishable key below is safe to ship client-side
// by design (Supabase protects data via Row Level Security, not key secrecy).
(function () {
  var SUPABASE_URL = 'https://hzfmfzrtboomqjlglufi.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_3BWiQIsTV8cFfnss_dP1Tg_D2w2FeAO';
  var CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';

  var clientPromise = null;
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve(window.supabase);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = CDN;
      s.onload = function () { resolve(window.supabase); };
      s.onerror = function () { reject(new Error('supabase-js failed to load')); };
      document.head.appendChild(s);
    });
  }
  function getClient() {
    if (!clientPromise) {
      clientPromise = loadLib().then(function (sb) {
        return sb.createClient(SUPABASE_URL, SUPABASE_KEY);
      });
    }
    return clientPromise;
  }

  window.EcrinAuth = {
    getSession: function () {
      return getClient().then(function (c) { return c.auth.getSession(); }).then(function (r) { return r.data.session; });
    },
    onChange: function (cb) {
      getClient().then(function (c) {
        c.auth.onAuthStateChange(function (_event, session) { cb(session); });
      });
    },
    signUp: function (email, password) {
      return getClient().then(function (c) { return c.auth.signUp({ email: email, password: password }); });
    },
    signIn: function (email, password) {
      return getClient().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }); });
    },
    signOut: function () {
      return getClient().then(function (c) { return c.auth.signOut(); });
    },
    listVehicles: function () {
      return getClient().then(function (c) {
        return c.from('vehicles').select('*').order('created_at', { ascending: false });
      }).then(unwrap);
    },
    addVehicle: function (brand, model, finish) {
      return getClient().then(function (c) {
        return c.from('vehicles').insert({ brand: brand, model: model, finish: finish || null }).select();
      }).then(unwrap);
    },
    deleteVehicle: function (id) {
      return getClient().then(function (c) { return c.from('vehicles').delete().eq('id', id); }).then(unwrap);
    },
    listQuotes: function () {
      return getClient().then(function (c) {
        return c.from('quotes').select('*').order('created_at', { ascending: false });
      }).then(unwrap);
    },
    addQuote: function (payload) {
      return getClient().then(function (c) { return c.from('quotes').insert(payload).select(); }).then(unwrap);
    }
  };

  function unwrap(res) {
    if (res.error) throw res.error;
    return res.data;
  }
})();
