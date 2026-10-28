import { createClient } from '@supabase/supabase-js';
import { cachedWorkspace, cacheWorkspace, clearCachedWorkspaces, createSalesDocument, deleteAccount, inviteMember, loadAuditLog, loadWorkspace, reportClientError, saveWorkspaceRecords, setFeedbackStatus, updateOrganization } from './supabase-data.js';
import { stateFromGstin, stateLabel, stateOptions, taxBreakup } from './gst.js';
import { version as appVersion } from '../package.json';
import './styles.css';

const icons = {
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
  service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 6 18 2l4 4-4 4M20 8l-8.5 8.5M13 5l6 6M5 8l4-4 4 4-4 4M3 20l5-5 4 4-5 5H3z"/></svg>',
  invoice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21zM8 8h8M8 12h8M8 16h4"/></svg>',
  product: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5 12 3l8 4.5-8 4.5zM4 12l8 4.5 8-4.5M4 16.5 12 21l8-4.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2"/></svg>'
};
const roleLabels = { owner: 'Owner', technician: 'Technician', shop: 'Shop', customer: 'Customer' };
const emptyData = { customers: [], jobs: [], products: [], accounts: [], documents: [], feedback: [] };
const environment = import.meta.env;
const supabaseUrl = environment.VITE_SUPABASE_URL || '';
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY || '';
// Read invite/recovery link details before the Supabase client consumes and clears the URL hash.
const authLinkParams = new URLSearchParams(window.location.hash.slice(1));
const authLinkType = authLinkParams.get('type');
const authLinkError = authLinkParams.get('error_description');
// The public delete-account page links here so people can delete their account from the web.
let deleteAccountRequested = new URLSearchParams(window.location.search).get('action') === 'delete-account';
const supabaseClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
window.addEventListener('error', event => reportClientError(supabaseClient, event.error || event.message, appVersion));
window.addEventListener('unhandledrejection', event => reportClientError(supabaseClient, event.reason, appVersion));
// True when the workspace came from the on-device copy because the network was unavailable.
let offlineSince = null;
let auditLog = [];
const appShell = document.getElementById('app-shell');
const authRoot = document.getElementById('auth-root');
let data = emptyData;
let authSession = null;
let profile = null;
let organization = null;
let view = 'overview';
let salesTab = 'All documents';
let catalogTab = 'All products';
let searchQuery = '';
let roleView = 'customer';
const page = document.getElementById('page');

