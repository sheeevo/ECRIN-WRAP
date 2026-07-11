// Stripe calls this on every subscription lifecycle event. We keep
// public.subscriptions in sync so the site can show plan/status without
// calling Stripe on every page load. Writes use the Supabase *service role*
// key, which bypasses RLS — this endpoint is the only writer for that table.
const stripe = require('./_stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports.config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }

  const sig = req.headers['stripe-signature'];
  const raw = await readRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send('Webhook signature verification failed: ' + err.message);
    return;
  }

  if (event.type.indexOf('customer.subscription.') === 0) {
    const sub = event.data.object;
    const userId = sub.metadata && sub.metadata.supabase_user_id;

    if (userId) {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      const row = {
        user_id: userId,
        stripe_customer_id: sub.customer,
        stripe_subscription_id: sub.id,
        plan: (sub.metadata && sub.metadata.plan) || (sub.items.data[0] && sub.items.data[0].price.id) || 'unknown',
        status: sub.status,
        current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
      if (error) console.error('[stripe-webhook] supabase upsert failed', error);
    }
  }

  res.status(200).json({ received: true });
};
