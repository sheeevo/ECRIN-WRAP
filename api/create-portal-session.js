// POST { customerId } -> { url } — a Stripe Billing Portal URL where the
// signed-in customer can update their card, change plan, or cancel.
const Stripe = require('stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const { customerId } = req.body || {};
  if (!customerId) { res.status(400).json({ error: 'missing customerId' }); return; }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const siteUrl = process.env.SITE_URL || `https://${req.headers.host}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: siteUrl
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
