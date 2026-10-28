import { defineConfig, loadEnv } from 'vite';

// Adds a Content-Security-Policy to web builds (GitHub Pages and the end-to-end tests) when
// WEB_CSP=1. The Android build leaves it out because Capacitor injects its bridge as an inline script.
function contentSecurityPolicy(supabaseUrl) {
  const supabaseOrigin = supabaseUrl ? new URL(supabaseUrl).origin : '';
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    `connect-src 'self' ${supabaseOrigin}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: html => html.replace('<meta charset="utf-8">', `<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="${policy}">`)
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  return {
    plugins: process.env.WEB_CSP === '1' ? [contentSecurityPolicy(env.VITE_SUPABASE_URL)] : []
  };
});
