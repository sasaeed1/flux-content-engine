/**
 * Flux is parked while the product is paused.
 *
 * When FLUX_PARKED is true:
 *   - the /login and /signup pages render a "Coming soon" notice instead of
 *     their sign-in / sign-up UI,
 *   - the WappFlow → Flux SSO exchange route (/auth/sso) refuses tokens and
 *     redirects to /login (so the only working way in is also closed),
 *   - every sign-in / sign-up CTA on the public landing page is greyed out
 *     with a "Coming soon" tag.
 *
 * The marketing landing page itself stays fully live.
 *
 * To bring Flux back: set NEXT_PUBLIC_FLUX_PARKED=false in the web env (or flip
 * the default below) and rebuild the web app. The companion flag on the
 * WappFlow side lives at wappflow/wappflow-web/src/lib/flux.js.
 */
export const FLUX_PARKED =
  (process.env.NEXT_PUBLIC_FLUX_PARKED ?? 'true') !== 'false';
