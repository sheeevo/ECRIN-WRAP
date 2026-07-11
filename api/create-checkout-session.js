// POST for a subscription: { plan: 'club'|'club_sport'|'excellence', userId, email }
// POST for a deposit:      { type: 'deposit', plan: 'essentiel'|'signature'|'prestige', quoteId, userId, email }
// Returns { url } — a Stripe Checkout URL to redirect the browser to.
// Price IDs live in env vars, never in client code: the browser only ever
// sends a plan *key*, so it can't ask Stripe to charge an arbitrary price.
const stripe = require('./_stripe');

const SUB_PRICE_MAP = {
  club: process.env.STRIPE_PRICE_CLUB,
  club_sport: process.env.STRIPE_PRICE_CLUB_SPORT,
  excellence: process.env.STRIPE_PRICE_EXCELLENCE
};

const DEPOSIT_PRICE_MAP = {
  essentiel: process.env.STRIPE_PRICE_ESSENTIEL_DEPOSIT,
  signature: process.env.STRIPE_PRICE_SIGNATURE_DEPOSIT,
  prestige: process.env.STRIPE_PRICE_PRESTIGE_DEPOSIT
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const { type, plan, userId, email, quoteId } = req.body || {};
  if (!userId) { res.status(400).json({ error: 'missing userId' }); return; }

  try {
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    if (type === 'deposit') {
      const priceId = DEPOSIT_PRICE_MAP[plan];
      if (!priceId) { res.status(400).json({ error: 'unknown plan' }); return; }
      if (!quoteId) { res.status(400).json({ error: 'missing quoteId' }); return; }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: email || undefined,
        client_reference_id: userId,
        metadata: { supabase_user_id: userId, quote_id: quoteId, plan },
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