function renderBackendConfigMessage() {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  authRoot.innerHTML = `<section class="auth-card"><div class="auth-brand"><div class="brand-mark">${icons.product}</div><div><div class="brand-name">clearflow</div><div class="brand-caption">WATER SYSTEMS · OPERATIONS</div></div></div><div class="eyebrow" style="margin-top:24px">Backend setup required</div><h1>Connect your business workspace</h1><p>Sign-in and shared records are disabled until this app is connected to your Supabase project.</p><div class="notice"><strong>Next:</strong> create the database using <code>supabase/schema.sql</code>, then configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> for your build.</div><p class="auth-footnote">The public anon key is protected by database row-level security. Never add a service-role key to this app.</p></section>`;
}
function renderAuth(mode = 'sign-in', message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  const creating = mode === 'sign-up';
  authRoot.innerHTML = `<section class="auth-card"><div class="auth-brand"><div class="brand-mark">${icons.product}</div><div><div class="brand-name">clearflow</div><div class="brand-caption">WATER SYSTEMS · OPERATIONS</div></div></div><h1>${creating ? 'Create your workspace' : 'Welcome back'}</h1><p>${creating ? 'Set up the owner account for your water business.' : 'Sign in to your water business workspace.'}</p>${message ? `<div class="auth-message" role="status">${esc(message)}</div>` : ''}<form class="auth-form" id="auth-form">${creating ? `<div class="field"><label for="auth-full-name">Your name</label><input id="auth-full-name" name="full_name" autocomplete="name" required maxlength="160"></div><div class="field"><label for="auth-phone">Phone number</label><input id="auth-phone" name="phone" type="tel" autocomplete="tel" required></div><div class="field"><label for="auth-organization">Business name</label><input id="auth-organization" name="organization_name" required maxlength="160"></div><div class="field"><label for="auth-gstin">Business GSTIN (optional)</label><input id="auth-gstin" name="gstin" maxlength="15" autocomplete="off"></div>` : ''}<div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" minlength="8" required></div><button class="button" type="submit">${creating ? 'Create account' : 'Sign in'}</button></form><button class="auth-switch" type="button" data-auth-mode="${creating ? 'sign-in' : 'sign-up'}">${creating ? 'Already have an account? Sign in' : 'Create the first owner account'}</button>${creating ? '<p class="auth-footnote">By creating an account you agree to the <a href="./terms.html" target="_blank" rel="noopener">terms of service</a> and <a href="./privacy.html" target="_blank" rel="noopener">privacy policy</a>.</p>' : '<button class="auth-switch" type="button" data-reset-password>Forgot password?</button>'}<p class="auth-footnote">Invited technicians, shops, and customers: open the invitation email from your business to set your password, then sign in here.</p></section>`;
  authRoot.querySelector('[data-auth-mode]').addEventListener('click', event => renderAuth(event.currentTarget.dataset.authMode));
  authRoot.querySelector('[data-reset-password]')?.addEventListener('click', () => renderPasswordResetRequest());
  authRoot.querySelector('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      if (creating) {
        const { data: result, error } = await supabaseClient.auth.signUp({
          email: values.email.trim(),
          password: values.password,
          options: { ...webRedirectOption('emailRedirectTo'), data: { full_name: values.full_name.trim(), phone: values.phone.trim(), organization_name: values.organization_name.trim(), gstin: values.gstin.trim() } }
        });
        if (error) throw error;
        if (result.session) await openAuthenticatedApp(result.session);
        else renderAuth('sign-in', 'Check your email to confirm the owner account, then sign in to finish workspace setup.');
      } else {
        const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (error) throw error;
        await openAuthenticatedApp(result.session);
      }
    } catch (error) {
      renderAuth(mode, error instanceof Error ? error.message : 'Sign-in failed. Check your details and try again.');
    }
  });
}
// Email links should return to the page they were requested from. In the Android app that page
// is not reachable from an email link, so let Supabase fall back to its Site URL.
function webRedirectOption(name) {
  return window.Capacitor?.isNativePlatform?.() ? {} : { [name]: window.location.origin + window.location.pathname };
}
function authBrand() {
  return `<div class="auth-brand"><div class="brand-mark">${icons.product}</div><div><div class="brand-name">clearflow</div><div class="brand-caption">WATER SYSTEMS · OPERATIONS</div></div></div>`;
}
function renderPasswordResetRequest(message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>Reset your password</h1><p>Enter your account email and we'll send you a link to choose a new password.</p>${message ? `<div class="auth-message" role="status">${esc(message)}</div>` : ''}<form class="auth-form" id="reset-form"><div class="field"><label for="reset-email">Email</label><input id="reset-email" name="email" type="email" autocomplete="email" required></div><button class="button" type="submit">Send reset link</button></form><button class="auth-switch" type="button" data-auth-mode="sign-in">Back to sign in</button></section>`;
  authRoot.querySelector('[data-auth-mode]').addEventListener('click', () => renderAuth('sign-in'));
  authRoot.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email').trim();
    event.currentTarget.querySelector('[type="submit"]').disabled = true;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, webRedirectOption('redirectTo'));
    if (error) { renderPasswordResetRequest(error.message); return; }
    renderAuth('sign-in', 'If that email has an account, a password reset link is on its way.');
  });
}
function renderSetPassword(session, linkType, message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  const invited = linkType === 'invite';
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>${invited ? 'Set your password' : 'Choose a new password'}</h1><p>${invited ? `Welcome! Choose a password for <strong>${esc(session.user.email)}</strong>. You'll use it to sign in on this and other devices.` : `Choose a new password for <strong>${esc(session.user.email)}</strong>.`}</p>${message ? `<div class="auth-message" role="alert">${esc(message)}</div>` : ''}<form class="auth-form" id="password-form"><div class="field"><label for="new-password">New password</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="confirm-password">Confirm password</label><input id="confirm-password" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div><button class="button" type="submit">Save password</button></form></section>`;
  authRoot.querySelector('#password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (values.password !== values.confirm) { renderSetPassword(session, linkType, 'The passwords do not match.'); return; }
    event.currentTarget.querySelector('[type="submit"]').disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password: values.password });
    if (error) { renderSetPassword(session, linkType, error.message); return; }
    await openAuthenticatedApp(session);
  });
}
function renderOrganizationSetup(message = '') {
  authRoot.hidden = false;
  appShell.hidden = true;
  authRoot.className = 'auth-screen';
  const userMetadata = authSession.user.user_metadata || {};
  authRoot.innerHTML = `<section class="auth-card"><div class="auth-brand"><div class="brand-mark">${icons.product}</div><div><div class="brand-name">clearflow</div><div class="brand-caption">WATER SYSTEMS · OPERATIONS</div></div></div><h1>Finish business setup</h1><p>Confirm the legal details for your organization before adding customers or issuing invoices.</p>${message ? `<div class="auth-message" role="alert">${esc(message)}</div>` : ''}<form class="auth-form" id="organization-form"><div class="field"><label for="organization-name">Business name</label><input id="organization-name" name="name" required maxlength="160" value="${esc(userMetadata.organization_name || '')}"></div><div class="field"><label for="organization-gstin">GSTIN (optional)</label><input id="organization-gstin" name="gstin" maxlength="15" value="${esc(userMetadata.gstin || '')}"></div><div class="field"><label for="organization-address">Business address</label><input id="organization-address" name="address" maxlength="300"></div><div class="field"><label for="organization-state">State</label><select id="organization-state" name="state">${stateOptions(stateFromGstin(userMetadata.gstin))}</select></div><div class="field"><label for="organization-phone">Business phone</label><input id="organization-phone" name="phone" type="tel" value="${esc(userMetadata.phone || '')}"></div><button class="button" type="submit">Create workspace</button></form></section>`;
  authRoot.querySelector('#organization-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const { data: organizationId, error } = await supabaseClient.rpc('create_organization', { organization_name: values.name.trim(), organization_gstin: values.gstin.trim() || null });
    if (error) { renderOrganizationSetup(error.message); return; }
    try {
      await updateOrganization(supabaseClient, organizationId, { ...values, state: values.state || stateFromGstin(values.gstin) });
    } catch (detailsError) {
      toast(`Workspace created, but the business details were not saved: ${detailsError.message}`);
    }
    await openAuthenticatedApp(authSession);
  });
}
async function openAuthenticatedApp(session) {
  authSession = session;
  const { data: profileData, error: profileError } = await supabaseClient
    .from('profiles')
    .select('user_id, organization_id, role, full_name, login_email, phone, business_name, business_address, gstin, customer_id, active')
    .eq('user_id', session.user.id)
    .single();
  if (profileError) {
    if (openCachedWorkspace(session)) return;
    renderAuth('sign-in', `Profile setup is not ready yet: ${profileError.message}`);
    return;
  }
  profile = profileData;
  if (!profile.active) { renderAuth('sign-in', 'This account has been disabled. Contact your organization owner.'); return; }
  if (!profile.organization_id) { renderOrganizationSetup(); return; }

  try {
    const { data: org, error: organizationError } = await supabaseClient
      .from('organizations')
      .select('*')
      .eq('id', profile.organization_id)
      .single();
    if (organizationError) throw organizationError;
    organization = org;
    data = await loadWorkspace(supabaseClient, profile);
    auditLog = profile.role === 'owner' ? await loadAuditLog(supabaseClient, profile.organization_id) : [];
    offlineSince = null;
    cacheWorkspace(session.user.id, { profile, organization, data });
  } catch (error) {
    if (openCachedWorkspace(session)) return;
    renderAuth('sign-in', error instanceof Error ? error.message : 'Workspace could not be loaded');
    return;
  }
  showWorkspace();
}
// Without a network connection, show the last workspace synced to this device, read-only.
function openCachedWorkspace(session) {
  if (navigator.onLine) return false;
  const cached = cachedWorkspace(session.user.id);
  if (!cached) return false;
  ({ profile, organization, data } = cached.workspace);
  auditLog = [];
  offlineSince = cached.savedAt;
  showWorkspace();
  return true;
}
function showWorkspace() {
  roleView = profile.role === 'owner' ? (localStorage.getItem('clearflow-role') || 'customer') : profile.role;
  document.getElementById('role-select').value = roleView;
  updateRoleControl();
  document.getElementById('user-name').textContent = profile.full_name || profile.login_email;
  document.getElementById('user-role').textContent = roleLabels[profile.role] || profile.role;
  document.getElementById('user-initials').textContent = initials(profile.full_name || profile.login_email);
  document.getElementById('signout-button').hidden = false;
  updateRoleAccess();
  authRoot.hidden = true;
  appShell.hidden = false;
  render();
  if (deleteAccountRequested) {
    deleteAccountRequested = false;
    window.history.replaceState(null, '', window.location.pathname);
    openAccountSettings();
  }
}
function updateRoleAccess() {
  const allowedViews = {
    owner: ['overview', 'customers', 'jobs', 'sales', 'catalog', 'accounts', 'feedback'],
    technician: ['overview', 'jobs', 'catalog', 'feedback'],
    shop: ['overview', 'catalog', 'feedback'],
    customer: ['overview', 'jobs', 'catalog', 'sales', 'feedback']
  }[profile?.role] || [];
  document.querySelectorAll('.nav-item[data-view]').forEach(button => { button.hidden = !allowedViews.includes(button.dataset.view); });
}
async function initializeApp() {
  if (!supabaseClient) { renderBackendConfigMessage(); return; }
  supabaseClient.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT') {
      authSession = null; profile = null; organization = null; data = emptyData; auditLog = []; offlineSince = null;
      clearCachedWorkspaces();
      document.getElementById('signout-button').hidden = true;
      renderAuth('sign-in');
    }
  });
  const { data: sessionData, error } = await supabaseClient.auth.getSession();
  if (authLinkType || authLinkError) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (authLinkError) { renderAuth('sign-in', `That email link could not be used: ${authLinkError}. Ask your business owner for a new invitation, or use "Forgot password?".`); return; }
  if (error) { renderAuth('sign-in', error.message); return; }
  if (sessionData.session && (authLinkType === 'invite' || authLinkType === 'recovery')) { renderSetPassword(sessionData.session, authLinkType); return; }
  if (sessionData.session) await openAuthenticatedApp(sessionData.session);
  else renderAuth('sign-in', deleteAccountRequested ? 'Sign in to delete your Clearflow account.' : '');
}
function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
function money(value) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value) || 0); }
function date(value) { if (!value) return '—'; return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function shortDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`)); }
function customer(id) { return data.customers.find(item => item.id === id) || { name: 'Unknown customer', phone: '', address: '' }; }
function product(id) { return data.products.find(item => item.id === id) || { name: 'Removed product', gst: 18 }; }
function price(productItem, role = roleView) { return productItem[role] ?? productItem.customer ?? 0; }
function initials(name = '') { return name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase(); }
function setView(next) {
  const target = document.querySelector(`.nav-item[data-view="${next}"]`);
  if (!target || target.hidden) return;
  view = next; searchQuery = '';
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === next));
  document.getElementById('crumb-title').textContent = ({ overview: 'Overview', customers: 'Customers', jobs: 'Service jobs', sales: 'Sales & invoices', catalog: 'Product catalogue', accounts: 'Accounts & access', feedback: 'Feedback' })[next];
  updateRoleControl();
  render();
  if (next === 'accounts' && profile?.role === 'owner' && !offlineSince) {
    loadAuditLog(supabaseClient, profile.organization_id)
      .then(rows => { auditLog = rows; if (view === 'accounts') render(); })
      .catch(error => reportClientError(supabaseClient, error, appVersion));
  }
}
// The owner's price-list preview only affects the catalogue, so keep it out of the top bar elsewhere.
function updateRoleControl() {
  document.getElementById('role-control').hidden = profile?.role !== 'owner' || view !== 'catalog';
}
function render() {
  if (profile) updateRoleAccess();
  document.getElementById('customer-count').textContent = data.customers.length;
  document.getElementById('jobs-count').textContent = data.jobs.filter(item => item.status !== 'Completed').length;
  if (view === 'overview') renderOverview();
  if (view === 'customers') renderCustomers();
  if (view === 'jobs') renderJobs();
  if (view === 'sales') renderSales();
  if (view === 'catalog') renderCatalog();
  if (view === 'accounts') renderAccounts();
  if (view === 'feedback') renderFeedback();
  if (offlineSince) page.insertAdjacentHTML('afterbegin', `<div class="notice offline-notice" role="status"><strong>Offline.</strong> Showing data last synced ${esc(new Date(offlineSince).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}. Changes can be made once you are back online.</div>`);
}
window.addEventListener('online', () => { if (offlineSince && authSession) openAuthenticatedApp(authSession); });
async function save(collection, records) {
  if (!supabaseClient || !profile) throw new Error('Sign in before saving workspace data');
  await saveWorkspaceRecords(supabaseClient, profile, collection, records, data.accounts);
}
function pageHead(kicker, title, subtitle, action = '') {
  return `<div class="page-head"><div><div class="eyebrow">${kicker}</div><h1>${title}</h1><p class="subhead">${subtitle}</p></div>${action}</div>`;
}
function metric(label, value, note, icon) {
  return `<div class="metric"><div class="metric-top"><span>${label}</span><span class="metric-icon">${icon}</span></div><div class="metric-value">${value}</div><div class="metric-note">${note}</div></div>`;
}
function renderOverview() {
  const currentDate = new Date();
  const month = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit' }).format(currentDate);
  const currentMonthLabel = new Intl.DateTimeFormat('en', { month: 'long' }).format(currentDate);
  const monthDocs = data.documents.filter(doc => doc.type === 'Invoice' && doc.date.startsWith(month));
  const monthTotal = monthDocs.reduce((sum, doc) => sum + totals(doc).grand, 0);
  const upcoming = [...data.jobs].filter(job => job.status !== 'Completed').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const monthlySales = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11 + index, 1);
    const key = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit' }).format(monthDate);
    const label = new Intl.DateTimeFormat('en', { month: 'short' }).format(monthDate);
    const total = data.documents.filter(doc => doc.type === 'Invoice' && doc.date.startsWith(key)).reduce((sum, doc) => sum + totals(doc).grand, 0);
    return { label, total };
  });
  const chartMaximum = Math.max(1, ...monthlySales.map(item => item.total));
  const needsSetup = data.customers.length === 0 && data.products.length === 0;
  const owner = profile.role === 'owner';
  const setupPanel = owner && needsSetup ? `<section class="setup-panel"><div class="setup-copy"><div class="eyebrow">First steps</div><h2>Set up your RO workspace</h2><p>Add your first customer and catalogue item to start managing service and sales.</p></div><div class="setup-actions"><button class="button" data-action="new-customer">${icons.plus} Add customer</button><button class="button secondary" data-action="new-product">${icons.product} Add product</button></div></section>` : '';
  const quickActions = owner
    ? `<button class="quick-action" data-action="new-customer">${icons.person}<span>Add customer</span></button><button class="quick-action" data-action="new-job">${icons.service}<span>Schedule service</span></button><button class="quick-action" data-action="new-sale">${icons.invoice}<span>New quotation</span></button><button class="quick-action" data-nav="catalog">${icons.product}<span>View catalogue</span></button>`
    : profile.role === 'technician'
      ? `<button class="quick-action" data-nav="jobs">${icons.service}<span>Assigned jobs</span></button><button class="quick-action" data-nav="catalog">${icons.product}<span>Parts pricing</span></button><button class="quick-action" data-nav="feedback">${icons.invoice}<span>Report an issue</span></button>`
      : profile.role === 'shop'
        ? `<button class="quick-action" data-nav="catalog">${icons.product}<span>Shop catalogue</span></button><button class="quick-action" data-nav="feedback">${icons.invoice}<span>Contact support</span></button>`
        : `<button class="quick-action" data-nav="jobs">${icons.service}<span>My service</span></button><button class="quick-action" data-nav="sales">${icons.invoice}<span>My documents</span></button><button class="quick-action" data-nav="feedback">${icons.person}<span>Send feedback</span></button>`;
        const canViewStock = owner || profile.role === 'technician';
        const productRows = data.products.slice(0, 4).map(item => `<div class="job-row"><div class="job-symbol">${icons.product}</div><div class="job-copy"><strong>${esc(item.name)}</strong><span>${esc(item.category)}${canViewStock ? ` · ${item.stock} in stock` : ''}</span></div>${canViewStock ? `<span class="status ${item.stock < 5 ? 'scheduled' : ''}">${item.stock < 5 ? 'Low stock' : 'In stock'}</span>` : ''}</div>`).join('') || '<div class="empty">Add products to start tracking stock.</div>';
  const jobRows = upcoming.length ? upcoming.map(job => {
    const person = customer(job.customerId);
    const statusClass = job.status.toLowerCase().replace(/\s+/g, '-');
    return `<div class="job-row"><div class="job-symbol">${icons.service}</div><div class="job-copy"><strong>${esc(person.name)}</strong><span>${esc(job.type)} · ${shortDate(job.date)} · ${esc(job.technician || 'Unassigned')}</span></div><span class="status ${statusClass}">${esc(job.status)}</span></div>`;
  }).join('') : '<div class="empty">No upcoming service jobs.</div>';
  const activity = data.documents.slice(0, 3).map(doc => `<div class="feed-line"><span class="feed-dot"></span><div class="feed-text"><strong>${esc(doc.id)}</strong> ${doc.type.toLowerCase()} for ${esc(customer(doc.customerId).name)}<span class="feed-time">${shortDate(doc.date)} · ${money(totals(doc).grand)}</span></div></div>`).join('');
  page.innerHTML = `${pageHead(new Intl.DateTimeFormat('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentDate), `Good morning, ${esc(profile.full_name?.split(/\s+/)[0] || 'there')}`, 'Here’s what’s happening across your water business today.', owner ? `<button class="button" data-action="new-sale">${icons.plus} Create quotation</button>` : '')}
    <div class="metrics">${metric(`${currentMonthLabel} sales`, money(monthTotal), '<b>Invoice total</b> · this month', icons.invoice)}${metric('Active customers', data.customers.length, '<b>Customer records</b> · all locations', icons.person)}${metric('Open service jobs', data.jobs.filter(item => item.status !== 'Completed').length, '<b>Scheduled and in progress</b>', icons.service)}${metric('Products in catalogue', data.products.length, '<b>Purifiers, spares & accessories</b>', icons.product)}</div>${setupPanel}
    <div class="dash-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">Sales overview</div><div class="panel-note">Invoice value · last 12 months</div></div><button class="text-link" data-nav="sales">View sales →</button></div><div class="chart-wrap"><div class="chart-summary"><strong>${money(monthTotal)}</strong><span>${currentMonthLabel}</span></div><div class="chart">${monthlySales.map((item, index) => `<div class="bar-group"><div class="bar ${index === 11 ? 'current' : ''}" style="height:${Math.max(3, Math.round(item.total / chartMaximum * 100))}%" title="${esc(item.label)}: ${money(item.total)}"></div><span class="bar-label">${esc(item.label)}</span></div>`).join('')}</div><div class="chart-legend"><span class="legend-dot"></span>Revenue from invoices</div></div></section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">Upcoming service</div><div class="panel-note">Next scheduled visits</div></div><button class="text-link" data-nav="jobs">All jobs →</button></div><div class="job-list">${jobRows}</div></section></div>
    <div class="lower-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">Quick actions</div><div class="panel-note">Common tasks, one tap away</div></div></div><div class="quick-grid">${quickActions}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Recent activity</div><div class="panel-note">Latest quotations and invoices</div></div>${owner ? '<button class="text-link" data-nav="sales">View all →</button>' : ''}</div><div class="feed">${activity || '<div class="empty">No recent sales activity.</div>'}</div></section></div>
    ${canViewStock ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><div class="panel-title">Stock watch</div><div class="panel-note">Popular parts and current availability</div></div><button class="text-link" data-nav="catalog">Full catalogue →</button></div><div class="job-list">${productRows}</div></section>` : ''}`;
}
function renderCustomers() {
  const owner = profile.role === 'owner';
  const filtered = data.customers.filter(item => `${item.name} ${item.phone} ${item.address} ${item.id}`.toLowerCase().includes(searchQuery.toLowerCase()));
  page.innerHTML = `${pageHead('Customer relationships', 'Customers', `${data.customers.length} customer records · installation and contact details`, owner ? `<button class="button" data-action="new-customer">${icons.plus} Add customer</button>` : '')}
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="Search name, phone, address…" value="${esc(searchQuery)}"></div><select class="filter-select" id="customer-type-filter"><option value="All">All customer types</option><option>Residential</option><option>Commercial</option><option>Apartment</option></select></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Customer</th><th>Phone</th><th>Customer type</th><th>Installed unit</th><th>Installation date</th><th>Address</th>${owner ? '<th></th>' : ''}</tr></thead><tbody>${filtered.length ? filtered.map(item => `<tr><td><div class="person-cell"><span class="mini-avatar">${initials(item.name)}</span><div><strong>${esc(item.name)}</strong><div class="muted-cell">${esc(item.id)} · ${esc(item.email || 'No email')}</div></div></div></td><td><a class="call-link" href="tel:${esc(item.phone.replace(/\s/g, ''))}">${esc(item.phone)}</a></td><td>${esc(item.type)}</td><td>${esc(item.purifier || 'Not recorded')}</td><td>${date(item.installed)}</td><td>${esc(item.address)}</td>${owner ? `<td><button class="row-action" data-edit-customer="${esc(item.id)}" aria-label="Edit ${esc(item.name)}" title="Edit customer">✎</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${owner ? 7 : 6}" class="empty">No matching customers.</td></tr>`}</tbody></table></div></section>`;
  bindSearch();
  document.getElementById('customer-type-filter').addEventListener('change', event => {
    const selected = event.target.value;
    page.querySelectorAll('tbody tr').forEach(row => { row.hidden = selected !== 'All' && row.children[2]?.textContent !== selected; });
  });
}
function renderJobs() {
  const owner = profile.role === 'owner';
  const technician = profile.role === 'technician';
  const filtered = data.jobs.filter(item => `${item.id} ${item.type} ${item.technician} ${customer(item.customerId).name} ${item.status}`.toLowerCase().includes(searchQuery.toLowerCase()));
  page.innerHTML = `${pageHead('Installations & aftercare', 'Service jobs', `${data.jobs.length} job records · ${data.jobs.filter(item => item.status !== 'Completed').length} still open`, owner ? `<button class="button" data-action="new-job">${icons.plus} Schedule service</button>` : '')}
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="Search customer, job or technician…" value="${esc(searchQuery)}"></div><select class="filter-select" id="job-status-filter"><option value="All">All statuses</option><option>Scheduled</option><option>In progress</option><option>Completed</option></select></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Job ID</th><th>Customer</th><th>Contact</th><th>Service type</th><th>Visit date</th><th>Technician</th><th>Status</th>${owner || technician ? '<th></th>' : ''}</tr></thead><tbody>${filtered.length ? filtered.map(item => `<tr><td><strong>${esc(item.id)}</strong></td><td class="job-customer">${esc(customer(item.customerId).name)}</td><td><a class="call-link" href="tel:${esc(customer(item.customerId).phone.replace(/\s/g, ''))}">${esc(customer(item.customerId).phone)}</a></td><td>${esc(item.type)}</td><td>${date(item.date)}</td><td>${esc(item.technician || 'Unassigned')}</td><td><span class="status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${esc(item.status)}</span></td>${owner || technician ? `<td><button class="row-action" data-edit-job="${esc(item.id)}" aria-label="${technician ? 'Update' : 'Edit'} job ${esc(item.id)}" title="${technician ? 'Update job' : 'Edit job'}">✎</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${owner || technician ? 8 : 7}" class="empty">No matching service jobs.</td></tr>`}</tbody></table></div></section>`;
  bindSearch();
  document.getElementById('job-status-filter').addEventListener('change', event => {
    const selected = event.target.value;
    page.querySelectorAll('tbody tr').forEach(row => { row.hidden = selected !== 'All' && row.children[6]?.textContent.trim() !== selected; });
  });
}
function totals(doc) {
  const subtotal = doc.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
  const gst = doc.gst ? doc.items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0) * Number(item.gst ?? product(item.productId).gst ?? 18) / 100, 0) : 0;
  return { subtotal, gst, grand: subtotal + gst };
}
function renderSales() {
  const owner = profile.role === 'owner';
  const tabs = ['All documents', 'Quotations', 'Invoices'];
  let docs = [...data.documents].sort((a, b) => b.date.localeCompare(a.date));
  if (salesTab === 'Quotations') docs = docs.filter(doc => doc.type === 'Quotation');
  if (salesTab === 'Invoices') docs = docs.filter(doc => doc.type === 'Invoice');
  page.innerHTML = `${pageHead('Quotes, billing & tax', 'Sales & invoices', 'Prepare quotations and invoices with GST or as non-GST documents.', owner ? `<button class="button" data-action="new-sale">${icons.plus} New document</button>` : '')}
    <div class="notice"><strong>Tax options:</strong> choose GST-inclusive billing (product tax rates apply) or a non-GST document when creating a quotation or invoice.</div>
    <section class="panel table-panel"><div class="tabs">${tabs.map(tab => `<button class="tab ${salesTab === tab ? 'active' : ''}" data-sales-tab="${tab}">${tab}</button>`).join('')}</div><div class="table-scroll"><table><thead><tr><th>Document</th><th>Customer</th><th>Date</th><th>Due date</th><th>Tax</th><th>Amount</th><th>Status</th><th></th></tr></thead><tbody>${docs.length ? docs.map(doc => `<tr><td><strong>${esc(doc.id)}</strong><div class="muted-cell">${esc(doc.type)}</div></td><td>${esc(customer(doc.customerId).name)}</td><td>${date(doc.date)}</td><td>${date(doc.due)}</td><td>${doc.gst ? 'GST' : 'No GST'}</td><td><strong>${money(totals(doc).grand)}</strong></td><td><span class="status ${doc.status.toLowerCase()}">${esc(doc.status)}</span></td><td><button class="row-action" data-print-doc="${esc(doc.id)}" aria-label="Print ${esc(doc.id)}" title="Print document">${icons.download}</button></td></tr>`).join('') : '<tr><td colspan="8" class="empty">No documents in this view yet.</td></tr>'}</tbody></table></div></section>`;
}
function renderCatalog() {
  const owner = profile.role === 'owner';
  const tabs = ['All products', 'Purifiers', 'Accessories', 'Spare parts'];
  const products = data.products.filter(item => catalogTab === 'All products' || item.category === catalogTab);
  page.innerHTML = `${pageHead('Products & pricing', 'Product catalogue', `Purifiers, accessories and spares · prices shown for ${roleView} access`, owner ? `<button class="button" data-action="new-product">${icons.plus} Add product</button>` : '')}
    <div class="notice">${owner ? `Previewing <strong>${roleView}</strong> pricing. Each signed-in role can only retrieve its own price tier.` : `Showing the <strong>${roleView}</strong> prices assigned to your account.`}</div>
    <section class="panel" style="margin-bottom:15px"><div class="tabs">${tabs.map(tab => `<button class="tab ${catalogTab === tab ? 'active' : ''}" data-catalog-tab="${tab}">${tab}</button>`).join('')}</div></section>
    <div class="product-grid">${products.length ? products.map((item, index) => `<article class="product"><div class="product-top"><div class="product-art ${index % 3 === 1 ? 'blue' : index % 3 === 2 ? 'gold' : ''}">${item.category === 'Purifiers' ? icons.product : item.category === 'Accessories' ? icons.service : icons.invoice}</div><span class="category">${esc(item.category)}</span></div><div class="product-info"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="product-price"><div><span>${esc(roleView)} price</span><strong>${money(price(item))}</strong></div>${owner || profile.role === 'technician' ? `<span>${item.stock} in stock</span>` : ''}</div>${owner ? `<div class="price-other"><span>Customer <b>${money(item.customer)}</b></span><span>Tech <b>${money(item.technician)}</b></span><span>Shop <b>${money(item.shop)}</b></span></div>` : ''}</div></article>`).join('') : '<div class="empty">No products in this category.</div>'}</div>`;
}
function renderAccounts() {
  if (profile.role !== 'owner') { page.innerHTML = '<div class="empty">Only the organization owner can manage accounts.</div>'; return; }
  page.innerHTML = `${pageHead('People, partners & permissions', 'Accounts & access', 'Technician, shop and customer accounts with role-based price access.', `<div class="head-actions"><button class="button secondary" data-action="business-details">Business details</button><button class="button" data-action="new-account">${icons.plus} Add account</button></div>`)}
    <div class="notice"><strong>Access note:</strong> each person signs in with their own email and password, and sees only the records and price tier their role allows.</div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Account</th><th>Login ID</th><th>Access role</th><th>Phone</th><th>Business address</th><th>GSTIN</th><th>Linked record</th><th>Price list</th><th>Status</th><th></th></tr></thead><tbody>${data.accounts.map(account => `<tr><td><div class="person-cell"><span class="mini-avatar">${initials(account.name)}</span><strong>${esc(account.name)}</strong></div></td><td>${esc(account.username)}</td><td><span class="role-tag">${esc(account.role)}</span></td><td><a class="call-link" href="tel:${esc(account.phone.replace(/\s/g, ''))}">${esc(account.phone)}</a></td><td>${esc(account.address || '—')}</td><td>${esc(account.gstin || '—')}</td><td>${esc(account.linked)}</td><td>${account.role === 'Technician' ? 'Technician' : account.role === 'Shop' ? 'Shop' : account.role === 'Customer' ? 'Customer' : 'All prices'}</td><td><span class="status">${esc(account.status)}</span></td><td><button class="row-action" data-edit-account="${esc(account.id)}" aria-label="Edit ${esc(account.name)}" title="Edit account">✎</button></td></tr>`).join('')}</tbody></table></div></section>
    <div class="lower-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">Price access</div><div class="panel-note">Each account role sees its own price tier</div></div></div><div class="job-list"><div class="job-row"><div class="job-symbol">${icons.person}</div><div class="job-copy"><strong>Customer price</strong><span>Retail price shown to end customers</span></div><span class="role-tag">Retail</span></div><div class="job-row"><div class="job-symbol">${icons.service}</div><div class="job-copy"><strong>Technician price</strong><span>Service team rate for spares and units</span></div><span class="role-tag">Service</span></div><div class="job-row"><div class="job-symbol">${icons.product}</div><div class="job-copy"><strong>Shop price</strong><span>Partner / reseller wholesale rate</span></div><span class="role-tag">Wholesale</span></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">Login details</div><div class="panel-note">Account usernames are listed above</div></div></div><div class="feed"><div class="feed-line"><span class="feed-dot"></span><div class="feed-text">Passwords are never shown here.<span class="feed-time">Invited people choose their own password from the email link, and can reset it from the sign-in screen.</span></div></div><div class="feed-line"><span class="feed-dot"></span><div class="feed-text">Technician and shop accounts can be linked to their contact or business records.<span class="feed-time">Account records are editable.</span></div></div></div></section></div>`;
  page.insertAdjacentHTML('beforeend', renderAuditLog());
}
const auditTableLabels = { customers: 'Customer', products: 'Product', product_prices: 'Price', service_jobs: 'Service job', sales_documents: 'Sales document', profiles: 'Team account', organizations: 'Business details' };
const auditActionLabels = { insert: 'added', update: 'changed', delete: 'deleted' };
function renderAuditLog() {
  const names = new Map(data.accounts.map(account => [account.id, account.name || account.username]));
  const rows = auditLog.map(entry => `<div class="feed-line"><span class="feed-dot"></span><div class="feed-text">${esc(auditTableLabels[entry.table_name] || entry.table_name)} <strong>${esc(entry.record_id)}</strong> ${auditActionLabels[entry.action] || entry.action} by ${esc(names.get(entry.changed_by) || (entry.changed_by ? 'a removed account' : 'the system'))}<span class="feed-time">${esc(new Date(entry.changed_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }))}</span></div></div>`).join('');
  return `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><div class="panel-title">Activity log</div><div class="panel-note">Last 50 changes to customers, products, prices, jobs, invoices and team accounts</div></div></div><div class="feed">${rows || '<div class="empty">No changes recorded yet.</div>'}</div></section>`;
}
function renderFeedback() {
  const owner = profile.role === 'owner';
  const entries = [...data.feedback].filter(item => `${item.id} ${item.type} ${item.title} ${item.description} ${item.name} ${item.phone}`.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statuses = ['New', 'In review', 'In progress', 'Planned', 'Resolved', 'Closed'];
  page.innerHTML = `${pageHead('Customer support', 'Feedback & issues', 'Customer feedback, reported problems, and product ideas.', `<button class="button" data-action="submit-feedback">${icons.plus} Submit feedback</button>`)}
    <div class="notice"><strong>Support:</strong> reports are linked to your signed-in account and visible according to your organization role.</div>
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="Search reports, customers or reference…" value="${esc(searchQuery)}"></div><span class="role-tag">${data.feedback.length} submitted</span></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>Report</th><th>Category</th><th>Customer</th><th>Priority</th><th>Submitted</th><th>Status</th></tr></thead><tbody>${entries.length ? entries.map(item => `<tr><td><strong>${esc(item.title)}</strong><div class="muted-cell">${esc(item.id)} · ${esc(item.description)}</div>${item.reference ? `<div class="muted-cell">Ref: ${esc(item.reference)}</div>` : ''}</td><td><span class="role-tag">${esc(item.type)}</span></td><td><strong>${esc(item.name)}</strong><div class="muted-cell">${esc(item.phone)}${item.email ? ` · ${esc(item.email)}` : ''}</div></td><td><span class="status ${item.priority.toLowerCase()}">${esc(item.priority)}</span></td><td>${date(item.date)}</td><td>${owner ? `<select class="filter-select" data-feedback-status="${esc(item.id)}" aria-label="Update status for ${esc(item.title)}">${statuses.map(status => `<option ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select>` : `<span class="status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${esc(item.status)}</span>`}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">No feedback reports yet.</td></tr>'}</tbody></table></div></section>`;
  bindSearch();
}
function bindSearch() {
  const input = page.querySelector('[data-search]');
  input.addEventListener('input', event => { searchQuery = event.target.value; render(); const next = page.querySelector('[data-search]'); next.focus(); next.setSelectionRange(searchQuery.length, searchQuery.length); });
}
function toast(message) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast">${esc(message)}</div>`;
  window.setTimeout(() => { root.innerHTML = ''; }, 2600);
}
function showModal(title, subtitle, body, submitLabel, onSubmit, wide = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay" data-dismiss><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-button" data-close aria-label="Close">${icons.close}</button></div><div class="modal-body"><form id="active-form">${body}<div class="modal-actions"><button type="button" class="button secondary" data-close>Cancel</button><button type="submit" class="button">${esc(submitLabel)}</button></div></form></div></section></div>`;
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector('[data-dismiss]').addEventListener('click', event => { if (event.target === event.currentTarget) closeModal(); });
  root.querySelector('#active-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (offlineSince && onSubmit !== closeModal) { toast('You are offline. Changes can be saved once you are back online.'); return; }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try { await onSubmit(new FormData(event.currentTarget), event.currentTarget); }
    catch (error) { submit.disabled = false; toast(error instanceof Error ? error.message : 'Save failed. Try again.'); }
  });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function customerOptions(selected = '') { return data.customers.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.name)} · ${esc(item.phone)}</option>`).join(''); }
