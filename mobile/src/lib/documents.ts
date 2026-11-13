import { msg } from './i18n';
import { documentDetails, documentHtml } from './shared';
import type { Organization, SalesDocument, WorkspaceData } from './types';

// Stored values; show them with t(status).
export const documentStatuses: Record<SalesDocument['type'], string[]> = { Invoice: [msg('Pending'), msg('Paid'), msg('Cancelled')], Quotation: [msg('Draft'), msg('Sent'), msg('Cancelled')] };

export function statusTone(status: string) {
  return status === 'Paid' ? 'good' : status === 'Cancelled' ? 'bad' : status === 'Sent' ? 'good' : 'warning';
}

export function detailsFor(doc: SalesDocument, data: WorkspaceData, organization: Organization | null) {
  return documentDetails(doc, { customer: data.customers.find(item => item.id === doc.customerId), products: data.products, organization });
}

export function htmlFor(doc: SalesDocument, data: WorkspaceData, organization: Organization | null) {
  return documentHtml(doc, detailsFor(doc, data, organization));
}
