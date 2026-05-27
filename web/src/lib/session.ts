/**
 * Session cookie names shared by /auth/sso, /auth/logout, and the api-client.
 *
 * NOTE: Next.js 15 route handlers can only export the HTTP verb handlers
 * (GET, POST, etc.). Putting these constants in a separate module avoids the
 * type-checker rejecting them as invalid route exports.
 */
export const COOKIE_ORG = 'flux_org';
export const COOKIE_API_KEY = 'flux_key';