function openCustomerForm(existing) {
  if (profile.role !== 'owner') { toast('Only the owner can manage customer records'); return; }
  const item = existing || {};
  showModal(existing ? 'Edit customer' : 'Add customer', 'Contact, address and installation details', `<div class="form-grid"><div class="field"><label for="name">Customer / business name *</label><input id="name" name="name" required value="${esc(item.name || '')}"></div><div class="field"><label for="phone">Phone number *</label><input id="phone" name="phone" type="tel" required value="${esc(item.phone || '')}"></div><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value="${esc(item.email || '')}"></div><div class="field"><label for="type">Customer type</label><select id="type" name="type"><option ${item.type === 'Residential' ? 'selected' : ''}>Residential</option><option ${item.type === 'Commercial' ? 'selected' : ''}>Commercial</option><option ${item.type === 'Apartment' ? 'selected' : ''}>Apartment</option></select></div><div class="field full"><label for="address">Full address</label><textarea id="address" name="address">${esc(item.address || '')}</textarea></div><div class="field"><label for="gstin">Customer GSTIN (business customers)</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="state">State (place of supply)</label><select id="state" name="state">${stateOptions(item.state || '')}</select></div><div class="field"><label for="purifier">Purifier / model installed</label><input id="purifier" name="purifier" value="${esc(item.purifier || '')}"></div><div class="field"><label for="installed">Installation date</label><input id="installed" name="installed" type="date" value="${esc(item.installed || '')}"></div></div>`, existing ? 'Save changes' : 'Add customer', async form => {
    const value = Object.fromEntries(form.entries());
    const next = { ...item, ...value, id: existing?.id || `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, notes: item.notes || '', gstin: value.gstin.trim().toUpperCase(), state: value.state || stateFromGstin(value.gstin) };
    await save('customers', [next]);
    if (existing) Object.assign(existing, next); else data.customers.unshift(next);
    closeModal(); render(); toast(existing ? 'Customer updated' : 'Customer added');
  });
}
function openJobForm(existing) {
  if (!data.customers.length) { toast('Add a customer before scheduling a service job'); return; }
  if (profile.role !== 'owner' && (profile.role !== 'technician' || !existing)) { toast('Only an owner can schedule a service job'); return; }
  const item = existing || {};
  const technicianMode = profile.role === 'technician';
  const formBody = technicianMode
    ? `<div class="form-grid"><div class="field"><label>Customer</label><input value="${esc(customer(item.customerId).name)}" disabled></div><div class="field"><label>Service type</label><input value="${esc(item.type)}" disabled></div><div class="field full"><label for="status">Update status</label><select name="status" id="status"><option ${item.status === 'In progress' ? 'selected' : ''}>In progress</option><option ${item.status === 'Completed' ? 'selected' : ''}>Completed</option></select></div><div class="field full"><label for="notes">Service notes</label><textarea id="notes" name="notes">${esc(item.notes || '')}</textarea></div></div>`
    : `<div class="form-grid"><div class="field full"><label for="customerId">Customer *</label><select id="customerId" name="customerId" required>${customerOptions(item.customerId)}</select></div><div class="field"><label for="type">Service type *</label><select id="type" name="type" required>${['Installation', 'Filter replacement', 'Routine maintenance', 'Quarterly maintenance', 'Low water flow', 'Repair', 'Other'].map(type => `<option ${item.type === type ? 'selected' : ''}>${type}</option>`).join('')}</select></div><div class="field"><label for="date">Visit date *</label><input id="date" name="date" type="date" required value="${esc(item.date || new Date().toISOString().slice(0, 10))}"></div><div class="field"><label for="technician">Technician</label><input id="technician" name="technician" list="technician-list" value="${esc(item.technician || '')}"><datalist id="technician-list">${data.accounts.filter(account => account.role === 'Technician').map(account => `<option value="${esc(account.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="status">Status</label><select name="status" id="status">${['Scheduled', 'In progress', 'Completed', 'Cancelled'].map(status => `<option ${item.status === status ? 'selected' : ''}>${status}</option>`).join('')}</select></div><div class="field full"><label for="notes">Job notes</label><textarea id="notes" name="notes">${esc(item.notes || '')}</textarea></div></div>`;
  showModal(technicianMode ? 'Update service job' : existing ? 'Edit service job' : 'Schedule service', 'Installation, maintenance and repair visits', formBody, technicianMode ? 'Save update' : existing ? 'Save changes' : 'Schedule job', async form => {
    const value = Object.fromEntries(form.entries());
    if (technicianMode) {
      const { error } = await supabaseClient.rpc('set_service_job_status', { job_id: existing.id, next_status: value.status, job_notes: value.notes || null });
      if (error) throw error;
      Object.assign(existing, { status: value.status, notes: value.notes });
    } else {
      const next = { ...item, ...value, id: existing?.id || `SR-${crypto.randomUUID().slice(0, 8).toUpperCase()}` };
      await save('jobs', [next]);
      if (existing) Object.assign(existing, next); else data.jobs.unshift(next);
    }
    closeModal(); render(); toast(technicianMode ? 'Service update saved' : existing ? 'Service job updated' : 'Service job scheduled');
  });
}
function openAccountForm(existing) {
  if (profile.role !== 'owner') { toast('Only the organization owner can manage accounts'); return; }
  const item = existing || {};
  const roles = existing ? ['Technician', 'Shop', 'Customer', 'Owner'] : ['Technician', 'Shop', 'Customer'];
  showModal(existing ? 'Edit account' : 'Invite account', 'Supabase sends a secure sign-in invitation to the email address.', `<div class="form-grid"><div class="field"><label for="name">Name / business *</label><input id="name" name="name" required value="${esc(item.name || '')}"></div><div class="field"><label for="username">Login email *</label><input id="username" name="username" type="email" required value="${esc(item.username || '')}" ${existing ? 'readonly' : ''}></div><div class="field"><label for="role">Access role</label><select id="role" name="role">${roles.map(role => `<option ${item.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select></div><div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" type="tel" value="${esc(item.phone || '')}"></div><div class="field full"><label for="address">Shop / business address</label><input id="address" name="address" value="${esc(item.address || '')}"></div><div class="field"><label for="gstin">GSTIN</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="linked">Linked customer record ID</label><select id="linked" name="linked"><option value="">Not linked</option>${data.customers.map(customerItem => `<option value="${esc(customerItem.id)}" ${item.linked === customerItem.id ? 'selected' : ''}>${esc(customerItem.name)} · ${esc(customerItem.id)}</option>`).join('')}</select></div><div class="field"><label for="status">Account status</label><select id="status" name="status"><option ${item.status !== 'Inactive' ? 'selected' : ''}>Active</option><option ${item.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select></div></div><p style="margin:13px 0 0;color:#63776c;font-size:11px">Users set their own password through Supabase’s email invitation. Passwords are never stored here.</p>`, existing ? 'Save changes' : 'Send invitation', async form => {
    const value = Object.fromEntries(form.entries());
    if (existing) {
      const { error } = await supabaseClient.from('profiles').update({
        full_name: value.name.trim(),
        phone: value.phone.trim(),
        role: value.role.toLowerCase(),
        business_name: value.role === 'Shop' ? value.name.trim() : '',
        business_address: value.address.trim(),
        gstin: value.gstin.trim(),
        customer_id: value.role === 'Customer' ? value.linked || null : null,
        active: value.status === 'Active'
      }).eq('user_id', existing.id).eq('organization_id', profile.organization_id);
      if (error) throw error;
    } else {
      await inviteMember(supabaseClient, { ...value, email: value.username });
    }
    data = await loadWorkspace(supabaseClient, profile);
    closeModal(); render(); toast(existing ? 'Account updated' : 'Invitation sent');
  });
}
function openFeedbackForm() {
  showModal('Submit feedback', 'Tell us about your experience or something that needs attention', `<div class="form-grid"><div class="field"><label for="type">What would you like to share? *</label><select id="type" name="type" required><option>Customer feedback</option><option>Issue</option><option>Bug</option><option>Feature request</option></select></div><div class="field"><label for="priority">Priority</label><select id="priority" name="priority"><option>Normal</option><option>High</option><option>Urgent</option></select></div><div class="field"><label for="name">Your name</label><input id="name" name="name" value="${esc(profile.full_name)}" readonly></div><div class="field"><label for="phone">Phone number</label><input id="phone" name="phone" value="${esc(profile.phone)}" readonly></div><div class="field"><label for="email">Account email</label><input id="email" name="email" value="${esc(profile.login_email)}" readonly></div><div class="field"><label for="reference">Product, job or invoice reference</label><input id="reference" name="reference" placeholder="Optional"></div><div class="field full"><label for="title">Subject *</label><input id="title" name="title" required maxlength="100"></div><div class="field full"><label for="description">Details *</label><textarea id="description" name="description" required maxlength="2000"></textarea></div></div>`, 'Send feedback', async form => {
    const values = Object.fromEntries(form.entries());
    const entry = { ...values, customerId: profile.customer_id || '', id: `FB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), status: 'New' };
    await save('feedback', [entry]);
    data.feedback.unshift(entry);
    closeModal(); render(); toast('Feedback submitted');
  }, true);
}
function openMoreMenu() {
  const tools = [
    ['catalog', 'Product catalogue', icons.product],
    ['accounts', 'Accounts & access', icons.person],
    ['feedback', 'Feedback & issues', icons.service]
  ].filter(([target]) => ({ owner: ['catalog', 'accounts', 'feedback'], technician: ['catalog', 'feedback'], shop: ['catalog', 'feedback'], customer: ['catalog', 'feedback'] }[profile.role] || []).includes(target));
  const body = `<div class="quick-grid">${tools.map(([target, label, icon]) => `<button class="quick-action" type="button" data-nav="${target}">${icon}<span>${label}</span></button>`).join('')}<button class="quick-action" type="button" data-action="my-account">${icons.person}<span>My account</span></button></div>`;
  showModal('More tools', 'Products, team access, and customer feedback', body, 'Done', closeModal);
}
// The seller details printed on quotations and GST invoices.
function openBusinessForm() {
  if (profile.role !== 'owner') { toast('Only the owner can change business details'); return; }
  const item = organization || {};
  showModal('Business details', 'Printed as the seller on quotations and GST invoices', `<div class="form-grid"><div class="field full"><label for="name">Business name *</label><input id="name" name="name" required maxlength="160" value="${esc(item.name || '')}"></div><div class="field"><label for="gstin">GSTIN</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="state">State</label><select id="state" name="state">${stateOptions(item.state_code || '')}</select></div><div class="field full"><label for="address">Business address</label><textarea id="address" name="address" maxlength="300">${esc(item.address || '')}</textarea></div><div class="field"><label for="phone">Business phone</label><input id="phone" name="phone" type="tel" value="${esc(item.phone || '')}"></div></div>`, 'Save details', async form => {
    const values = Object.fromEntries(form.entries());
    organization = await updateOrganization(supabaseClient, profile.organization_id, { ...values, state: values.state || stateFromGstin(values.gstin) });
    closeModal(); render(); toast('Business details saved');
  });
}
function openAccountSettings() {
  const businessName = esc(organization?.name || 'your business');
  const consequence = profile.role === 'owner'
    ? `If you are the only owner, this permanently deletes the <strong>${businessName}</strong> workspace: every customer, service job, product, invoice and feedback item, and the login of every technician, shop and customer you invited. This cannot be undone.`
    : `This permanently deletes your login and the feedback you submitted. This cannot be undone. <strong>${businessName}</strong> keeps the records it needs for service history and GST invoices; contact them directly if you want those removed.`;
  showModal('My account', `${profile.login_email} · ${roleLabels[profile.role] || profile.role}`, `<div class="notice"><strong>Delete account.</strong> ${consequence}</div><div class="field"><label for="delete-confirm">Type DELETE to confirm</label><input id="delete-confirm" name="confirm" autocomplete="off" required></div>`, 'Delete account', async form => {
    if (form.get('confirm').trim() !== 'DELETE') throw new Error('Type DELETE to confirm');
    await deleteAccount(supabaseClient);
    closeModal();
    await supabaseClient.auth.signOut({ scope: 'local' });
    renderAuth('sign-in', 'Your account has been deleted.');
  });
  document.querySelector('#active-form [type="submit"]').classList.add('danger');
}
function openProductForm() {
  if (profile.role !== 'owner') { toast('Only the owner can change catalogue items'); return; }
  showModal('Add catalogue item', 'Set customer, technician and shop pricing', `<div class="form-grid"><div class="field"><label for="name">Product name *</label><input id="name" name="name" required></div><div class="field"><label for="category">Category</label><select id="category" name="category"><option>Purifiers</option><option>Accessories</option><option>Spare parts</option></select></div><div class="field full"><label for="description">Description</label><input id="description" name="description"></div><div class="field"><label for="hsn">HSN code</label><input id="hsn" name="hsn" maxlength="8" inputmode="numeric" placeholder="e.g. 8421"></div><div class="field"><label for="customer">Customer price (₹)</label><input id="customer" name="customer" type="number" min="0" required></div><div class="field"><label for="technician">Technician price (₹)</label><input id="technician" name="technician" type="number" min="0" required></div><div class="field"><label for="shop">Shop price (₹)</label><input id="shop" name="shop" type="number" min="0" required></div><div class="field"><label for="stock">Stock quantity</label><input id="stock" name="stock" type="number" min="0" value="0"></div><div class="field"><label for="gst">GST rate (%)</label><input id="gst" name="gst" type="number" min="0" max="100" value="18"></div></div>`, 'Add product', async form => {
    const value = Object.fromEntries(form.entries());
    const item = { ...value, id: `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customer: Number(value.customer), technician: Number(value.technician), shop: Number(value.shop), stock: Number(value.stock), gst: Number(value.gst) };
    await save('products', [item]);
    data.products.push(item);
    closeModal(); render(); toast('Product added to catalogue');
  });
}
function openSaleForm(type = 'Quotation') {
  if (profile.role !== 'owner') { toast('Only the owner can create quotations or invoices'); return; }
  if (!data.customers.length || !data.products.length) { toast('Add a customer and product before creating a document'); return; }
  const options = data.products.map(item => `<option value="${esc(item.id)}" data-price="${price(item)}">${esc(item.name)} · ${money(price(item))}</option>`).join('');
  showModal(`New ${type.toLowerCase()}`, 'Choose a customer, products and GST treatment', `<div class="form-grid"><div class="field"><label for="docType">Document type</label><select id="docType" name="docType"><option ${type === 'Quotation' ? 'selected' : ''}>Quotation</option><option ${type === 'Invoice' ? 'selected' : ''}>Invoice</option></select></div><div class="field"><label for="customerId">Customer *</label><select id="customerId" name="customerId" required>${customerOptions()}</select></div><div class="field"><label for="date">Document date</label><input id="date" name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label for="due">Valid until / due date</label><input id="due" name="due" type="date" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}"></div><div class="field full"><label>Line items</label><div id="line-items"><div class="line-item"><div class="field"><label>Product</label><select name="productId" class="sale-product">${options}</select></div><div class="field"><label>Qty</label><input name="qty" class="sale-qty" type="number" min="1" value="1" required></div><div class="field"><label>Unit price ₹</label><input name="price" class="sale-price" type="number" min="0" value="${price(data.products[0])}" required></div><button class="row-action remove-line" type="button" aria-label="Remove line">${icons.close}</button></div></div><button class="button secondary" id="add-line" type="button">${icons.plus} Add line item</button></div><div class="field full"><label class="price-toggle"><input type="checkbox" name="gst" id="gst-check" checked> Apply GST at each product’s rate</label></div><div class="field full"><div class="invoice-total" id="sale-total"></div></div></div>`, 'Save document', async (values, form) => {
    const ids = form.querySelectorAll('.sale-product');
    const quantities = form.querySelectorAll('.sale-qty');
    const prices = form.querySelectorAll('.sale-price');
    const items = [...ids].map((select, index) => ({ productId: select.value, qty: Number(quantities[index].value), price: Number(prices[index].value) }));
    if (items.some(item => item.qty < 1 || item.price < 0)) { toast('Check item quantities and prices'); return; }
    const document = { type: values.get('docType'), customerId: values.get('customerId'), date: values.get('date'), due: values.get('due'), items, gst: values.has('gst') };
    await createSalesDocument(supabaseClient, document);
    data = await loadWorkspace(supabaseClient, profile);
    closeModal(); render(); toast(`${document.type} saved`);
  }, true);
  const modal = document.getElementById('modal-root');
  const updateTotal = () => {
    const rows = [...modal.querySelectorAll('.line-item')];
    const subtotal = rows.reduce((sum, row) => sum + Number(row.querySelector('.sale-qty').value || 0) * Number(row.querySelector('.sale-price').value || 0), 0);
    const gst = modal.querySelector('#gst-check').checked ? rows.reduce((sum, row) => { const selected = product(row.querySelector('.sale-product').value); return sum + Number(row.querySelector('.sale-qty').value || 0) * Number(row.querySelector('.sale-price').value || 0) * Number(selected.gst || 18) / 100; }, 0) : 0;
    modal.querySelector('#sale-total').innerHTML = `<div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>GST ${gst ? '(product rates)' : '(not applied)'}</span><strong>${money(gst)}</strong></div><div class="grand"><span>Total</span><strong>${money(subtotal + gst)}</strong></div>`;
  };
  const bindRow = row => {
    row.querySelector('.sale-product').addEventListener('change', event => { row.querySelector('.sale-price').value = price(product(event.target.value)); updateTotal(); });
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateTotal));
    row.querySelector('.remove-line').addEventListener('click', () => { if (modal.querySelectorAll('.line-item').length > 1) { row.remove(); updateTotal(); } });
  };
  bindRow(modal.querySelector('.line-item'));
  modal.querySelector('#gst-check').addEventListener('change', updateTotal);
  modal.querySelector('#add-line').addEventListener('click', () => { const row = document.createElement('div'); row.className = 'line-item'; row.innerHTML = `<div class="field"><label>Product</label><select name="productId" class="sale-product">${options}</select></div><div class="field"><label>Qty</label><input name="qty" class="sale-qty" type="number" min="1" value="1" required></div><div class="field"><label>Unit price ₹</label><input name="price" class="sale-price" type="number" min="0" value="${price(data.products[0])}" required></div><button class="row-action remove-line" type="button" aria-label="Remove line">${icons.close}</button>`; modal.querySelector('#line-items').append(row); bindRow(row); updateTotal(); });
  updateTotal();
}
function printDocument(id) {
  const doc = data.documents.find(item => item.id === id);
  if (!doc) return;
  const person = customer(doc.customerId);
  // Documents issued before seller/buyer snapshots existed fall back to the current details.
  const seller = doc.seller?.name ? doc.seller : { name: organization?.name || '', gstin: organization?.gstin || '', address: organization?.address || '', state: organization?.state_code || '', phone: organization?.phone || '' };
  const buyer = doc.buyer?.name ? doc.buyer : { name: person.name, gstin: person.gstin || '', address: person.address, state: person.state || '' };
  const sellerState = seller.state || stateFromGstin(seller.gstin);
  const buyerState = buyer.state || stateFromGstin(buyer.gstin);
  const tax = taxBreakup(doc.items.map(item => ({ ...item, name: item.name || product(item.productId).name, hsn: item.hsn ?? product(item.productId).hsn ?? '' })), { gstEnabled: doc.gst, sellerState, buyerState });
  const title = doc.type === 'Quotation' ? 'Quotation' : doc.gst && seller.gstin ? 'Tax Invoice' : 'Invoice';
  const taxHead = tax.interState ? '<th>IGST</th>' : '<th>CGST</th><th>SGST</th>';
  const rows = tax.rows.map((row, index) => `<tr><td>${index + 1}</td><td>${esc(row.name)}</td><td>${esc(row.hsn || '—')}</td><td class="n">${row.qty}</td><td class="n">${money(row.price)}</td><td class="n">${money(row.taxable)}</td><td class="n">${row.rate}%</td>${tax.interState ? `<td class="n">${money(row.igst)}</td>` : `<td class="n">${money(row.cgst)}</td><td class="n">${money(row.sgst)}</td>`}<td class="n">${money(row.total)}</td></tr>`).join('');
  const taxTotals = tax.interState
    ? `<p><span>IGST</span><strong>${money(tax.igst)}</strong></p>`
    : `<p><span>CGST</span><strong>${money(tax.cgst)}</strong></p><p><span>SGST</span><strong>${money(tax.sgst)}</strong></p>`;
  const party = (label, details, state) => `<div class="party"><small>${label}</small><strong>${esc(details.name)}</strong>${details.address ? `<span>${esc(details.address)}</span>` : ''}${details.phone ? `<span>Phone: ${esc(details.phone)}</span>` : ''}${details.gstin ? `<span>GSTIN: ${esc(details.gstin)}</span>` : ''}${state ? `<span>State: ${esc(stateLabel(state))}</span>` : ''}</div>`;
  const print = window.open('', '_blank', 'width=900,height=800');
  if (!print) { toast('Allow pop-ups to print this document'); return; }
  print.document.write(`<!doctype html><html><head><title>${esc(doc.id)}</title><style>body{font:13px Arial,sans-serif;color:#24342d;padding:40px}h1{margin:0;font-size:22px}.head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #197c70;padding-bottom:16px}.meta{text-align:right}.meta span{display:block}.parties{display:flex;gap:24px;margin:20px 0}.party{flex:1}.party small{display:block;color:#68756e;text-transform:uppercase;font-size:10px;letter-spacing:.06em;margin-bottom:4px}.party strong,.party span{display:block}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:8px;border-bottom:1px solid #ddd;font-size:12px}th{background:#f4f7f4}.n{text-align:right}.total{width:300px;margin:20px 0 0 auto}.total p{display:flex;justify-content:space-between;margin:6px 0}.grand{border-top:1px solid #aaa;padding-top:10px;font-size:16px;font-weight:bold}.foot{display:flex;justify-content:space-between;margin-top:60px;color:#77827c;font-size:11px}.sign{text-align:right;color:#24342d}</style></head><body>
<div class="head"><div><h1>${esc(seller.name)}</h1></div><div class="meta"><h1>${title}</h1><span>${esc(doc.id)}</span><span>Date: ${date(doc.date)}</span><span>${doc.type === 'Quotation' ? 'Valid until' : 'Due date'}: ${date(doc.due)}</span></div></div>
<div class="parties">${party('From', seller, sellerState)}${party(doc.type === 'Quotation' ? 'Quotation for' : 'Bill to', buyer, buyerState)}</div>
${doc.gst ? `<p>Place of supply: <strong>${esc(stateLabel(tax.placeOfSupply) || 'Not specified')}</strong> · Reverse charge: No</p>` : '<p>GST not applied to this document.</p>'}
<table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Taxable value</th><th class="n">GST</th>${taxHead.replace(/<th>/g, '<th class="n">')}<th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total"><p><span>Taxable value</span><strong>${money(tax.taxable)}</strong></p>${doc.gst ? taxTotals : ''}<p class="grand"><span>Total</span><strong>${money(tax.total)}</strong></p></div>
<div class="foot"><span>This is a computer-generated document.</span><span class="sign">For ${esc(seller.name)}<br><br><br>Authorised signatory</span></div>
</body></html>`);
  print.document.close();
  print.focus();
  print.print();
}
document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.getElementById('role-select').value = roleView;
document.getElementById('role-select').addEventListener('change', event => {
  if (profile?.role !== 'owner') { event.target.value = profile?.role || 'customer'; return; }
  roleView = event.target.value;
  localStorage.setItem('clearflow-role', roleView);
  render();
});
document.getElementById('signout-button').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) toast(error.message);
});
document.getElementById('help-button').addEventListener('click', () => toast('Use Accounts & access to manage role and price access.'));
document.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-customer') openCustomerForm();
  if (action === 'new-job') openJobForm();
  if (action === 'new-sale') openSaleForm();
  if (action === 'new-product') openProductForm();
  if (action === 'new-account') openAccountForm();
  if (action === 'submit-feedback') openFeedbackForm();
  if (action === 'more-menu') openMoreMenu();
  if (action === 'my-account') openAccountSettings();
  if (action === 'business-details') openBusinessForm();
  const nav = event.target.closest('[data-nav]')?.dataset.nav;
  if (nav) { closeModal(); setView(nav); }
  const customerEdit = event.target.closest('[data-edit-customer]')?.dataset.editCustomer;
  if (customerEdit) openCustomerForm(data.customers.find(item => item.id === customerEdit));
  const jobEdit = event.target.closest('[data-edit-job]')?.dataset.editJob;
  if (jobEdit) openJobForm(data.jobs.find(item => item.id === jobEdit));
  const accountEdit = event.target.closest('[data-edit-account]')?.dataset.editAccount;
  if (accountEdit) openAccountForm(data.accounts.find(item => item.id === accountEdit));
  const printId = event.target.closest('[data-print-doc]')?.dataset.printDoc;
  if (printId) printDocument(printId);
  const sales = event.target.closest('[data-sales-tab]')?.dataset.salesTab;
  if (sales) { salesTab = sales; renderSales(); }
  const catalog = event.target.closest('[data-catalog-tab]')?.dataset.catalogTab;
  if (catalog) { catalogTab = catalog; renderCatalog(); }
});
document.addEventListener('change', async event => {
  const statusSelect = event.target.closest('[data-feedback-status]');
  if (!statusSelect) return;
  const entry = data.feedback.find(item => item.id === statusSelect.dataset.feedbackStatus);
  if (!entry) return;
  if (profile.role !== 'owner') { statusSelect.value = entry.status; return; }
  try {
    await setFeedbackStatus(supabaseClient, entry.id, statusSelect.value);
    entry.status = statusSelect.value;
    toast('Feedback status updated');
  } catch (error) {
    statusSelect.value = entry.status;
    toast(error instanceof Error ? error.message : 'Could not update feedback status');
  }
});
initializeApp();
