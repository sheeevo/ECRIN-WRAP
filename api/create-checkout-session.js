// POST { plan: 'club'|'club_sport'|'excellence', userId, email }
// Returns { url } — a Stripe Checkout URL to redirect the browser to.
// The price IDs live in env vars, never in client code: the browser only
// ever sends a plan *key*, so it can't ask Stripe to charge an arbitrary price.
const Stripe = require('stripe');

const PRICE_MAP = {
  club: process.env.STRIPE_PRICE_CLUB,
  club_sport: process.env.STRIPE_PRICE_CLUB_SPORT,
  excellence: process.env.STRIPE_PRICE_EXCELLENCE
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const { plan, userId, email } = req.body || {};
  const priceId = PRICE_MAP[plan];
  if (!priceId) { res.status(400).json({ error: 'unknown plan' }); return; }
  if (!userId) { res.status(400).json({ error: 'missing userId' }); return; }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

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
