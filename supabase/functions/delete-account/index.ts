import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const businessTablesInDeleteOrder = [
  'feedback',
  'sales_document_items',
  'sales_documents',
  'document_counters',
  'service_jobs',
  'product_prices',
  'products',
  'profiles',
  'customers'
];

// Deletes the signed-in user's account. Technicians, shops, and customers lose their login and
// the feedback they submitted; the business keeps its own customer, job, and invoice records.
// The last owner of a business deletes the whole workspace and every team login in it.
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = defaultKey('SUPABASE_PUBLISHABLE_KEYS') || Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = defaultKey('SUPABASE_SECRET_KEYS') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !anonKey || !serviceKey || !authorization) return json({ error: 'Server configuration is incomplete' }, 500);

  const callerClient = createClient(projectUrl, anonKey, { global: { headers: { Authorization: authorization } } });
  const adminClient = createClient(projectUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Sign in is required' }, 401);
    const userId = userData.user.id;

    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== 'DELETE') return json({ error: 'Type DELETE to confirm account deletion' }, 400);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('organization_id, role')
      .eq('user_id', userId)
      .maybeSingle();
    if (profileError) return json({ error: 'Your profile could not be loaded' }, 500);

    let usersToDelete = [userId];
    const organizationId = profile?.organization_id;
    if (organizationId && profile.role === 'owner') {
      const { data: otherOwners, error: ownersError } = await adminClient
        .from('profiles')
        .select('user_id')
        .eq('organization_id', organizationId)
        .eq('role', 'owner')
        .eq('active', true)
        .neq('user_id', userId)
        .limit(1);
      if (ownersError) return json({ error: 'The business team could not be loaded' }, 500);

      const successor = otherOwners?.[0]?.user_id;
      if (successor) {
        // Another owner keeps running the business, so hand over the records this owner created.
        const { error: organizationError } = await adminClient
          .from('organizations')
          .update({ created_by: successor })
          .eq('id', organizationId)
          .eq('created_by', userId);
        const { error: documentsError } = await adminClient
          .from('sales_documents')
          .update({ created_by: successor })
          .eq('organization_id', organizationId)
          .eq('created_by', userId);
        if (organizationError || documentsError) return json({ error: 'Business records could not be handed over to the other owner' }, 500);
      } else {
        const { data: members, error: membersError } = await adminClient
          .from('profiles')
          .select('user_id')
          .eq('organization_id', organizationId);
        if (membersError) return json({ error: 'The business team could not be loaded' }, 500);
        usersToDelete = [...new Set([userId, ...(members || []).map(member => member.user_id)])];

        // A single cascading delete of the organization trips the non-cascading foreign keys between
        // these tables, so delete children before parents.
        for (const table of businessTablesInDeleteOrder) {
          const { error } = await adminClient.from(table).delete().eq('organization_id', organizationId);
          if (error) return json({ error: 'The business workspace could not be deleted' }, 500);
        }
        const { error: deleteOrganizationError } = await adminClient.from('organizations').delete().eq('id', organizationId);
        if (deleteOrganizationError) return json({ error: 'The business workspace could not be deleted' }, 500);
      }
    }

    // Feedback rows reference the profile without cascading, so remove them before the login.
    const { error: feedbackError } = await adminClient.from('feedback').delete().eq('submitter_user_id', userId);
    if (feedbackError) return json({ error: 'Your feedback could not be deleted' }, 500);

    const failed: string[] = [];
    for (const id of usersToDelete) {
      const { error } = await adminClient.auth.admin.deleteUser(id);
      if (error) failed.push(id);
    }
    if (failed.length) return json({ error: 'Your data was deleted, but some sign-in accounts could not be removed. Contact support.' }, 500);

    return json({ deleted_users: usersToDelete.length }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Unexpected account deletion error' }, 500);
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
