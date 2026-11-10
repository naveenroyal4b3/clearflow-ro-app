import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

// Razorpay calls this after subscription events. Each successful charge extends the business's
// paid_until to the end of the paid period plus a few days' grace for the next charge to go
// through. Cancelled or halted subscriptions need no action: the plan simply runs out.

const graceDays = 3;
const extendingEvents = new Set(['subscription.activated', 'subscription.charged', 'subscription.resumed']);

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');
  const planIntervals: Record<string, string> = {};
  const monthly = Deno.env.get('RAZORPAY_PLAN_MONTHLY');
  const yearly = Deno.env.get('RAZORPAY_PLAN_YEARLY');
  if (monthly) planIntervals[monthly] = 'monthly';
  if (yearly) planIntervals[yearly] = 'yearly';
  if (!projectUrl || !serviceKey || !webhookSecret) return new Response('Server configuration is incomplete', { status: 500 });

  // The signature covers the exact bytes Razorpay sent, so verify before parsing.
  const body = await request.text();
  const signature = request.headers.get('X-Razorpay-Signature') || '';
  if (!(await validSignature(body, signature, webhookSecret))) return new Response('Invalid signature', { status: 401 });

  let event: { event?: string; payload?: { subscription?: { entity?: Record<string, unknown> } } };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!extendingEvents.has(String(event.event))) return new Response('ignored', { status: 200 });

  const subscription = event.payload?.subscription?.entity || {};
  const notes = (subscription.notes || {}) as Record<string, string>;
  const organizationId = notes.organization_id;
  const interval = planIntervals[String(subscription.plan_id)];
  const currentEnd = Number(subscription.current_end);
  // Only this app's plans unlock a business.
  if (!organizationId || !interval || !Number.isFinite(currentEnd) || currentEnd <= 0) return new Response('ignored', { status: 200 });

  const adminClient = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: organization, error } = await adminClient
    .from('organizations')
    .select('id, paid_until')
    .eq('id', organizationId)
    .maybeSingle();
  if (error) return new Response('Lookup failed', { status: 500 });
  if (!organization) return new Response('ignored', { status: 200 });

  // Razorpay may deliver events more than once or out of order; never shorten a plan.
  const nextPaidUntil = new Date((currentEnd + graceDays * 86400) * 1000);
  const existing = organization.paid_until ? new Date(organization.paid_until) : null;
  const paidUntil = existing && existing > nextPaidUntil ? existing : nextPaidUntil;
  const { error: updateError } = await adminClient
    .from('organizations')
    .update({ paid_until: paidUntil.toISOString(), plan_interval: interval, razorpay_subscription_id: String(subscription.id || '') })
    .eq('id', organizationId);
  if (updateError) return new Response('Update failed', { status: 500 });
  return new Response('ok', { status: 200 });
});

async function validSignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const expected = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== signature.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index++) difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  return difference === 0;
}

// SUPABASE_SECRET_KEYS is a JSON dictionary of key name -> key.
function defaultKey(variable: string): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get(variable) || '{}') as Record<string, string>;
    return keys.default || Object.values(keys)[0];
  } catch {
    return undefined;
  }
}
