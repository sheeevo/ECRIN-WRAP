// Temporary diagnostic endpoint — bypasses the Stripe SDK entirely and
// hits the Stripe REST API directly with fetch, to tell apart a bad/malformed
// STRIPE_SECRET_KEY from a genuine network/connection problem. Reveals only
// the key's length and first/last 6 chars (never the full secret), plus the
// raw response status from Stripe. Delete this file once the checkout bug
// is fixed.
module.exports = async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY || '';
  const info = {
    keyPresent: !!key,
    keyLength: key.length,
    keyPreview: key ? key.slice(0, 10) + '...' + key.slice(-4) : null,
    keyHasWhitespace: key !== key.trim(),
    nodeVersion: process.version
  };

  try {
    const r = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: 'Bearer ' + key }
    });
    const body = await r.text();
    info.fetchStatus = r.status;
    info.fetchOk = r.ok;
    info.fetchBodyPreview = body.slice(0, 300);
  } catch (err) {
    info.fetchError = err.message;
    info.fetchErrorCause = err.cause ? String(err.cause) : null;
  }

  res.status(200).json(info);
};
