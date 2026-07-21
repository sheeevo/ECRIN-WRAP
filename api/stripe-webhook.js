// Stripe calls this on every subscription lifecycle event, on completed
// one-time Checkout sessions (detailing deposits), and on paid invoices
// (to e-mail a PDF invoice). We keep public.subscriptions and public.quotes
// in sync so the site can show status without calling Stripe on every page
// load. Writes use the Supabase *service role* key, which bypasses RLS —
// this endpoint is the only writer for those rows.
const stripe = require('./_stripe');
const { createClient } = require('@supabase/supabase-js');

module.exports.config = { api: { bodyParser: false } };

const SUB_PLAN_LABELS = { club: 'Club', club_sport: 'Club Sport', excellence: 'Excellence' };

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

function invoiceEmailHtml(planLabel, amountLabel, dateLabel) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ta facture — Ecrin Wrap</title>
</head>
<body style="margin:0;padding:0;background-color:#050505;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#050505;padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#0e0f10;border:1px solid rgba(228,35,43,0.28);border-radius:8px;overflow:hidden;">
        <tr>
          <td align="center" style="padding:40px 32px 24px;">
            <img src="https://ecrin-wrap.vercel.app/assets/ecrin-logo.png" alt="Ecrin Wrap" width="160" style="display:block;width:160px;max-width:100%;height:auto;">
          </td>
        </tr>
        <tr>
          <td style="padding:0 40px;">
            <hr style="border:none;border-top:1px solid rgba(228,35,43,0.2);margin:0;">
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px 8px;">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#E4232B;font-weight:bold;font-family:Arial,Helvetica,sans-serif;">
              Facturation
            </p>
            <h1 style="margin:0;font-size:26px;line-height:1.3;color:#F7F7F7;font-family:Arial,Helvetica,sans-serif;font-weight:800;">
              Merci pour ton abonnement
            </h1>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 40px 8px;">
            <p style="margin:0;font-size:14px;line-height:1.7;color:#9aa0a4;font-family:Arial,Helvetica,sans-serif;">
              Ton paiement pour l'abonnement <strong style="color:#F7F7F7;">${planLabel}</strong> a bien été reçu. Tu trouveras ta facture au format PDF en pièce jointe de cet e-mail.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 32px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(228,35,43,0.18);border-radius:4px;">
              <tr>
                <td style="padding:14px 18px;font-size:12px;color:#7c8085;text-transform:uppercase;letter-spacing:0.08em;">Date</td>
                <td style="padding:14px 18px;font-size:13px;color:#c8ccd0;text-align:right;">${dateLabel}</td>
              </tr>
              <tr>
                <td style="padding:0 18px 14px;font-size:12px;color:#7c8085;text-transform:uppercase;letter-spacing:0.08em;">Montant</td>
                <td style="padding:0 18px 14px;font-size:13px;color:#c8ccd0;text-align:right;">${amountLabel}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(228,35,43,0.14);">
            <p style="margin:0;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#5c6064;font-family:Arial,Helvetica,sans-serif;">
              Covering &middot; PPF &middot; Detailing — Villers-le-Bouillet, Belgique
            </p>
            <p style="margin:8px 0 0;font-size:11px;color:#454749;font-family:Arial,Helvetica,sans-serif;">
              Tu reçois cet e-mail suite à un paiement effectué sur ecrin-wrap.vercel.app.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

async function sendInvoiceEmail(invoice) {
  const to = invoice.customer_email;
  if (!to) { console.error('[stripe-webhook] invoice has no customer_email, skipping invoice e-mail'); return; }
  if (!process.env.RESEND_API_KEY) { console.error('[stripe-webhook] Missing RESEND_API_KEY, skipping invoice e-mail'); return; }

  let planLabel = 'Ecrin Wrap';
  if (invoice.subscription) {
    try {
      const sub = await stripe.subscriptions.retrieve(invoice.subscription);
      const plan = sub.metadata && sub.metadata.plan;
      if (plan && SUB_PLAN_LABELS[plan]) planLabel = SUB_PLAN_LABELS[plan];
    } catch (e) { /* keep the generic label */ }
  }

  const amountLabel = (invoice.amount_paid / 100).toFixed(2).replace('.', ',') + ' €';
  const dateLabel = new Date(invoice.created * 1000).toLocaleDateString('fr-BE');

  const pdfRes = await fetch(invoice.invoice_pdf);
  if (!pdfRes.ok) throw new Error('Failed to download invoice PDF: ' + pdfRes.status);
  const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Ecrin Wrap <no-reply@ecrinwrap.be>',
      to: [to],
      subject: 'Ta facture Ecrin Wrap — ' + planLabel,
      html: invoiceEmailHtml(planLabel, amountLabel, dateLabel),
      attachments: [{ filename: 'facture-ecrin-wrap.pdf', content: pdfBuffer.toString('base64') }]
    })
  });
  if (!emailRes.ok) throw new Error('Resend API error: ' + emailRes.status + ' ' + (await emailRes.text()));
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

  // Invoice e-mailing is best-effort: a Resend/PDF hiccup shouldn't make
  // Stripe retry the whole webhook (which would re-run the sync above).
  if (event.type === 'invoice.payment_succeeded') {
    try {
      await sendInvoiceEmail(event.data.object);
    } catch (err) {
      console.error('[stripe-webhook] invoice e-mail failed:', err);
    }
  }

  res.status(200).json({ received: true });
};
