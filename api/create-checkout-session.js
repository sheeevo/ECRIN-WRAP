// POST for a subscription: { plan: 'club'|'club_sport'|'excellence', userId, email }
// POST for a deposit:      { type: 'deposit', plan: 'essentiel'|'signature'|'prestige', category, quoteId, userId, email }
// Returns { url } — a Stripe Checkout URL to redirect the browser to.
// Subscription price IDs live in env vars, never in client code. Deposit
// amounts vary by vehicle category (5 categories x 3 plans) so they are
// computed here from a fixed table and sent to Stripe as inline price_data
// instead of needing 15 pre-created Stripe Price objects — either way the
// browser only ever sends plan+category *keys*, never an amount, so it
// can't ask Stripe to charge anything arbitrary.
const stripe = require('./_stripe');

const SUB_PRICE_MAP = {
  club: process.env.STRIPE_PRICE_CLUB,
  club_sport: process.env.STRIPE_PRICE_CLUB_SPORT,
  excellence: process.env.STRIPE_PRICE_EXCELLENCE
};

// 30% deposit, in cents, per plan x vehicle category — mirrors the à la
// carte price grid shown on the site (full prices: see dtPlans in the
// front-end I18N; these are exactly 30% of each, rounded to the cent).
const DEPOSIT_AMOUNTS = {
  essentiel: { citadine: 4470, berline: 5070, suvc: 5670, suv: 6150, sportive: 6750 },
  signature: { citadine: 11700, berline: 12300, suvc: 13800, suv: 15600, sportive: 17700 },
  prestige: { citadine: 26700, berline: 28200, suvc: 31200, suv: 35700, sportive: 41700 }
};

const PLAN_LABELS = { essentiel: 'Essentiel', signature: 'Signature', prestige: 'Prestige' };
const CATEGORY_LABELS = {
  citadine: 'Citadine / Compacte',
  berline: 'Berline / Break',
  suvc: 'SUV compact',
  suv: 'Grand SUV / Utilitaire / Pick-up',
  sportive: 'Sportive / Supercar'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const { type, plan, category, userId, email, quoteId } = req.body || {};
  if (!userId) { res.status(400).json({ error: 'missing userId' }); return; }

  try {
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    if (type === 'deposit') {
      const amount = DEPOSIT_AMOUNTS[plan] && DEPOSIT_AMOUNTS[plan][category];
      if (!amount) { res.status(400).json({ error: 'unknown plan or category' }); return; }
      if (!quoteId) { res.status(400).json({ error: 'missing quoteId' }); return; }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{
          price_data: {
            currency: 'eur',
            unit_amount: amount,
            product_data: {
              name: `Acompte ${PLAN_LABELS[plan] || plan} — ${CATEGORY_LABELS[category] || category}`
            }
          },
          quantity: 1
        }],
        customer_email: email || undefined,
        client_reference_id: userId,
        metadata: { supabase_user_id: userId, quote_id: quoteId, plan, category },
        success_url: siteUrl + '/?checkout=success',
        cancel_url: siteUrl + '/?checkout=cancelled'
      });

      res.status(200).json({ url: session.url });
      return;
    }

    const priceId = SUB_PRICE_MAP[plan];
    if (!priceId) { res.status(400).json({ error: 'unknown plan' }); return; }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      client_reference_id: userId,
      subscription_data: { metadata: { supabase_user_id: userId, plan } },
      success_url: siteUrl + '/?checkout=success',
      cancel_url: siteUrl + '/?checkout=cancelled'
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
