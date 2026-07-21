// POST { subscriptionId, userId } -> { status } — cancels a Stripe
// subscription immediately (not at period end). Ownership is checked
// against public.subscriptions (service role, bypasses RLS) before calling
// Stripe, so one signed-in user can't cancel another user's subscription.
const stripe = require('./_stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'method not allowed' }); return; }

  const { subscriptionId, userId } = req.body || {};
  if (!subscriptionId || !userId) { res.status(400).json({ error: 'missing subscriptionId or userId' }); return; }

  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var');
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: row, error } = await supabase
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();
    if (error || !row || row.user_id !== userId) {
      res.status(403).json({ error: 'not allowed' });
      return;
    }

    const canceled = await stripe.subscriptions.cancel(subscriptionId);

    await supabase
      .from('subscriptions')
      .update({
        status: canceled.status,
        canceled_at: canceled.canceled_at ? new Date(canceled.canceled_at * 1000).toISOString() : new Date().toISOString(),
        cancel_at_period_end: false,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId);

    res.status(200).json({ status: canceled.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
