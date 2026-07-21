// Stripe calls this on every subscription lifecycle event, and on completed
// one-time Checkout sessions (detailing deposits). We keep public.subscriptions
// and public.quotes in sync so the site can show status without calling
// Stripe on every page load. Writes use the Supabase *service role* key,
// which bypasses RLS — this endpoint is the only writer for those rows.
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

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
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

  try {
    if (event.type.indexOf('customer.subscription.') === 0) {
      const sub = event.data.object;
      const userId = sub.metadata && sub.metadata.supabase_user_id;

      if (userId) {
        const supabase = getSupabase();
        const row = {
          user_id: userId,
          stripe_customer_id: sub.customer,
          stripe_subscription_id: sub.id,
          plan: (sub.metadata && sub.metadata.plan) || (sub.items.data[0] && sub.items.data[0].price.id) || 'unknown',
          status: sub.status,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          cancel_at_period_end: !!sub.cancel_at_period_end,
          canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : null,
          updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('subscriptions').upsert(row, { onConflict: 'stripe_subscription_id' });
        if (error) throw new Error('Supabase upsert (subscriptions) failed: ' + error.message);
      }
    } else if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.mode === 'payment') {
        const quoteId = session.metadata && session.metadata.quote_id;
        if (quoteId) {
          const supabase = getSupabase();
          const { error } = await supabase
            .from('quotes')
            .update({ deposit_status: 'paid', stripe_checkout_session_id: session.id })
            .eq('id', quoteId);
          if (error) throw new Error('Supabase update (quotes) failed: ' + error.message);
        }
      }
    }
  } catch (err) {
    console.error('[stripe-webhook]', err);
    res.status(500).json({ error: err.message });
    return;
  }

  res.status(200).json({ received: true });
};
