// Shared Stripe client. Underscore prefix keeps Vercel from treating this
// as a route (only files exporting a request handler become functions).
//
// Forces the fetch-based HTTP client: the SDK's default Node `https` agent
// has documented intermittent connection failures on Vercel's serverless
// runtime ("An error occurred with our connection to Stripe"), and fetch
// is natively available there.
const Stripe = require('stripe');

module.exports = new Stripe(process.env.STRIPE_SECRET_KEY, {
  httpClient: Stripe.createFetchHttpClient(),
  timeout: 20000,
  maxNetworkRetries: 2
});
