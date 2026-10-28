import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.118.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  // Prefer the project's publishable/secret API keys; the legacy JWT keys stop working once
  // legacy API keys are disabled for the project.
  const anonKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !anonKey || !serviceKey || !authorization) return json({ error: 'Server configuration is incomplete' }, 500);

  const callerClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in is required' }, 401);

    const { data: owner, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id, role, active')
      .eq('user_id', userData.user.id)
      .single();
    if (profileError || !owner?.active || owner.role !== 'owner' || !owner.organization_id) {
      return json({ error: 'Only an active organization owner can invite team members' }, 403);
    }

    const input = await request.json();
    const email = String(input.email || '').trim().toLowerCase();
    const fullName = String(input.full_name || '').trim();
    const phone = String(input.phone || '').trim();
    const businessName = String(input.business_name || '').trim();
    const businessAddress = String(input.business_address || '').trim();
    const gstin = String(input.gstin || '').trim().toUpperCase();
    const role = String(input.role || '').trim().toLowerCase();
    const customerId = input.customer_id ? String(input.customer_id) : null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !fullName || fullName.length > 160) {
      return json({ error: 'Enter a valid email address and name' }, 400);
    }
    if (!['technician', 'shop', 'customer'].includes(role)) return json({ error: 'Invalid account role' }, 400);
    if (role === 'customer' && !customerId) return json({ error: 'Link a customer record before inviting a customer login' }, 400);

    if (customerId) {
      const { data: linkedCustomer, error: customerError } = await adminClient
        .from('customers')
        .select('id')
        .eq('organization_id', owner.organization_id)
        .eq('id', customerId)
        .maybeSingle();
      if (customerError || !linkedCustomer) return json({ error: 'The linked customer does not belong to this organization' }, 400);
    }

    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      data: { full_name: fullName, phone }
    });
    if (inviteError || !inviteData.user) return json({ error: inviteError?.message || 'Invitation failed' }, 400);

    const invitedUser = inviteData.user;
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: {
        ...invitedUser.app_metadata,
        organization_id: owner.organization_id,
        role,
        customer_id: role === 'customer' ? customerId : null
      }
    });
    if (metadataError) return json({ error: 'Invitation created but role assignment failed. Contact support before resending.' }, 500);

    const { data: profile, error: profileUpsertError } = await adminClient
      .from('profiles')
      .upsert({
        user_id: invitedUser.id,
        organization_id: owner.organization_id,
        role,
        full_name: fullName,
        login_email: email,
        phone,
        business_name: businessName,
        business_address: businessAddress,
        gstin,
        customer_id: role === 'customer' ? customerId : null,
        active: true
      })
      .select('user_id, organization_id, role, full_name, login_email, phone, business_name, business_address, gstin, customer_id, active')
      .single();
    if (profileUpsertError) return json({ error: 'Invitation created but profile setup failed. Contact support before resending.' }, 500);

    return json({ profile }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected invitation error' }, 500);
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