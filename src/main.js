import { createClient } from '@supabase/supabase-js';
import { cachedWorkspace, cacheWorkspace, clearCachedWorkspaces, createSalesDocument, deleteAccount, inviteMember, loadAuditLog, loadWorkspace, reportClientError, saveWorkspaceRecords, setFeedbackStatus, setSalesDocumentStatus, signedInElsewhere, startSubscription, updateOrganization } from './supabase-data.js';
import { stateFromGstin, stateOptions, taxBreakup } from './gst.js';
import { documentDetails as sharedDocumentDetails, documentHtml, invoiceRegisterHeader, invoiceRegisterRows } from './documents.js';
import { languages, getLanguage, setLanguage, t, msg } from './i18n.js';
import { version as appVersion } from '../package.json';
import './styles.css';

// Dates on screen follow the chosen language (printed documents stay English).
const dateLocale = `${getLanguage()}-IN`;
document.documentElement.lang = getLanguage();

const icons = {
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="3.5"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>',
  service: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 6 18 2l4 4-4 4M20 8l-8.5 8.5M13 5l6 6M5 8l4-4 4 4-4 4M3 20l5-5 4 4-5 5H3z"/></svg>',
  invoice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21zM8 8h8M8 12h8M8 16h4"/></svg>',
  // The Clearflow logo: a water drop with ripples (matches the app icon).
  brand: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2S6 10.2 6 14a6 6 0 0 0 12 0c0-3.8-6-10.8-6-10.8Z" fill="currentColor"/><path d="M8.6 14c.9-.7 1.8-.7 2.6 0s1.8.7 2.6 0M9.8 16.7c.6-.5 1.2-.5 1.8 0s1.2.5 1.8 0" fill="none" stroke="#197c70" stroke-width="1.2" stroke-linecap="round"/></svg>',
  product: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7.5 12 3l8 4.5-8 4.5zM4 12l8 4.5 8-4.5M4 16.5 12 21l8-4.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  google: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.7z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3v12m-5-5 5 5 5-5M4 19v2h16v-2"/></svg>'
};
const roleLabels = { owner: msg('Owner'), technician: msg('Technician'), shop: msg('Shop'), customer: msg('Customer') };
// Values stored in the database and shown through t(value). Listed here so they are translated.
msg('Owner'); msg('Technician'); msg('Shop'); msg('Customer');
msg('Residential'); msg('Commercial'); msg('Apartment');
msg('Scheduled'); msg('In progress'); msg('Completed'); msg('Cancelled');
msg('Draft'); msg('Sent'); msg('Pending'); msg('Paid');
msg('Invoice'); msg('Quotation');
msg('Purifiers'); msg('Accessories'); msg('Spare parts');
msg('Active'); msg('Inactive');
msg('Customer feedback'); msg('Issue'); msg('Bug'); msg('Feature request');
msg('Normal'); msg('High'); msg('Urgent');
msg('New'); msg('In review'); msg('Planned'); msg('Resolved'); msg('Closed');
msg('Installation'); msg('Filter replacement'); msg('Routine maintenance'); msg('Quarterly maintenance'); msg('Low water flow'); msg('Repair'); msg('Other');
// Price tiers, shown lower-case inside sentences.
msg('customer'); msg('technician'); msg('shop');
const viewTitles = { overview: msg('Overview'), customers: msg('Customers'), jobs: msg('Service jobs'), sales: msg('Sales & invoices'), catalog: msg('Product catalogue'), accounts: msg('Accounts & access'), feedback: msg('Feedback') };
const emptyData = { customers: [], jobs: [], products: [], accounts: [], documents: [], feedback: [] };
const environment = import.meta.env;
const supabaseUrl = environment.VITE_SUPABASE_URL || '';
const supabaseAnonKey = environment.VITE_SUPABASE_ANON_KEY || '';
// The Google Cloud "Web application" OAuth client ID. Without it the Google button is hidden.
const googleWebClientId = environment.VITE_GOOGLE_WEB_CLIENT_ID || '';
const googleSignInFlag = 'clearflow-google-sign-in';
const signedInElsewhereMessage = msg('This account is already signed in on another device. Sign in again and choose OK to sign out the other device, or sign out there first.');
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
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<div class="eyebrow" style="margin-top:24px">${t('Backend setup required')}</div><h1>${t('Connect your business workspace')}</h1><p>${t('Sign-in and shared records are disabled until this app is connected to your Supabase project.')}</p><div class="notice"><strong>${t('Next:')}</strong> ${t('create the database using {schema}, then configure {url} and {key} for your build.', { schema: '<code>supabase/schema.sql</code>', url: '<code>VITE_SUPABASE_URL</code>', key: '<code>VITE_SUPABASE_ANON_KEY</code>' })}</div><p class="auth-footnote">${t('The public anon key is protected by database row-level security. Never add a service-role key to this app.')}</p></section>`;
}
// The language picker on the sign-in screen and in My account. Changing it reloads the app.
function languagePicker(id) {
  return `<label for="${id}">${t('Language')}</label><select id="${id}" data-language-select>${languages.map(language => `<option value="${language.code}" ${language.code === getLanguage() ? 'selected' : ''}>${esc(language.name)}</option>`).join('')}</select>`;
}
function renderAuth(mode = 'sign-in', message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  const creating = mode === 'sign-up';
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>${creating ? t('Create your workspace') : t('Welcome back')}</h1><p>${creating ? t('Set up the owner account for your water business.') : t('Sign in to your water business workspace.')}</p>${message ? `<div class="auth-message" role="status">${esc(message)}</div>` : ''}${googleWebClientId ? `<button class="button secondary google-button" type="button" data-google-sign-in>${icons.google} ${t('Continue with Google')}</button><div class="auth-divider"><span>${t('or use email')}</span></div>` : ''}<form class="auth-form" id="auth-form">${creating ? `<div class="field"><label for="auth-full-name">${t('Your name')}</label><input id="auth-full-name" name="full_name" autocomplete="name" required maxlength="160"></div><div class="field"><label for="auth-phone">${t('Phone number')}</label><input id="auth-phone" name="phone" type="tel" autocomplete="tel" required></div><div class="field"><label for="auth-organization">${t('Business name')}</label><input id="auth-organization" name="organization_name" required maxlength="160"></div><div class="field"><label for="auth-gstin">${t('Business GSTIN (optional)')}</label><input id="auth-gstin" name="gstin" maxlength="15" autocomplete="off"></div>` : ''}<div class="field"><label for="auth-email">${t('Email')}</label><input id="auth-email" name="email" type="email" autocomplete="email" required></div><div class="field"><label for="auth-password">${t('Password')}</label><input id="auth-password" name="password" type="password" autocomplete="${creating ? 'new-password' : 'current-password'}" minlength="8" required></div><button class="button" type="submit">${creating ? t('Create account') : t('Sign in')}</button></form><button class="auth-switch" type="button" data-auth-mode="${creating ? 'sign-in' : 'sign-up'}">${creating ? t('Already have an account? Sign in') : t('New business? Create an account')}</button>${creating ? `<p class="auth-footnote">${t('By creating an account you agree to the {terms} and {privacy}.', { terms: `<a href="./terms.html" target="_blank" rel="noopener">${t('terms of service')}</a>`, privacy: `<a href="./privacy.html" target="_blank" rel="noopener">${t('privacy policy')}</a>` })}</p>` : `<button class="auth-switch" type="button" data-reset-password>${t('Forgot password?')}</button>`}<p class="auth-footnote">${t('Invited technicians, shops, and customers: open the invitation email from your business to set your password, then sign in here.')}</p><div class="field auth-language">${languagePicker('auth-language')}</div></section>`;
  authRoot.querySelector('[data-auth-mode]').addEventListener('click', event => renderAuth(event.currentTarget.dataset.authMode));
  authRoot.querySelector('[data-reset-password]')?.addEventListener('click', () => renderPasswordResetRequest());
  authRoot.querySelector('[data-google-sign-in]')?.addEventListener('click', async event => {
    event.currentTarget.disabled = true;
    try {
      await signInWithGoogle();
    } catch (error) {
      renderAuth(mode, errorMessage(error, t('Google sign-in failed. Try again.')));
    }
  });
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
        else renderAuth('sign-in', t('Check your email to confirm the owner account, then sign in to finish workspace setup.'));
      } else {
        const { data: result, error } = await supabaseClient.auth.signInWithPassword({ email: values.email.trim(), password: values.password });
        if (error) throw error;
        await finishSignIn(result.session);
      }
    } catch (error) {
      renderAuth(mode, errorMessage(error, t('Sign-in failed. Check your details and try again.')));
    }
  });
}
// One device per login: undo a new sign-in while the account is signed in somewhere else.
// The person has just proved who they are, so they may move the login here instead.
async function finishSignIn(session) {
  if (await signedInElsewhere(supabaseClient)) {
    const moved = window.confirm(t('This account is signed in on another device. Sign it out there and continue here?'))
      && !(await supabaseClient.auth.signOut({ scope: 'others' })).error;
    if (!moved) {
      await supabaseClient.auth.signOut({ scope: 'local' });
      renderAuth('sign-in', t(signedInElsewhereMessage));
      return;
    }
  }
  await openAuthenticatedApp(session);
}
// Google sign-in: Supabase redirects to Google and back, and initializeApp() finishes the sign-in.
async function signInWithGoogle() {
  sessionStorage.setItem(googleSignInFlag, '1');
  const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } });
  if (error) { sessionStorage.removeItem(googleSignInFlag); throw error; }
}
// Email links return to the page they were requested from.
function webRedirectOption(name) {
  return { [name]: window.location.origin + window.location.pathname };
}
function authBrand() {
  return `<div class="auth-brand"><div class="brand-mark">${icons.brand}</div><div><div class="brand-name">clearflow</div><div class="brand-caption">${t('WATER SYSTEMS · OPERATIONS')}</div></div></div>`;
}
function renderPasswordResetRequest(message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>${t('Reset your password')}</h1><p>${t("Enter your account email and we'll send you a link to choose a new password.")}</p>${message ? `<div class="auth-message" role="status">${esc(message)}</div>` : ''}<form class="auth-form" id="reset-form"><div class="field"><label for="reset-email">${t('Email')}</label><input id="reset-email" name="email" type="email" autocomplete="email" required></div><button class="button" type="submit">${t('Send reset link')}</button></form><button class="auth-switch" type="button" data-auth-mode="sign-in">${t('Back to sign in')}</button></section>`;
  authRoot.querySelector('[data-auth-mode]').addEventListener('click', () => renderAuth('sign-in'));
  authRoot.querySelector('#reset-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email').trim();
    event.currentTarget.querySelector('[type="submit"]').disabled = true;
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, webRedirectOption('redirectTo'));
    if (error) { renderPasswordResetRequest(error.message); return; }
    renderAuth('sign-in', t('If that email has an account, a password reset link is on its way.'));
  });
}
function renderSetPassword(session, linkType, message = '') {
  appShell.hidden = true;
  authRoot.hidden = false;
  authRoot.className = 'auth-screen';
  const invited = linkType === 'invite';
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>${invited ? t('Set your password') : t('Choose a new password')}</h1><p>${invited ? t("Welcome! Choose a password for {email}. You'll use it to sign in on this and other devices.", { email: `<strong>${esc(session.user.email)}</strong>` }) : t('Choose a new password for {email}.', { email: `<strong>${esc(session.user.email)}</strong>` })}</p>${message ? `<div class="auth-message" role="alert">${esc(message)}</div>` : ''}<form class="auth-form" id="password-form"><div class="field"><label for="new-password">${t('New password')}</label><input id="new-password" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="field"><label for="confirm-password">${t('Confirm password')}</label><input id="confirm-password" name="confirm" type="password" autocomplete="new-password" minlength="8" required></div><button class="button" type="submit">${t('Save password')}</button></form></section>`;
  authRoot.querySelector('#password-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (values.password !== values.confirm) { renderSetPassword(session, linkType, t('The passwords do not match.')); return; }
    event.currentTarget.querySelector('[type="submit"]').disabled = true;
    const { error } = await supabaseClient.auth.updateUser({ password: values.password });
    if (error) { renderSetPassword(session, linkType, error.message); return; }
    // A password reset is the way back in when the other device is lost, so it signs out every
    // other device.
    if (linkType === 'recovery') await supabaseClient.auth.signOut({ scope: 'others' });
    await openAuthenticatedApp(session);
  });
}
function renderOrganizationSetup(message = '') {
  authRoot.hidden = false;
  appShell.hidden = true;
  authRoot.className = 'auth-screen';
  const userMetadata = authSession.user.user_metadata || {};
  authRoot.innerHTML = `<section class="auth-card">${authBrand()}<h1>${t('Finish business setup')}</h1><p>${t('Confirm the legal details for your organization before adding customers or issuing invoices.')}</p>${message ? `<div class="auth-message" role="alert">${esc(message)}</div>` : ''}<form class="auth-form" id="organization-form"><div class="field"><label for="organization-name">${t('Business name')}</label><input id="organization-name" name="name" required maxlength="160" value="${esc(userMetadata.organization_name || '')}"></div><div class="field"><label for="organization-gstin">${t('GSTIN (optional)')}</label><input id="organization-gstin" name="gstin" maxlength="15" value="${esc(userMetadata.gstin || '')}"></div><div class="field"><label for="organization-address">${t('Business address')}</label><input id="organization-address" name="address" maxlength="300"></div><div class="field"><label for="organization-state">${t('State')}</label><select id="organization-state" name="state">${stateOptions(stateFromGstin(userMetadata.gstin))}</select></div><div class="field"><label for="organization-phone">${t('Business phone')}</label><input id="organization-phone" name="phone" type="tel" value="${esc(userMetadata.phone || '')}"></div><button class="button" type="submit">${t('Create workspace')}</button></form></section>`;
  authRoot.querySelector('#organization-form').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    const { data: organizationId, error } = await supabaseClient.rpc('create_organization', { organization_name: values.name.trim(), organization_gstin: values.gstin.trim() || null });
    if (error) { renderOrganizationSetup(error.message); return; }
    try {
      await updateOrganization(supabaseClient, organizationId, { ...values, state: values.state || stateFromGstin(values.gstin) });
    } catch (detailsError) {
      toast(t('Workspace created, but the business details were not saved: {error}', { error: detailsError.message }));
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
    renderAuth('sign-in', t('Profile setup is not ready yet: {error}', { error: profileError.message }));
    return;
  }
  profile = profileData;
  if (!profile.active) { renderAuth('sign-in', t('This account has been disabled. Contact your organization owner.')); return; }
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
    renderAuth('sign-in', errorMessage(error, t('Workspace could not be loaded')));
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
// The price tier an owner previews comes from browser storage and the role picker, so only the
// three real tiers are accepted.
const priceTiers = ['customer', 'technician', 'shop'];
function priceTier(value) { return priceTiers.includes(value) ? value : 'customer'; }
function showWorkspace() {
  roleView = profile.role === 'owner' ? priceTier(localStorage.getItem('clearflow-role')) : profile.role;
  document.getElementById('role-select').value = roleView;
  updateRoleControl();
  document.getElementById('user-name').textContent = profile.full_name || profile.login_email;
  document.getElementById('user-role').textContent = t(roleLabels[profile.role] || profile.role);
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
  const returningFromGoogle = sessionStorage.getItem(googleSignInFlag) === '1';
  sessionStorage.removeItem(googleSignInFlag);
  if (returningFromGoogle && (authLinkError || new URLSearchParams(window.location.search).get('error_description'))) {
    window.history.replaceState(null, '', window.location.pathname);
    renderAuth('sign-in', t('Google sign-in failed: {error}', { error: authLinkError || new URLSearchParams(window.location.search).get('error_description') }));
    return;
  }
  if (returningFromGoogle && sessionData.session) { await finishSignIn(sessionData.session); return; }
  if (authLinkType || authLinkError) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (authLinkError) { renderAuth('sign-in', t('That email link could not be used: {error}. Ask your business owner for a new invitation, or use "Forgot password?".', { error: authLinkError })); return; }
  if (error) { renderAuth('sign-in', error.message); return; }
  if (sessionData.session && (authLinkType === 'invite' || authLinkType === 'recovery')) { renderSetPassword(sessionData.session, authLinkType); return; }
  if (sessionData.session) await openAuthenticatedApp(sessionData.session);
  else renderAuth('sign-in', deleteAccountRequested ? t('Sign in to delete your Clearflow account.') : '');
}
function esc(value = '') { return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
// Whole rupees unless the amount has paise. Printed documents always show paise (see rupees).
function money(value) {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
}
function date(value) { if (!value) return '—'; return new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)); }
function shortDate(value) { if (!value) return '—'; return new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`)); }
function customer(id) { return data.customers.find(item => item.id === id) || { name: t('Unknown customer'), phone: '', address: '' }; }
function product(id) { return data.products.find(item => item.id === id) || { name: t('Removed product'), gst: 18 }; }
function price(productItem, role = roleView) { return productItem[role] ?? productItem.customer ?? 0; }
function initials(name = '') { return name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase(); }
function setView(next) {
  const target = document.querySelector(`.nav-item[data-view="${next}"]`);
  if (!target || target.hidden) return;
  view = next; searchQuery = '';
  document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === next));
  document.getElementById('crumb-title').textContent = t(viewTitles[next]);
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
// Plans: a free trial, then a paid plan bought here on the website. Without one the workspace is
// read-only (the database enforces this too). The Android app (mobile/) shows plan status as plain
// text only, as Google Play's consumption-only rule requires.
const planPrices = { monthly: msg('₹199 / month'), yearly: msg('₹1,999 / year') };
function planStatus() {
  // Older cached workspaces (before plans existed) have no trial date; treat them as active.
  if (!organization?.trial_ends_at) return { active: true };
  const now = Date.now();
  const paidUntil = organization.paid_until ? new Date(organization.paid_until) : null;
  if (paidUntil && paidUntil.getTime() > now) return { active: true, paid: true, until: paidUntil };
  const trialEnds = new Date(organization.trial_ends_at);
  if (trialEnds.getTime() > now) return { active: true, trial: true, until: trialEnds, daysLeft: Math.ceil((trialEnds.getTime() - now) / 86400000) };
  return { active: false };
}
function longDate(value) { return new Intl.DateTimeFormat(dateLocale, { day: '2-digit', month: 'short', year: 'numeric' }).format(value); }
function renewalHint() {
  return t('Choose a plan in My account to continue.');
}
const planEndedMessage = msg('This business’s plan has ended. You can still view and export records.');
// True (and explains why) when the plan has ended, so a form or action should not open.
function planBlocked() {
  if (planStatus().active) return false;
  toast(t(planEndedMessage));
  return true;
}
function planNotice() {
  const plan = planStatus();
  if (!plan.active) {
    const action = profile?.role === 'owner' ? renewalHint() : t('Ask the business owner to renew it.');
    return `<div class="notice plan-notice" role="status"><strong>${t('Plan ended.')}</strong> ${esc(t(planEndedMessage))} ${esc(action)}</div>`;
  }
  if (plan.trial && profile?.role === 'owner' && plan.daysLeft <= 3) {
    return `<div class="notice plan-notice" role="status"><strong>${esc(t('Free trial ends on {date}.', { date: longDate(plan.until) }))}</strong> ${esc(renewalHint())}</div>`;
  }
  return '';
}
function planSection() {
  if (profile.role !== 'owner') return '';
  const plan = planStatus();
  const status = plan.paid ? t('Active until {date} (renews automatically).', { date: longDate(plan.until) })
    : plan.trial ? t('Free trial until {date}.', { date: longDate(plan.until) })
      : t('Ended. The workspace is read-only.');
  const buy = !plan.paid
    ? `<span class="plan-buttons">${Object.entries(planPrices).map(([interval, label]) => `<button class="button secondary" type="button" data-action="buy-plan" data-interval="${interval}">${esc(t('Pay {price}', { price: t(label) }))}</button>`).join('')}</span>`
    : !plan.paid ? esc(renewalHint()) : '';
  return `<div class="notice"><strong>${t('Plan.')}</strong> ${esc(status)} ${buy}</div>`;
}
async function buyPlan(button) {
  if (offlineSince) return;
  button.disabled = true;
  try {
    window.location.href = await startSubscription(supabaseClient, button.dataset.interval);
  } catch (error) {
    button.disabled = false;
    toast(errorMessage(error, t('The payment could not be started. Try again.')));
  }
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
  const notice = planNotice();
  if (notice) page.insertAdjacentHTML('afterbegin', notice);
  if (offlineSince) page.insertAdjacentHTML('afterbegin', `<div class="notice offline-notice" role="status"><strong>${t('Offline.')}</strong> ${esc(t('Showing data last synced {time}. Changes can be made once you are back online.', { time: new Date(offlineSince).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }) }))}</div>`);
}
window.addEventListener('online', () => { if (offlineSince && authSession) openAuthenticatedApp(authSession); });
async function save(collection, records) {
  if (!supabaseClient || !profile) throw new Error(t('Sign in before saving workspace data'));
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
  const currentMonthLabel = new Intl.DateTimeFormat(getLanguage(), { month: 'long' }).format(currentDate);
  const monthDocs = data.documents.filter(doc => doc.type === 'Invoice' && doc.status !== 'Cancelled' && doc.date.startsWith(month));
  const monthTotal = monthDocs.reduce((sum, doc) => sum + totals(doc).grand, 0);
  const upcoming = [...data.jobs].filter(job => job.status !== 'Completed').sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const monthlySales = Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 11 + index, 1);
    const key = new Intl.DateTimeFormat('sv-SE', { year: 'numeric', month: '2-digit' }).format(monthDate);
    const label = new Intl.DateTimeFormat(getLanguage(), { month: 'short' }).format(monthDate);
    const total = data.documents.filter(doc => doc.type === 'Invoice' && doc.status !== 'Cancelled' && doc.date.startsWith(key)).reduce((sum, doc) => sum + totals(doc).grand, 0);
    return { label, total };
  });
  const chartMaximum = Math.max(1, ...monthlySales.map(item => item.total));
  const needsSetup = data.customers.length === 0 && data.products.length === 0;
  const owner = profile.role === 'owner';
  const setupPanel = owner && needsSetup ? `<section class="setup-panel"><div class="setup-copy"><div class="eyebrow">${t('First steps')}</div><h2>${t('Set up your RO workspace')}</h2><p>${t('Add your first customer and catalogue item to start managing service and sales.')}</p></div><div class="setup-actions"><button class="button" data-action="new-customer">${icons.plus} ${t('Add customer')}</button><button class="button secondary" data-action="new-product">${icons.product} ${t('Add product')}</button></div></section>` : '';
  const quickActions = owner
    ? `<button class="quick-action" data-action="new-customer">${icons.person}<span>${t('Add customer')}</span></button><button class="quick-action" data-action="new-job">${icons.service}<span>${t('Schedule service')}</span></button><button class="quick-action" data-action="new-sale">${icons.invoice}<span>${t('New quotation')}</span></button><button class="quick-action" data-nav="catalog">${icons.product}<span>${t('View catalogue')}</span></button>`
    : profile.role === 'technician'
      ? `<button class="quick-action" data-nav="jobs">${icons.service}<span>${t('Assigned jobs')}</span></button><button class="quick-action" data-nav="catalog">${icons.product}<span>${t('Parts pricing')}</span></button><button class="quick-action" data-nav="feedback">${icons.invoice}<span>${t('Report an issue')}</span></button>`
      : profile.role === 'shop'
        ? `<button class="quick-action" data-nav="catalog">${icons.product}<span>${t('Shop catalogue')}</span></button><button class="quick-action" data-nav="feedback">${icons.invoice}<span>${t('Contact support')}</span></button>`
        : `<button class="quick-action" data-nav="jobs">${icons.service}<span>${t('My service')}</span></button><button class="quick-action" data-nav="sales">${icons.invoice}<span>${t('My documents')}</span></button><button class="quick-action" data-nav="feedback">${icons.person}<span>${t('Send feedback')}</span></button>`;
        const canViewStock = owner || profile.role === 'technician';
        const productRows = data.products.slice(0, 4).map(item => `<div class="job-row"><div class="job-symbol">${icons.product}</div><div class="job-copy"><strong>${esc(item.name)}</strong><span>${esc(t(item.category))}${canViewStock ? ` · ${esc(t('{count} in stock', { count: item.stock }))}` : ''}</span></div>${canViewStock ? `<span class="status ${item.stock < 5 ? 'scheduled' : ''}">${item.stock < 5 ? t('Low stock') : t('In stock')}</span>` : ''}</div>`).join('') || `<div class="empty">${t('Add products to start tracking stock.')}</div>`;
  const jobRows = upcoming.length ? upcoming.map(job => {
    const person = customer(job.customerId);
    const statusClass = job.status.toLowerCase().replace(/\s+/g, '-');
    return `<div class="job-row"><div class="job-symbol">${icons.service}</div><div class="job-copy"><strong>${esc(person.name)}</strong><span>${esc(t(job.type))} · ${shortDate(job.date)} · ${esc(job.technician || t('Unassigned'))}</span></div><span class="status ${statusClass}">${esc(t(job.status))}</span></div>`;
  }).join('') : `<div class="empty">${t('No upcoming service jobs.')}</div>`;
  const activity = data.documents.slice(0, 3).map(doc => {
    const values = { id: `<strong>${esc(doc.id)}</strong>`, name: esc(customer(doc.customerId).name) };
    return `<div class="feed-line"><span class="feed-dot"></span><div class="feed-text">${doc.type === 'Invoice' ? t('{id} invoice for {name}', values) : t('{id} quotation for {name}', values)}<span class="feed-time">${shortDate(doc.date)} · ${money(totals(doc).grand)}</span></div></div>`;
  }).join('');
  page.innerHTML = `${pageHead(new Intl.DateTimeFormat(getLanguage(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(currentDate), esc(t('Good morning, {name}', { name: profile.full_name?.split(/\s+/)[0] || t('there') })), t('Here’s what’s happening across your water business today.'), owner ? `<button class="button" data-action="new-sale">${icons.plus} ${t('Create quotation')}</button>` : '')}
    <div class="metrics">${metric(esc(t('{month} sales', { month: currentMonthLabel })), money(monthTotal), `<b>${t('Invoice total')}</b> · ${t('this month')}`, icons.invoice)}${metric(t('Active customers'), data.customers.length, `<b>${t('Customer records')}</b> · ${t('all locations')}`, icons.person)}${metric(t('Open service jobs'), data.jobs.filter(item => item.status !== 'Completed').length, `<b>${t('Scheduled and in progress')}</b>`, icons.service)}${metric(t('Products in catalogue'), data.products.length, `<b>${t('Purifiers, spares & accessories')}</b>`, icons.product)}</div>${setupPanel}
    <div class="dash-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Sales overview')}</div><div class="panel-note">${t('Invoice value · last 12 months')}</div></div><button class="text-link" data-nav="sales">${t('View sales →')}</button></div><div class="chart-wrap"><div class="chart-summary"><strong>${money(monthTotal)}</strong><span>${esc(currentMonthLabel)}</span></div><div class="chart">${monthlySales.map((item, index) => `<div class="bar-group"><div class="bar ${index === 11 ? 'current' : ''}" style="height:${Math.max(3, Math.round(item.total / chartMaximum * 100))}%" title="${esc(item.label)}: ${money(item.total)}"></div><span class="bar-label">${esc(item.label)}</span></div>`).join('')}</div><div class="chart-legend"><span class="legend-dot"></span>${t('Revenue from invoices')}</div></div></section>
      <section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Upcoming service')}</div><div class="panel-note">${t('Next scheduled visits')}</div></div><button class="text-link" data-nav="jobs">${t('All jobs →')}</button></div><div class="job-list">${jobRows}</div></section></div>
    <div class="lower-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Quick actions')}</div><div class="panel-note">${t('Common tasks, one tap away')}</div></div></div><div class="quick-grid">${quickActions}</div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Recent activity')}</div><div class="panel-note">${t('Latest quotations and invoices')}</div></div>${owner ? `<button class="text-link" data-nav="sales">${t('View all →')}</button>` : ''}</div><div class="feed">${activity || `<div class="empty">${t('No recent sales activity.')}</div>`}</div></section></div>
    ${canViewStock ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><div class="panel-title">${t('Stock watch')}</div><div class="panel-note">${t('Popular parts and current availability')}</div></div><button class="text-link" data-nav="catalog">${t('Full catalogue →')}</button></div><div class="job-list">${productRows}</div></section>` : ''}`;
}
function renderCustomers() {
  const owner = profile.role === 'owner';
  const filtered = data.customers.filter(item => `${item.name} ${item.phone} ${item.address} ${item.id}`.toLowerCase().includes(searchQuery.toLowerCase()));
  page.innerHTML = `${pageHead(t('Customer relationships'), t('Customers'), esc(t('{count} customer records · installation and contact details', { count: data.customers.length })), owner ? `<button class="button" data-action="new-customer">${icons.plus} ${t('Add customer')}</button>` : '')}
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="${esc(t('Search name, phone, address…'))}" value="${esc(searchQuery)}"></div><select class="filter-select" id="customer-type-filter"><option value="All">${t('All customer types')}</option><option value="Residential">${t('Residential')}</option><option value="Commercial">${t('Commercial')}</option><option value="Apartment">${t('Apartment')}</option></select></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${t('Customer')}</th><th>${t('Phone')}</th><th>${t('Customer type')}</th><th>${t('Installed unit')}</th><th>${t('Installation date')}</th><th>${t('Address')}</th>${owner ? '<th></th>' : ''}</tr></thead><tbody>${filtered.length ? filtered.map(item => `<tr><td><div class="person-cell"><span class="mini-avatar">${initials(item.name)}</span><div><strong>${esc(item.name)}</strong><div class="muted-cell">${esc(item.id)} · ${esc(item.email || t('No email'))}</div></div></div></td><td><a class="call-link" href="tel:${esc(item.phone.replace(/\s/g, ''))}">${esc(item.phone)}</a></td><td>${esc(t(item.type))}</td><td>${esc(item.purifier || t('Not recorded'))}</td><td>${date(item.installed)}</td><td>${esc(item.address)}</td>${owner ? `<td><button class="row-action" data-edit-customer="${esc(item.id)}" aria-label="${esc(t('Edit {name}', { name: item.name }))}" title="${esc(t('Edit customer'))}">✎</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${owner ? 7 : 6}" class="empty">${t('No matching customers.')}</td></tr>`}</tbody></table></div></section>`;
  bindSearch();
  document.getElementById('customer-type-filter').addEventListener('change', event => {
    const selected = event.target.value;
    page.querySelectorAll('tbody tr').forEach(row => { row.hidden = selected !== 'All' && row.children[2]?.textContent !== t(selected); });
  });
}
function renderJobs() {
  const owner = profile.role === 'owner';
  const technician = profile.role === 'technician';
  const filtered = data.jobs.filter(item => `${item.id} ${item.type} ${t(item.type)} ${item.technician} ${customer(item.customerId).name} ${item.status} ${t(item.status)}`.toLowerCase().includes(searchQuery.toLowerCase()));
  page.innerHTML = `${pageHead(t('Installations & aftercare'), t('Service jobs'), esc(t('{count} job records · {open} still open', { count: data.jobs.length, open: data.jobs.filter(item => item.status !== 'Completed').length })), owner ? `<button class="button" data-action="new-job">${icons.plus} ${t('Schedule service')}</button>` : '')}
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="${esc(t('Search customer, job or technician…'))}" value="${esc(searchQuery)}"></div><select class="filter-select" id="job-status-filter"><option value="All">${t('All statuses')}</option><option value="Scheduled">${t('Scheduled')}</option><option value="In progress">${t('In progress')}</option><option value="Completed">${t('Completed')}</option></select></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${t('Job ID')}</th><th>${t('Customer')}</th><th>${t('Contact')}</th><th>${t('Service type')}</th><th>${t('Visit date')}</th><th>${t('Technician')}</th><th>${t('Status')}</th>${owner || technician ? '<th></th>' : ''}</tr></thead><tbody>${filtered.length ? filtered.map(item => `<tr><td><strong>${esc(item.id)}</strong></td><td class="job-customer">${esc(customer(item.customerId).name)}</td><td><a class="call-link" href="tel:${esc(customer(item.customerId).phone.replace(/\s/g, ''))}">${esc(customer(item.customerId).phone)}</a></td><td>${esc(t(item.type))}</td><td>${date(item.date)}</td><td>${esc(item.technician || t('Unassigned'))}</td><td><span class="status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${esc(t(item.status))}</span></td>${owner || technician ? `<td><button class="row-action" data-edit-job="${esc(item.id)}" aria-label="${esc(technician ? t('Update job {id}', { id: item.id }) : t('Edit job {id}', { id: item.id }))}" title="${esc(technician ? t('Update job') : t('Edit job'))}">✎</button></td>` : ''}</tr>`).join('') : `<tr><td colspan="${owner || technician ? 8 : 7}" class="empty">${t('No matching service jobs.')}</td></tr>`}</tbody></table></div></section>`;
  bindSearch();
  document.getElementById('job-status-filter').addEventListener('change', event => {
    const selected = event.target.value;
    page.querySelectorAll('tbody tr').forEach(row => { row.hidden = selected !== 'All' && row.children[6]?.textContent.trim() !== t(selected); });
  });
}
function totals(doc) {
  const bill = taxBreakup(doc.items, { gstEnabled: doc.gst });
  return { subtotal: bill.taxable, gst: Math.round((bill.total - bill.taxable) * 100) / 100, grand: bill.total };
}
const documentStatuses = { Invoice: ['Pending', 'Paid', 'Cancelled'], Quotation: ['Draft', 'Sent', 'Cancelled'] };
function documentStatus(doc, owner) {
  if (!owner || doc.status === 'Cancelled') return `<span class="status ${doc.status.toLowerCase()}">${esc(t(doc.status))}</span>`;
  return `<select class="filter-select" data-doc-status="${esc(doc.id)}" aria-label="${esc(t('Update status for {id}', { id: doc.id }))}">${documentStatuses[doc.type].map(status => `<option value="${status}" ${doc.status === status ? 'selected' : ''}>${t(status)}</option>`).join('')}</select>`;
}
function renderSales() {
  const owner = profile.role === 'owner';
  // Tab values are kept in English (salesTab); only their labels are translated.
  const tabs = [msg('All documents'), msg('Quotations'), msg('Invoices')];
  let docs = [...data.documents].sort((a, b) => b.date.localeCompare(a.date));
  if (salesTab === 'Quotations') docs = docs.filter(doc => doc.type === 'Quotation');
  if (salesTab === 'Invoices') docs = docs.filter(doc => doc.type === 'Invoice');
  page.innerHTML = `${pageHead(t('Quotes, billing & tax'), t('Sales & invoices'), t('Prepare quotations and invoices with GST or as non-GST documents.'), owner ? `<div class="head-actions"><button class="button secondary" data-action="export-invoices">${t('Export invoices')}</button><button class="button" data-action="new-sale">${icons.plus} ${t('New document')}</button></div>` : '')}
    <div class="notice"><strong>${t('Tax options:')}</strong> ${t('choose GST-inclusive billing (product tax rates apply) or a non-GST document when creating a quotation or invoice.')}</div>
    <section class="panel table-panel"><div class="tabs">${tabs.map(tab => `<button class="tab ${salesTab === tab ? 'active' : ''}" data-sales-tab="${tab}">${t(tab)}</button>`).join('')}</div><div class="table-scroll"><table><thead><tr><th>${t('Document')}</th><th>${t('Customer')}</th><th>${t('Date')}</th><th>${t('Due date')}</th><th>${t('Tax')}</th><th>${t('Amount')}</th><th>${t('Status')}</th><th></th></tr></thead><tbody>${docs.length ? docs.map(doc => `<tr><td><strong>${esc(doc.id)}</strong><div class="muted-cell">${esc(t(doc.type))}</div></td><td>${esc(customer(doc.customerId).name)}</td><td>${date(doc.date)}</td><td>${date(doc.due)}</td><td>${doc.gst ? t('GST') : t('No GST')}</td><td><strong>${money(totals(doc).grand)}</strong></td><td>${documentStatus(doc, owner)}</td><td><button class="row-action" data-print-doc="${esc(doc.id)}" aria-label="${esc(t('Print {id}', { id: doc.id }))}" title="${esc(t('Print document'))}">${icons.download}</button></td></tr>`).join('') : `<tr><td colspan="8" class="empty">${t('No documents in this view yet.')}</td></tr>`}</tbody></table></div></section>`;
}
function renderCatalog() {
  const owner = profile.role === 'owner';
  // Tab values are product categories stored in English (catalogTab); only their labels are translated.
  const tabs = [msg('All products'), msg('Purifiers'), msg('Accessories'), msg('Spare parts')];
  const products = data.products.filter(item => catalogTab === 'All products' || item.category === catalogTab);
  const tier = esc(t(roleView));
  page.innerHTML = `${pageHead(t('Products & pricing'), t('Product catalogue'), t('Purifiers, accessories and spares · prices shown for {tier} access', { tier }), owner ? `<button class="button" data-action="new-product">${icons.plus} ${t('Add product')}</button>` : '')}
    <div class="notice">${owner ? t('Previewing {tier} pricing. Each signed-in role can only retrieve its own price tier.', { tier: `<strong>${tier}</strong>` }) : t('Showing the {tier} prices assigned to your account.', { tier: `<strong>${tier}</strong>` })}</div>
    <section class="panel" style="margin-bottom:15px"><div class="tabs">${tabs.map(tab => `<button class="tab ${catalogTab === tab ? 'active' : ''}" data-catalog-tab="${tab}">${t(tab)}</button>`).join('')}</div></section>
    <div class="product-grid">${products.length ? products.map((item, index) => `<article class="product"><div class="product-top"><div class="product-art ${index % 3 === 1 ? 'blue' : index % 3 === 2 ? 'gold' : ''}">${item.category === 'Purifiers' ? icons.product : item.category === 'Accessories' ? icons.service : icons.invoice}</div><span class="category">${esc(t(item.category))}</span></div><div class="product-info"><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><div class="product-price"><div><span>${t('{tier} price', { tier })}</span><strong>${money(price(item))}</strong></div>${owner || profile.role === 'technician' ? `<span>${esc(t('{count} in stock', { count: item.stock }))}</span>` : ''}</div>${owner ? `<div class="price-other"><span>${t('Customer')} <b>${money(item.customer)}</b></span><span>${t('Tech')} <b>${money(item.technician)}</b></span><span>${t('Shop')} <b>${money(item.shop)}</b></span></div>` : ''}</div></article>`).join('') : `<div class="empty">${t('No products in this category.')}</div>`}</div>`;
}
function renderAccounts() {
  if (profile.role !== 'owner') { page.innerHTML = `<div class="empty">${t('Only the organization owner can manage accounts.')}</div>`; return; }
  page.innerHTML = `${pageHead(t('People, partners & permissions'), t('Accounts & access'), t('Technician, shop and customer accounts with role-based price access.'), `<div class="head-actions"><button class="button secondary" data-action="business-details">${t('Business details')}</button><button class="button" data-action="new-account">${icons.plus} ${t('Add account')}</button></div>`)}
    <div class="notice"><strong>${t('Access note:')}</strong> ${t('each person signs in with their own email and password, and sees only the records and price tier their role allows.')}</div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${t('Account')}</th><th>${t('Login ID')}</th><th>${t('Access role')}</th><th>${t('Phone')}</th><th>${t('Business address')}</th><th>${t('GSTIN')}</th><th>${t('Linked record')}</th><th>${t('Price list')}</th><th>${t('Status')}</th><th></th></tr></thead><tbody>${data.accounts.map(account => `<tr><td><div class="person-cell"><span class="mini-avatar">${initials(account.name)}</span><strong>${esc(account.name)}</strong></div></td><td>${esc(account.username)}</td><td><span class="role-tag">${esc(t(account.role))}</span></td><td><a class="call-link" href="tel:${esc(account.phone.replace(/\s/g, ''))}">${esc(account.phone)}</a></td><td>${esc(account.address || '—')}</td><td>${esc(account.gstin || '—')}</td><td>${esc(account.linked)}</td><td>${['Technician', 'Shop', 'Customer'].includes(account.role) ? t(account.role) : t('All prices')}</td><td><span class="status">${esc(t(account.status))}</span></td><td><button class="row-action" data-edit-account="${esc(account.id)}" aria-label="${esc(t('Edit {name}', { name: account.name }))}" title="${esc(t('Edit account'))}">✎</button></td></tr>`).join('')}</tbody></table></div></section>
    <div class="lower-grid"><section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Price access')}</div><div class="panel-note">${t('Each account role sees its own price tier')}</div></div></div><div class="job-list"><div class="job-row"><div class="job-symbol">${icons.person}</div><div class="job-copy"><strong>${t('Customer price')}</strong><span>${t('Retail price shown to end customers')}</span></div><span class="role-tag">${t('Retail')}</span></div><div class="job-row"><div class="job-symbol">${icons.service}</div><div class="job-copy"><strong>${t('Technician price')}</strong><span>${t('Service team rate for spares and units')}</span></div><span class="role-tag">${t('Service')}</span></div><div class="job-row"><div class="job-symbol">${icons.product}</div><div class="job-copy"><strong>${t('Shop price')}</strong><span>${t('Partner / reseller wholesale rate')}</span></div><span class="role-tag">${t('Wholesale')}</span></div></div></section><section class="panel"><div class="panel-head"><div><div class="panel-title">${t('Login details')}</div><div class="panel-note">${t('Account usernames are listed above')}</div></div></div><div class="feed"><div class="feed-line"><span class="feed-dot"></span><div class="feed-text">${t('Passwords are never shown here.')}<span class="feed-time">${t('Invited people choose their own password from the email link, and can reset it from the sign-in screen.')}</span></div></div><div class="feed-line"><span class="feed-dot"></span><div class="feed-text">${t('Technician and shop accounts can be linked to their contact or business records.')}<span class="feed-time">${t('Account records are editable.')}</span></div></div></div></section></div>`;
  page.insertAdjacentHTML('beforeend', renderAuditLog());
}
const auditTableLabels = { customers: msg('Customer'), products: msg('Product'), product_prices: msg('Price'), service_jobs: msg('Service job'), sales_documents: msg('Sales document'), profiles: msg('Team account'), organizations: msg('Business details') };
// One sentence per action, so each language can order the words its own way.
const auditSentences = { insert: msg('{table} {record} added by {person}'), update: msg('{table} {record} changed by {person}'), delete: msg('{table} {record} deleted by {person}') };
function renderAuditLog() {
  const names = new Map(data.accounts.map(account => [account.id, account.name || account.username]));
  const rows = auditLog.map(entry => {
    const values = { table: esc(t(auditTableLabels[entry.table_name] || entry.table_name)), record: `<strong>${esc(entry.record_id)}</strong>`, person: esc(names.get(entry.changed_by) || (entry.changed_by ? t('a removed account') : t('the system'))), action: esc(entry.action) };
    const sentence = auditSentences[entry.action] ? t(auditSentences[entry.action], values) : t('{table} {record} {action} by {person}', values);
    return `<div class="feed-line"><span class="feed-dot"></span><div class="feed-text">${sentence}<span class="feed-time">${esc(new Date(entry.changed_at).toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' }))}</span></div></div>`;
  }).join('');
  return `<section class="panel" style="margin-top:16px"><div class="panel-head"><div><div class="panel-title">${t('Activity log')}</div><div class="panel-note">${t('Last 50 changes to customers, products, prices, jobs, invoices and team accounts')}</div></div></div><div class="feed">${rows || `<div class="empty">${t('No changes recorded yet.')}</div>`}</div></section>`;
}
function renderFeedback() {
  const owner = profile.role === 'owner';
  const entries = [...data.feedback].filter(item => `${item.id} ${item.type} ${item.title} ${item.description} ${item.name} ${item.phone}`.toLowerCase().includes(searchQuery.toLowerCase())).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const statuses = ['New', 'In review', 'In progress', 'Planned', 'Resolved', 'Closed'];
  page.innerHTML = `${pageHead(t('Customer support'), t('Feedback & issues'), t('Customer feedback, reported problems, and product ideas.'), `<button class="button" data-action="submit-feedback">${icons.plus} ${t('Submit feedback')}</button>`)}
    <div class="notice"><strong>${t('Support:')}</strong> ${t('reports are linked to your signed-in account and visible according to your organization role.')}</div>
    <div class="toolbar"><div class="search">${icons.search}<input data-search placeholder="${esc(t('Search reports, customers or reference…'))}" value="${esc(searchQuery)}"></div><span class="role-tag">${esc(t('{count} submitted', { count: data.feedback.length }))}</span></div>
    <section class="panel table-panel"><div class="table-scroll"><table><thead><tr><th>${t('Report')}</th><th>${t('Category')}</th><th>${t('Customer')}</th><th>${t('Priority')}</th><th>${t('Submitted')}</th><th>${t('Status')}</th></tr></thead><tbody>${entries.length ? entries.map(item => `<tr><td><strong>${esc(item.title)}</strong><div class="muted-cell">${esc(item.id)} · ${esc(item.description)}</div>${item.reference ? `<div class="muted-cell">${esc(t('Ref: {reference}', { reference: item.reference }))}</div>` : ''}</td><td><span class="role-tag">${esc(t(item.type))}</span></td><td><strong>${esc(item.name)}</strong><div class="muted-cell">${esc(item.phone)}${item.email ? ` · ${esc(item.email)}` : ''}</div></td><td><span class="status ${item.priority.toLowerCase()}">${esc(t(item.priority))}</span></td><td>${date(item.date)}</td><td>${owner ? `<select class="filter-select" data-feedback-status="${esc(item.id)}" aria-label="${esc(t('Update status for {id}', { id: item.title }))}">${statuses.map(status => `<option value="${status}" ${item.status === status ? 'selected' : ''}>${t(status)}</option>`).join('')}</select>` : `<span class="status ${item.status.toLowerCase().replace(/\s+/g, '-')}">${esc(t(item.status))}</span>`}</td></tr>`).join('') : `<tr><td colspan="6" class="empty">${t('No feedback reports yet.')}</td></tr>`}</tbody></table></div></section>`;
  bindSearch();
}
function bindSearch() {
  const input = page.querySelector('[data-search]');
  input.addEventListener('input', event => { searchQuery = event.target.value; render(); const next = page.querySelector('[data-search]'); next.focus(); next.setSelectionRange(searchQuery.length, searchQuery.length); });
}
// Supabase returns database errors as plain objects, not Error instances, so read the message
// from whatever was thrown.
function errorMessage(error, fallback) {
  return typeof error?.message === 'string' && error.message ? error.message : fallback;
}
function toast(message) {
  const root = document.getElementById('toast-root');
  root.innerHTML = `<div class="toast">${esc(message)}</div>`;
  window.setTimeout(() => { root.innerHTML = ''; }, 2600);
}
function showModal(title, subtitle, body, submitLabel, onSubmit, wide = false) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay" data-dismiss><section class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><div><h2>${esc(title)}</h2><p>${esc(subtitle)}</p></div><button class="icon-button" data-close aria-label="${esc(t('Close'))}">${icons.close}</button></div><div class="modal-body"><form id="active-form">${body}<div class="modal-actions"><button type="button" class="button secondary" data-close>${t('Cancel')}</button><button type="submit" class="button">${esc(submitLabel)}</button></div></form></div></section></div>`;
  root.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', closeModal));
  root.querySelector('[data-dismiss]').addEventListener('click', event => { if (event.target === event.currentTarget) closeModal(); });
  root.querySelector('#active-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (offlineSince && onSubmit !== closeModal) { toast(t('You are offline. Changes can be saved once you are back online.')); return; }
    const submit = event.currentTarget.querySelector('[type="submit"]');
    submit.disabled = true;
    try { await onSubmit(new FormData(event.currentTarget), event.currentTarget); }
    catch (error) { submit.disabled = false; toast(errorMessage(error, t('Save failed. Try again.'))); }
  });
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
function customerOptions(selected = '') { return data.customers.map(item => `<option value="${esc(item.id)}" ${item.id === selected ? 'selected' : ''}>${esc(item.name)} · ${esc(item.phone)}</option>`).join(''); }
function openCustomerForm(existing) {
  if (profile.role !== 'owner') { toast(t('Only the owner can manage customer records')); return; }
  if (planBlocked()) return;
  const item = existing || {};
  const customerTypes = [msg('Residential'), msg('Commercial'), msg('Apartment')];
  showModal(existing ? t('Edit customer') : t('Add customer'), t('Contact, address and installation details'), `<div class="form-grid"><div class="field"><label for="name">${t('Customer / business name *')}</label><input id="name" name="name" required value="${esc(item.name || '')}"></div><div class="field"><label for="phone">${t('Phone number *')}</label><input id="phone" name="phone" type="tel" required value="${esc(item.phone || '')}"></div><div class="field"><label for="email">${t('Email')}</label><input id="email" name="email" type="email" value="${esc(item.email || '')}"></div><div class="field"><label for="type">${t('Customer type')}</label><select id="type" name="type">${customerTypes.map(type => `<option value="${type}" ${item.type === type ? 'selected' : ''}>${t(type)}</option>`).join('')}</select></div><div class="field full"><label for="address">${t('Full address')}</label><textarea id="address" name="address">${esc(item.address || '')}</textarea></div><div class="field"><label for="gstin">${t('Customer GSTIN (business customers)')}</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="state">${t('State (place of supply)')}</label><select id="state" name="state">${stateOptions(item.state || '')}</select></div><div class="field"><label for="purifier">${t('Purifier / model installed')}</label><input id="purifier" name="purifier" value="${esc(item.purifier || '')}"></div><div class="field"><label for="installed">${t('Installation date')}</label><input id="installed" name="installed" type="date" value="${esc(item.installed || '')}"></div></div>`, existing ? t('Save changes') : t('Add customer'), async form => {
    const value = Object.fromEntries(form.entries());
    const next = { ...item, ...value, id: existing?.id || `C-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, notes: item.notes || '', gstin: value.gstin.trim().toUpperCase(), state: value.state || stateFromGstin(value.gstin) };
    await save('customers', [next]);
    if (existing) Object.assign(existing, next); else data.customers.unshift(next);
    closeModal(); render(); toast(existing ? t('Customer updated') : t('Customer added'));
  });
}
function openJobForm(existing) {
  if (!data.customers.length) { toast(t('Add a customer before scheduling a service job')); return; }
  if (profile.role !== 'owner' && (profile.role !== 'technician' || !existing)) { toast(t('Only an owner can schedule a service job')); return; }
  if (planBlocked()) return;
  const item = existing || {};
  const technicianMode = profile.role === 'technician';
  // Option values stay in English (they are stored); only the labels are translated.
  const option = (value, selected) => `<option value="${value}" ${selected ? 'selected' : ''}>${t(value)}</option>`;
  const jobTypes = [msg('Installation'), msg('Filter replacement'), msg('Routine maintenance'), msg('Quarterly maintenance'), msg('Low water flow'), msg('Repair'), msg('Other')];
  const jobStatuses = [msg('Scheduled'), msg('In progress'), msg('Completed'), msg('Cancelled')];
  const formBody = technicianMode
    ? `<div class="form-grid"><div class="field"><label>${t('Customer')}</label><input value="${esc(customer(item.customerId).name)}" disabled></div><div class="field"><label>${t('Service type')}</label><input value="${esc(t(item.type))}" disabled></div><div class="field full"><label for="status">${t('Update status')}</label><select name="status" id="status">${option('In progress', item.status === 'In progress')}${option('Completed', item.status === 'Completed')}</select></div><div class="field full"><label for="notes">${t('Service notes')}</label><textarea id="notes" name="notes">${esc(item.notes || '')}</textarea></div></div>`
    : `<div class="form-grid"><div class="field full"><label for="customerId">${t('Customer *')}</label><select id="customerId" name="customerId" required>${customerOptions(item.customerId)}</select></div><div class="field"><label for="type">${t('Service type *')}</label><select id="type" name="type" required>${jobTypes.map(type => option(type, item.type === type)).join('')}</select></div><div class="field"><label for="date">${t('Visit date *')}</label><input id="date" name="date" type="date" required value="${esc(item.date || new Date().toISOString().slice(0, 10))}"></div><div class="field"><label for="technician">${t('Technician')}</label><input id="technician" name="technician" list="technician-list" value="${esc(item.technician || '')}"><datalist id="technician-list">${data.accounts.filter(account => account.role === 'Technician').map(account => `<option value="${esc(account.name)}"></option>`).join('')}</datalist></div><div class="field"><label for="status">${t('Status')}</label><select name="status" id="status">${jobStatuses.map(status => option(status, item.status === status)).join('')}</select></div><div class="field full"><label for="notes">${t('Job notes')}</label><textarea id="notes" name="notes">${esc(item.notes || '')}</textarea></div></div>`;
  showModal(technicianMode ? t('Update service job') : existing ? t('Edit service job') : t('Schedule service'), t('Installation, maintenance and repair visits'), formBody, technicianMode ? t('Save update') : existing ? t('Save changes') : t('Schedule job'), async form => {
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
    closeModal(); render(); toast(technicianMode ? t('Service update saved') : existing ? t('Service job updated') : t('Service job scheduled'));
  });
}
function openAccountForm(existing) {
  if (profile.role !== 'owner') { toast(t('Only the organization owner can manage accounts')); return; }
  const item = existing || {};
  const roles = existing ? [msg('Technician'), msg('Shop'), msg('Customer'), msg('Owner')] : [msg('Technician'), msg('Shop'), msg('Customer')];
  showModal(existing ? t('Edit account') : t('Invite account'), t('Supabase sends a secure sign-in invitation to the email address.'), `<div class="form-grid"><div class="field"><label for="name">${t('Name / business *')}</label><input id="name" name="name" required value="${esc(item.name || '')}"></div><div class="field"><label for="username">${t('Login email *')}</label><input id="username" name="username" type="email" required value="${esc(item.username || '')}" ${existing ? 'readonly' : ''}></div><div class="field"><label for="role">${t('Access role')}</label><select id="role" name="role">${roles.map(role => `<option value="${role}" ${item.role === role ? 'selected' : ''}>${t(role)}</option>`).join('')}</select></div><div class="field"><label for="phone">${t('Phone number')}</label><input id="phone" name="phone" type="tel" value="${esc(item.phone || '')}"></div><div class="field full"><label for="address">${t('Shop / business address')}</label><input id="address" name="address" value="${esc(item.address || '')}"></div><div class="field"><label for="gstin">${t('GSTIN')}</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="linked">${t('Linked customer record ID')}</label><select id="linked" name="linked"><option value="">${t('Not linked')}</option>${data.customers.map(customerItem => `<option value="${esc(customerItem.id)}" ${item.linked === customerItem.id ? 'selected' : ''}>${esc(customerItem.name)} · ${esc(customerItem.id)}</option>`).join('')}</select></div><div class="field"><label for="status">${t('Account status')}</label><select id="status" name="status"><option value="Active" ${item.status !== 'Inactive' ? 'selected' : ''}>${t('Active')}</option><option value="Inactive" ${item.status === 'Inactive' ? 'selected' : ''}>${t('Inactive')}</option></select></div></div><p style="margin:13px 0 0;color:#63776c;font-size:11px">${t('Users set their own password through Supabase’s email invitation. Passwords are never stored here.')}</p>`, existing ? t('Save changes') : t('Send invitation'), async form => {
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
    closeModal(); render(); toast(existing ? t('Account updated') : t('Invitation sent'));
  });
}
function openFeedbackForm() {
  const option = value => `<option value="${value}">${t(value)}</option>`;
  showModal(t('Submit feedback'), t('Tell us about your experience or something that needs attention'), `<div class="form-grid"><div class="field"><label for="type">${t('What would you like to share? *')}</label><select id="type" name="type" required>${[msg('Customer feedback'), msg('Issue'), msg('Bug'), msg('Feature request')].map(option).join('')}</select></div><div class="field"><label for="priority">${t('Priority')}</label><select id="priority" name="priority">${[msg('Normal'), msg('High'), msg('Urgent')].map(option).join('')}</select></div><div class="field"><label for="name">${t('Your name')}</label><input id="name" name="name" value="${esc(profile.full_name)}" readonly></div><div class="field"><label for="phone">${t('Phone number')}</label><input id="phone" name="phone" value="${esc(profile.phone)}" readonly></div><div class="field"><label for="email">${t('Account email')}</label><input id="email" name="email" value="${esc(profile.login_email)}" readonly></div><div class="field"><label for="reference">${t('Product, job or invoice reference')}</label><input id="reference" name="reference" placeholder="${esc(t('Optional'))}"></div><div class="field full"><label for="title">${t('Subject *')}</label><input id="title" name="title" required maxlength="100"></div><div class="field full"><label for="description">${t('Details *')}</label><textarea id="description" name="description" required maxlength="2000"></textarea></div></div>`, t('Send feedback'), async form => {
    const values = Object.fromEntries(form.entries());
    const entry = { ...values, customerId: profile.customer_id || '', id: `FB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, date: new Date().toISOString().slice(0, 10), createdAt: new Date().toISOString(), status: 'New' };
    await save('feedback', [entry]);
    data.feedback.unshift(entry);
    closeModal(); render(); toast(t('Feedback submitted'));
  }, true);
}
function openMoreMenu() {
  const tools = [
    ['catalog', t('Product catalogue'), icons.product],
    ['accounts', t('Accounts & access'), icons.person],
    ['feedback', t('Feedback & issues'), icons.service]
  ].filter(([target]) => ({ owner: ['catalog', 'accounts', 'feedback'], technician: ['catalog', 'feedback'], shop: ['catalog', 'feedback'], customer: ['catalog', 'feedback'] }[profile.role] || []).includes(target));
  const body = `<div class="quick-grid">${tools.map(([target, label, icon]) => `<button class="quick-action" type="button" data-nav="${target}">${icon}<span>${label}</span></button>`).join('')}<button class="quick-action" type="button" data-action="my-account">${icons.person}<span>${t('My account')}</span></button></div>`;
  showModal(t('More tools'), t('Products, team access, and customer feedback'), body, t('Done'), closeModal);
}
// The seller details printed on quotations and GST invoices.
function openBusinessForm() {
  if (profile.role !== 'owner') { toast(t('Only the owner can change business details')); return; }
  const item = organization || {};
  showModal(t('Business details'), t('Printed as the seller on quotations and GST invoices'), `<div class="form-grid"><div class="field full"><label for="name">${t('Business name *')}</label><input id="name" name="name" required maxlength="160" value="${esc(item.name || '')}"></div><div class="field"><label for="gstin">${t('GSTIN')}</label><input id="gstin" name="gstin" maxlength="15" value="${esc(item.gstin || '')}"></div><div class="field"><label for="state">${t('State')}</label><select id="state" name="state">${stateOptions(item.state_code || '')}</select></div><div class="field full"><label for="address">${t('Business address')}</label><textarea id="address" name="address" maxlength="300">${esc(item.address || '')}</textarea></div><div class="field"><label for="phone">${t('Business phone')}</label><input id="phone" name="phone" type="tel" value="${esc(item.phone || '')}"></div></div>`, t('Save details'), async form => {
    const values = Object.fromEntries(form.entries());
    organization = await updateOrganization(supabaseClient, profile.organization_id, { ...values, state: values.state || stateFromGstin(values.gstin) });
    closeModal(); render(); toast(t('Business details saved'));
  });
}
function openAccountSettings() {
  const businessName = `<strong>${esc(organization?.name || t('your business'))}</strong>`;
  const consequence = profile.role === 'owner'
    ? `${t('If you are the only owner, this permanently deletes the {business} workspace: every customer, service job, product, invoice and feedback item, and the login of every technician, shop and customer you invited. This cannot be undone. GST rules require you to keep invoices for six years, so export them first.', { business: businessName })} <button class="button secondary" type="button" data-action="export-invoices">${t('Export invoices')}</button>`
    : t('This permanently deletes your login and the feedback you submitted. This cannot be undone. {business} keeps the records it needs for service history and GST invoices; contact them directly if you want those removed.', { business: businessName });
  showModal(t('My account'), `${profile.login_email} · ${t(roleLabels[profile.role] || profile.role)}`, `${planSection()}<div class="field account-language">${languagePicker('account-language')}</div><div class="notice"><strong>${t('Signed in on another device?')}</strong> ${t('Sign out everywhere else so you can sign in on a new device. This device stays signed in.')} <button class="button secondary" type="button" data-action="sign-out-others">${t('Sign out of other devices')}</button></div><div class="notice"><strong>${t('Delete account.')}</strong> ${consequence}</div><div class="field"><label for="delete-confirm">${t('Type DELETE to confirm')}</label><input id="delete-confirm" name="confirm" autocomplete="off" required></div>`, t('Delete account'), async form => {
    if (form.get('confirm').trim() !== 'DELETE') throw new Error(t('Type DELETE to confirm'));
    await deleteAccount(supabaseClient);
    closeModal();
    await supabaseClient.auth.signOut({ scope: 'local' });
    renderAuth('sign-in', t('Your account has been deleted.'));
  });
  document.querySelector('#active-form [type="submit"]').classList.add('danger');
}
async function signOutOtherDevices(button) {
  if (offlineSince) { toast(t('You are offline. Try again once you are back online.')); return; }
  button.disabled = true;
  const { error } = await supabaseClient.auth.signOut({ scope: 'others' });
  button.disabled = false;
  toast(error ? errorMessage(error, t('Could not sign out other devices. Try again.')) : t('Signed out of all other devices'));
}
const productUnits = ['Nos', 'Pcs', 'Set', 'Box', 'Kg', 'Ltr', 'Mtr'];
function openProductForm() {
  if (profile.role !== 'owner') { toast(t('Only the owner can change catalogue items')); return; }
  if (planBlocked()) return;
  const categories = [msg('Purifiers'), msg('Accessories'), msg('Spare parts')];
  showModal(t('Add catalogue item'), t('Set customer, technician and shop pricing'), `<div class="form-grid"><div class="field"><label for="name">${t('Product name *')}</label><input id="name" name="name" required></div><div class="field"><label for="category">${t('Category')}</label><select id="category" name="category">${categories.map(category => `<option value="${category}">${t(category)}</option>`).join('')}</select></div><div class="field full"><label for="description">${t('Description')}</label><input id="description" name="description"></div><div class="field"><label for="hsn">${t('HSN code (needed for GST invoices)')}</label><input id="hsn" name="hsn" maxlength="8" inputmode="numeric" placeholder="${esc(t('e.g. 8421'))}"></div><div class="field"><label for="unit">${t('Unit')}</label><select id="unit" name="unit">${productUnits.map(unit => `<option>${unit}</option>`).join('')}</select></div><div class="field"><label for="customer">${t('Customer price (₹)')}</label><input id="customer" name="customer" type="number" min="0" required></div><div class="field"><label for="technician">${t('Technician price (₹)')}</label><input id="technician" name="technician" type="number" min="0" required></div><div class="field"><label for="shop">${t('Shop price (₹)')}</label><input id="shop" name="shop" type="number" min="0" required></div><div class="field"><label for="stock">${t('Stock quantity')}</label><input id="stock" name="stock" type="number" min="0" value="0"></div><div class="field"><label for="gst">${t('GST rate (%)')}</label><input id="gst" name="gst" type="number" min="0" max="100" value="18"></div></div>`, t('Add product'), async form => {
    const value = Object.fromEntries(form.entries());
    const item = { ...value, id: `P-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customer: Number(value.customer), technician: Number(value.technician), shop: Number(value.shop), stock: Number(value.stock), gst: Number(value.gst) };
    await save('products', [item]);
    data.products.push(item);
    closeModal(); render(); toast(t('Product added to catalogue'));
  });
}
function openSaleForm(type = 'Quotation') {
  if (profile.role !== 'owner') { toast(t('Only the owner can create quotations or invoices')); return; }
  if (planBlocked()) return;
  if (!data.customers.length || !data.products.length) { toast(t('Add a customer and product before creating a document')); return; }
  const options = data.products.map(item => `<option value="${esc(item.id)}" data-price="${price(item)}">${esc(item.name)} · ${money(price(item))}</option>`).join('');
  const lineItem = `<div class="field"><label>${t('Product')}</label><select name="productId" class="sale-product">${options}</select></div><div class="field"><label>${t('Qty')}</label><input name="qty" class="sale-qty" type="number" min="1" value="1" required></div><div class="field"><label>${t('Unit price ₹')}</label><input name="price" class="sale-price" type="number" min="0" value="${price(data.products[0])}" required></div><div class="field"><label>${t('Discount ₹')}</label><input name="discount" class="sale-discount" type="number" min="0" step="0.01" value="0"></div><button class="row-action remove-line" type="button" aria-label="${esc(t('Remove line'))}">${icons.close}</button>`;
  // Only a GST-registered business may charge GST on an invoice.
  const gstHint = organization?.gstin ? '' : `<small>${t('Add your GSTIN in Accounts → Business details to charge GST on invoices.')}</small>`;
  showModal(type === 'Invoice' ? t('New invoice') : t('New quotation'), t('Choose a customer, products and GST treatment'), `<div class="form-grid"><div class="field"><label for="docType">${t('Document type')}</label><select id="docType" name="docType"><option value="Quotation" ${type === 'Quotation' ? 'selected' : ''}>${t('Quotation')}</option><option value="Invoice" ${type === 'Invoice' ? 'selected' : ''}>${t('Invoice')}</option></select></div><div class="field"><label for="customerId">${t('Customer *')}</label><select id="customerId" name="customerId" required>${customerOptions()}</select></div><div class="field"><label for="date">${t('Document date')}</label><input id="date" name="date" type="date" required value="${new Date().toISOString().slice(0, 10)}"></div><div class="field"><label for="due">${t('Valid until / due date')}</label><input id="due" name="due" type="date" value="${new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10)}"></div><div class="field full"><label>${t('Line items')}</label><div id="line-items"><div class="line-item">${lineItem}</div></div><button class="button secondary" id="add-line" type="button">${icons.plus} ${t('Add line item')}</button></div><div class="field full"><label class="price-toggle"><input type="checkbox" name="gst" id="gst-check" ${organization?.gstin ? 'checked' : ''}> ${t('Apply GST at each product’s rate')}</label>${gstHint}</div><div class="field full"><div class="invoice-total" id="sale-total"></div></div></div>`, t('Save document'), async (values, form) => {
    const ids = form.querySelectorAll('.sale-product');
    const quantities = form.querySelectorAll('.sale-qty');
    const prices = form.querySelectorAll('.sale-price');
    const discounts = form.querySelectorAll('.sale-discount');
    const items = [...ids].map((select, index) => ({ productId: select.value, qty: Number(quantities[index].value), price: Number(prices[index].value), discount: Number(discounts[index].value) || 0 }));
    if (items.some(item => item.qty < 1 || item.price < 0)) { toast(t('Check item quantities and prices')); return; }
    if (items.some(item => item.discount < 0 || item.discount > item.qty * item.price)) { toast(t('A discount cannot be more than the line amount')); return; }
    const document = { type: values.get('docType'), customerId: values.get('customerId'), date: values.get('date'), due: values.get('due'), items, gst: values.has('gst') };
    await createSalesDocument(supabaseClient, document);
    data = await loadWorkspace(supabaseClient, profile);
    closeModal(); render(); toast(document.type === 'Invoice' ? t('Invoice saved') : t('Quotation saved'));
  }, true);
  const modal = document.getElementById('modal-root');
  const updateTotal = () => {
    const lines = [...modal.querySelectorAll('.line-item')].map(row => ({
      qty: Number(row.querySelector('.sale-qty').value) || 0,
      price: Number(row.querySelector('.sale-price').value) || 0,
      discount: Number(row.querySelector('.sale-discount').value) || 0,
      gst: product(row.querySelector('.sale-product').value).gst
    }));
    const bill = taxBreakup(lines, { gstEnabled: modal.querySelector('#gst-check').checked });
    const gst = bill.total - bill.taxable;
    modal.querySelector('#sale-total').innerHTML = `${bill.discount ? `<div><span>${t('Discount')}</span><strong>−${money(bill.discount)}</strong></div>` : ''}<div><span>${t('Taxable value')}</span><strong>${money(bill.taxable)}</strong></div><div><span>${gst ? t('GST (product rates)') : t('GST (not applied)')}</span><strong>${money(gst)}</strong></div><div class="grand"><span>${t('Total')}</span><strong>${money(bill.total)}</strong></div>`;
  };
  const bindRow = row => {
    row.querySelector('.sale-product').addEventListener('change', event => { row.querySelector('.sale-price').value = price(product(event.target.value)); updateTotal(); });
    row.querySelectorAll('input').forEach(input => input.addEventListener('input', updateTotal));
    row.querySelector('.remove-line').addEventListener('click', () => { if (modal.querySelectorAll('.line-item').length > 1) { row.remove(); updateTotal(); } });
  };
  bindRow(modal.querySelector('.line-item'));
  modal.querySelector('#gst-check').addEventListener('change', updateTotal);
  modal.querySelector('#add-line').addEventListener('click', () => { const row = document.createElement('div'); row.className = 'line-item'; row.innerHTML = lineItem; modal.querySelector('#line-items').append(row); bindRow(row); updateTotal(); });
  updateTotal();
}
// Seller, buyer and tax for a document, as it was issued.
function documentDetails(doc) {
  return sharedDocumentDetails(doc, { customer: data.customers.find(item => item.id === doc.customerId), products: data.products, organization });
}
// Prints in a pop-up window (the browser's print screen can also save a PDF).
function printHtml(html) {
  const print = window.open('', '_blank', 'width=900,height=800');
  if (!print) { toast(t('Allow pop-ups to print this document')); return; }
  print.document.write(html);
  print.document.close();
  print.focus();
  print.print();
}
// A spreadsheet (CSV) of every invoice for the accountant.
function exportInvoices() {
  const rows = invoiceRegisterRows(data.documents, documentDetails);
  if (!rows.length) { toast(t('There are no invoices to export yet')); return; }
  const fileName = `${organization?.name || 'clearflow'} invoices ${new Date().toISOString().slice(0, 10)}`;
  const csvCell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csv = [invoiceRegisterHeader, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
  link.download = `${fileName}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}
function printDocument(id) {
  const doc = data.documents.find(item => item.id === id);
  if (!doc) return;
  printHtml(documentHtml(doc, documentDetails(doc)));
}
// The page shell in index.html is written in English; label it in the chosen language.
function setOwnText(element, text) {
  const node = element && [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
  if (node) node.textContent = text;
}
function translateShell() {
  document.title = t('Clearflow | RO Operations');
  document.querySelectorAll('.nav-item[data-view]').forEach(button => setOwnText(button, t(viewTitles[button.dataset.view])));
  setOwnText(document.querySelector('.nav-item[data-action="more-menu"]'), t('More'));
  document.querySelector('.nav')?.setAttribute('aria-label', t('Main navigation'));
  setOwnText(document.querySelector('.sidebar .nav-label'), t('Workspace'));
  setOwnText(document.querySelector('.sidebar .brand-caption'), t('WATER SYSTEMS · OPERATIONS'));
  setOwnText(document.querySelector('.water-card strong'), t('Every drop, accounted for.'));
  setOwnText(document.querySelector('.water-card span'), t('Sales, service and stock in one place.'));
  document.querySelector('.user-chip')?.setAttribute('title', t('My account'));
  setOwnText(document.getElementById('crumb-title'), t(viewTitles[view]));
  setOwnText(document.querySelector('#role-control label'), t('Preview'));
  const roleSelect = document.getElementById('role-select');
  roleSelect.setAttribute('aria-label', t('Preview price list'));
  const tierLabels = { customer: t('Customer prices'), technician: t('Technician prices'), shop: t('Shop prices') };
  roleSelect.querySelectorAll('option').forEach(option => setOwnText(option, tierLabels[option.value] || option.textContent));
  const help = document.getElementById('help-button');
  help.setAttribute('aria-label', t('Help'));
  help.setAttribute('title', t('Help'));
  setOwnText(document.getElementById('signout-button'), t('Sign out'));
}
translateShell();
document.querySelectorAll('.nav-item[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.getElementById('role-select').value = roleView;
document.getElementById('role-select').addEventListener('change', event => {
  if (profile?.role !== 'owner') { event.target.value = profile?.role || 'customer'; return; }
  roleView = priceTier(event.target.value);
  localStorage.setItem('clearflow-role', roleView);
  render();
});
document.getElementById('signout-button').addEventListener('click', async () => {
  const { error } = await supabaseClient.auth.signOut();
  if (error) toast(error.message);
});
document.getElementById('help-button').addEventListener('click', () => toast(t('Use Accounts & access to manage role and price access.')));
// The language picker (sign-in screen and My account). Reloading redraws everything in the new
// language; the session and workspace load again from Supabase.
document.addEventListener('change', event => {
  const select = event.target.closest('[data-language-select]');
  if (!select) return;
  setLanguage(select.value);
  window.location.reload();
});
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
  if (action === 'export-invoices') exportInvoices();
  if (action === 'buy-plan') buyPlan(event.target.closest('[data-action]'));
  if (action === 'sign-out-others') signOutOtherDevices(event.target.closest('[data-action]'));
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
  const select = event.target.closest('[data-doc-status]');
  if (!select) return;
  const doc = data.documents.find(item => item.id === select.dataset.docStatus);
  if (!doc) return;
  const next = select.value;
  const restocks = doc.type === 'Invoice' && next === 'Cancelled';
  if (planBlocked()) { select.value = doc.status; return; }
  if (next === 'Cancelled' && !confirm(restocks ? t('Cancel {id}? Its items go back into stock. This cannot be undone.', { id: doc.id }) : t('Cancel {id}? This cannot be undone.', { id: doc.id }))) { select.value = doc.status; return; }
  try {
    await setSalesDocumentStatus(supabaseClient, doc.id, next);
    doc.status = next;
    if (restocks) data = await loadWorkspace(supabaseClient, profile);
    render();
    toast(t('{id} marked {status}', { id: doc.id, status: t(next).toLowerCase() }));
  } catch (error) {
    select.value = doc.status;
    toast(errorMessage(error, t('Could not update document status')));
  }
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
    toast(t('Feedback status updated'));
  } catch (error) {
    statusSelect.value = entry.status;
    toast(errorMessage(error, t('Could not update feedback status')));
  }
});
initializeApp();
