const roleLabels = {
  owner: 'Owner',
  technician: 'Technician',
  shop: 'Shop',
  customer: 'Customer'
};

const feedbackStatusLabels = {
  new: 'New',
  in_review: 'In review',
  in_progress: 'In progress',
  planned: 'Planned',
  resolved: 'Resolved',
  closed: 'Closed'
};

function requireData(result) {
  if (result.error) throw result.error;
  return result.data || [];
}

async function selectOrganization(client, table, organizationId) {
  return requireData(await client.from(table).select('*').eq('organization_id', organizationId));
}

export async function loadWorkspace(client, profile) {
  const organizationId = profile.organization_id;
  const [customers, products, prices, jobs, documents, items, feedback, profiles] = await Promise.all([
    selectOrganization(client, 'customers', organizationId),
    selectOrganization(client, 'products', organizationId),
    selectOrganization(client, 'product_prices', organizationId),
    selectOrganization(client, 'service_jobs', organizationId),
    selectOrganization(client, 'sales_documents', organizationId),
    selectOrganization(client, 'sales_document_items', organizationId),
    selectOrganization(client, 'feedback', organizationId),
    selectOrganization(client, 'profiles', organizationId)
  ]);

  const priceByProduct = new Map();
  for (const row of prices) {
    if (!priceByProduct.has(row.product_id)) priceByProduct.set(row.product_id, {});
    priceByProduct.get(row.product_id)[row.audience] = Number(row.amount);
  }

  const customerById = new Map(customers.map(item => [item.id, item]));
  const profileById = new Map(profiles.map(item => [item.user_id, item]));
  const itemsByDocument = new Map();
  for (const item of items) {
    if (!itemsByDocument.has(item.document_id)) itemsByDocument.set(item.document_id, []);
    itemsByDocument.get(item.document_id).push({
      productId: item.product_id,
      name: item.product_name,
      qty: Number(item.quantity),
      price: Number(item.unit_price),
      gst: Number(item.gst_rate)
    });
  }

  return {
    customers: customers.map(item => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email || '',
      address: item.address || '',
      type: item.customer_type,
      installed: item.installed_on || '',
      purifier: item.purifier || '',
      notes: item.notes || ''
    })),
    products: products.map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description || '',
      stock: ['owner', 'technician'].includes(profile.role) ? item.stock : null,
      gst: Number(item.gst_rate),
      ...(priceByProduct.get(item.id) || {})
    })),
    jobs: jobs.map(item => ({
      id: item.id,
      customerId: item.customer_id,
      type: item.job_type,
      date: item.scheduled_for,
      technician: item.technician_name || profileById.get(item.technician_id)?.full_name || '',
      status: item.status,
      notes: item.notes || ''
    })),
    documents: documents.map(item => ({
      id: item.id,
      type: item.document_type,
      customerId: item.customer_id,
      date: item.document_date,
      due: item.due_date || '',
      gst: item.gst_enabled,
      status: item.status,
      items: itemsByDocument.get(item.id) || []
    })),
    feedback: feedback.map(item => ({
      id: item.id,
      customerId: item.customer_id || '',
      type: item.category,
      priority: item.priority,
      title: item.title,
      description: item.description,
      reference: item.reference || '',
      name: item.submitter_name || profileById.get(item.submitter_user_id)?.full_name || '',
      phone: item.submitter_phone || profileById.get(item.submitter_user_id)?.phone || '',
      email: item.submitter_email || profileById.get(item.submitter_user_id)?.login_email || '',
      status: feedbackStatusLabels[item.status] || 'New',
      date: item.created_at.slice(0, 10),
      createdAt: item.created_at
    })),
    accounts: profiles.map(item => ({
      id: item.user_id,
      name: item.full_name,
      username: item.login_email,
      role: roleLabels[item.role] || item.role,
      phone: item.phone,
      address: item.business_address,
      gstin: item.gstin,
      linked: item.customer_id || item.business_name || '',
      status: item.active ? 'Active' : 'Inactive'
    }))
  };
}

