// POST for a subscription: { plan: 'club'|'club_sport'|'excellence', category, userId, email }
// POST for a deposit:      { type: 'deposit', plan: 'essentiel'|'signature'|'prestige', category, quoteId, userId, email }
// Returns { url } — a Stripe Checkout URL to redirect the browser to.
// Both subscription and deposit prices vary by vehicle category (5
// categories x 3 plans each) so neither uses pre-created Stripe Price
// objects -- amounts are computed here from a fixed table and sent to
// Stripe as inline price_data instead, which also works for recurring
// subscription prices. Either way the browser only ever sends plan+category
// *keys*, never an amount, so it can't ask Stripe to charge anything
// arbitrary.
const stripe = require('./_stripe');

// monthly subscription amount, in cents, per plan x vehicle category —
// mirrors dtSubPlans in the front-end I18N.
const SUB_AMOUNTS = {
  club: { citadine: 19000, berline: 21500, sportive: 24000, suv: 26000, supercar: 28500 },
  club_sport: { citadine: 38000, berline: 40000, sportive: 45000, suv: 51000, supercar: 58000 },
  excellence: { citadine: 89000, berline: 94000, sportive: 104000, suv: 119000, supercar: 139000 }
};

// 30% deposit, in cents, per plan x vehicle category — mirrors the à la
// carte price grid shown on the site (full prices: see dtPlans in the
// front-end I18N; these are exactly 30% of each, rounded to the cent).
const DEPOSIT_AMOUNTS = {
  essentiel: { citadine: 4470, berline: 5070, sportive: 5670, suv: 6150, supercar: 6750 },
  signature: { citadine: 11700, berline: 12300, sportive: 13800, suv: 15600, supercar: 17700 },
  prestige: { citadine: 26700, berline: 28200, sportive: 31200, suv: 35700, supercar: 41700 }
};

const SUB_PLAN_LABELS = { club: 'Club', club_sport: 'Club Sport', excellence: 'Excellence' };
const PLAN_LABELS = { essentiel: 'Essentiel', signature: 'Signature', prestige: 'Prestige' };
const CATEGORY_LABELS = {
  citadine: 'Citadine / Compacte',
  berline: 'Berline / Break',
  sportive: 'Sportive',
  suv: 'Grand SUV / Utilitaire / Pick-up',
  supercar: 'Supercar'
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

    const subAmount = SUB_AMOUNTS[plan] && SUB_AMOUNTS[plan][category];
    if (!subAmount) { res.status(400).json({ error: 'unknown plan or category' }); return; }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: subAmount,
          recurring: { interval: 'month' },
          product_data: {
            name: `Abonnement ${SUB_PLAN_LABELS[plan] || plan} — ${CATEGORY_LABELS[category] || category}`
          }
        },
        quantity: 1
      }],
      customer_email: email || undefined,
      client_reference_id: userId,
      subscription_data: { metadata: { supabase_user_id: userId, plan, category } },
      success_url: siteUrl + '/?checkout=success',
      cancel_url: siteUrl + '/?checkout=cancelled'
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
