import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

// Starts a Razorpay subscription for the caller's business and returns Razorpay's hosted payment
// page. Only the web app calls this: the Android app never shows a way to pay (Google Play's
// Payments policy allows a "consumption-only" app to unlock a plan bought elsewhere, but not to
// link to that payment). The plan is unlocked later by razorpay-webhook, not here.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Razorpay needs a fixed number of billing cycles; these run for about ten years.
const cycles: Record<string, number> = { monthly: 120, yearly: 10 };

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const keyId = Deno.env.get('RAZORPAY_KEY_ID');
  const keySecret = Deno.env.get('RAZORPAY_KEY_SECRET');
  const planIds: Record<string, string | undefined> = {
    monthly: Deno.env.get('RAZORPAY_PLAN_MONTHLY'),
    yearly: Deno.env.get('RAZORPAY_PLAN_YEARLY')
  };
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !anonKey || !serviceKey || !authorization) return json({ error: 'Server configuration is incomplete' }, 500);
  if (!keyId || !keySecret || !planIds.monthly || !planIds.yearly) return json({ error: 'Online payments are not set up yet' }, 503);

  const callerClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in is required' }, 401);

    const { data: owner, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id, role, active, login_email, full_name, phone')
      .eq('user_id', userData.user.id)
      .single();
    if (profileError || !owner?.active || owner.role !== 'owner' || !owner.organization_id) {
      return json({ error: 'Only the business owner can buy a plan' }, 403);
    }

    const input = await request.json().catch(() => ({}));
    const interval = String(input.interval || '');
    const planId = planIds[interval];
    if (!planId) return json({ error: 'Choose the monthly or yearly plan' }, 400);

    const { data: organization, error: organizationError } = await adminClient
      .from('organizations')
      .select('id, name, paid_until')
      .eq('id', owner.organization_id)
      .single();
    if (organizationError || !organization) return json({ error: 'Business not found' }, 404);
    // A paid plan renews by itself, so a second subscription would charge twice.
    if (organization.paid_until && new Date(organization.paid_until) > new Date()) {
      return json({ error: 'Your plan is already active and renews automatically' }, 409);
    }

    const response = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${btoa(`${keyId}:${keySecret}`)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        total_count: cycles[interval],
        quantity: 1,
        customer_notify: 1,
        notes: { organization_id: organization.id, business_name: organization.name.slice(0, 250), owner_email: owner.login_email }
      })
    });
    const subscription = await response.json().catch(() => ({}));
    if (!response.ok || !subscription.short_url) {
      return json({ error: subscription?.error?.description || 'The payment could not be started. Try again.' }, 502);
    }
    return json({ url: subscription.short_url }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected payment error' }, 500);
  }
});

// SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS are JSON dictionaries of key name -> key.
function defaultKey(variable: string): string | undefined {
  try {
    const keys = JSON.parse(Deno.env.get(variable) || '{}') as Record<string, string>;
    return keys.default || Object.values(keys)[0];
  } catch {
    return undefined;
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