export async function saveWorkspaceRecords(client, profile, collection, records, profiles = []) {
  const organizationId = profile.organization_id;
  const entries = Array.isArray(records) ? records : [records];
  let result;

  if (collection === 'customers') {
    result = await client.from('customers').upsert(entries.map(item => ({
      organization_id: organizationId,
      id: item.id,
      name: item.name,
      phone: item.phone,
      email: item.email || null,
      address: item.address || '',
      customer_type: item.type || 'Residential',
      installed_on: item.installed || null,
      purifier: item.purifier || '',
      notes: item.notes || ''
    })), { onConflict: 'organization_id,id' });
  } else if (collection === 'products') {
    result = await client.from('products').upsert(entries.map(item => ({
      organization_id: organizationId,
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description || '',
      stock: Number(item.stock) || 0,
      gst_rate: Number(item.gst) || 0,
      active: true
    })), { onConflict: 'organization_id,id' });
    if (result.error) throw result.error;
    const priceRows = entries.flatMap(item => ['customer', 'technician', 'shop'].map(audience => ({
      organization_id: organizationId,
      product_id: item.id,
      audience,
      amount: Number(item[audience]) || 0
    })));
    result = await client.from('product_prices').upsert(priceRows, { onConflict: 'organization_id,product_id,audience' });
  } else if (collection === 'jobs') {
    result = await client.from('service_jobs').upsert(entries.map(item => {
      const technician = profiles.find(account => account.full_name === item.technician || account.name === item.technician);
      return {
        organization_id: organizationId,
        id: item.id,
        customer_id: item.customerId,
        job_type: item.type,
        scheduled_for: item.date,
        technician_id: technician?.user_id || technician?.id || null,
        technician_name: item.technician || '',
        status: item.status || 'Scheduled',
        notes: item.notes || ''
      };
    }), { onConflict: 'organization_id,id' });
  } else if (collection === 'feedback') {
    result = await client.from('feedback').insert(entries.map(item => ({
      organization_id: organizationId,
      id: item.id,
      submitter_user_id: profile.user_id,
      customer_id: item.customerId || profile.customer_id || null,
      category: item.type,
      priority: item.priority || 'Normal',
      title: item.title,
      description: item.description,
      reference: item.reference || '',
      submitter_name: item.name || profile.full_name,
      submitter_phone: item.phone || profile.phone,
      submitter_email: profile.login_email
    })));
  } else {
    throw new Error(`Unsupported workspace collection: ${collection}`);
  }

  if (result.error) throw result.error;
}

export async function createSalesDocument(client, document) {
  const lineItems = document.items.map(item => ({
    product_id: item.productId,
    quantity: item.qty,
    unit_price: item.price
  }));
  const { data, error } = await client.rpc('create_sales_document', {
    p_document_type: document.type,
    p_customer_id: document.customerId,
    p_document_date: document.date,
    p_due_date: document.due || null,
    p_gst_enabled: document.gst,
    p_line_items: lineItems
  });
  if (error) throw error;
  return data;
}

export async function setFeedbackStatus(client, feedbackId, status) {
  const { error } = await client.rpc('set_feedback_status', {
    feedback_id: feedbackId,
    next_status: status.toLowerCase().replace(/\s+/g, '_')
  });
  if (error) throw error;
}

export async function inviteMember(client, invite) {
  const { data, error } = await client.functions.invoke('invite-member', {
    body: {
      email: invite.email,
      full_name: invite.name,
      phone: invite.phone,
      role: invite.role.toLowerCase(),
      customer_id: invite.role === 'Customer' ? invite.linked : null,
      business_name: invite.name,
      business_address: invite.address || '',
      gstin: invite.gstin || ''
    }
  });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data.profile;
}

export async function deleteAccount(client) {
  const { data, error } = await client.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
  if (error) throw new Error(await functionErrorMessage(error));
  if (data?.error) throw new Error(data.error);
  return data;
}

// Edge Function errors only say "non-2xx status code"; the function's own message is in the response body.
async function functionErrorMessage(error) {
  try {
    const body = await error.context?.json();
    if (body?.error) return body.error;
  } catch {
    // Fall back to the generic message below.
  }
  return error.message;
}