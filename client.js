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
    signUp: function (email, password, profile) {
      return getClient().then(function (c) {
        return c.auth.signUp({ email: email, password: password, options: { data: profile || {} } });
      });
    },
    signIn: function (email, password) {
      return getClient().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }); });
    },
    sendMagicLink: function (email) {
      return getClient().then(function (c) {
        return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: window.location.origin } });
      });
    },
    resetPassword: function (email) {
      return getClient().then(function (c) {
        return c.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
      });
    },
    updateEmail: function (newEmail) {
      return getClient().then(function (c) { return c.auth.updateUser({ email: newEmail }); });
    },
    updatePassword: function (newPassword) {
      return getClient().then(function (c) { return c.auth.updateUser({ password: newPassword }); });
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
    },
    getSubscription: function () {
      return getClient().then(function (c) {
        return c.from('subscriptions').select('*').order('updated_at', { ascending: false }).limit(1);
      }).then(unwrap).then(function (rows) { return (rows && rows[0]) || null; });
    },
    startCheckout: function (plan, userId, email, category) {
      return fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan, category: category, userId: userId, email: email })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.error) throw new Error(data.error);
        window.location.href = data.url;
      });
    },
    openBillingPortal: function (customerId) {
      return fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: customerId })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.error) throw new Error(data.error);
        window.location.href = data.url;
      });
    },
    cancelSubscription: function (subscriptionId, userId) {
      return fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subscriptionId, userId: userId })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.error) throw new Error(data.error);
        return data;
      });
    },
    payDeposit: function (plan, quoteId, userId, email, category) {
      return fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'deposit', plan: plan, category: category, quoteId: quoteId, userId: userId, email: email })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.error) throw new Error(data.error);
        window.location.href = data.url;
      });
    }
  };

  function unwrap(res) {
    if (res.error) throw res.error;
    return res.data;
  }
})();
