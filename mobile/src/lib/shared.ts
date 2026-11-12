// GST maths and Supabase data access shared with the web app (../src). They are loaded with
// require() so the bundler includes them while TypeScript uses the types declared here instead of
// type-checking the web project's JavaScript under this app's stricter settings. Only functions
// that need no browser APIs are exposed.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LineItem, Organization, Profile, SalesDocument, WorkspaceData } from './types';

type TaxLine = { qty: number; price: number; gst: number; discount?: number };
type TaxRow<T> = T & { discount: number; taxable: number; rate: number; cgst: number; sgst: number; igst: number; total: number };
type Bill<T> = { rows: TaxRow<T>[]; interState: boolean; placeOfSupply: string; discount: number; taxable: number; cgst: number; sgst: number; igst: number; total: number };

type GstModule = {
  gstStates: Record<string, string>;
  stateLabel: (code: string) => string;
  stateFromGstin: (gstin: string) => string;
  taxBreakup: <T extends TaxLine>(lines: T[], options: { gstEnabled: boolean; sellerState?: string; buyerState?: string }) => Bill<T>;
  amountInWords: (amount: number) => string;
};

type Collection = 'customers' | 'products' | 'jobs' | 'feedback';
type DataModule = {
  loadWorkspace: (client: SupabaseClient, profile: Profile) => Promise<WorkspaceData>;
  saveWorkspaceRecords: (client: SupabaseClient, profile: Profile, collection: Collection, records: object[], profiles?: { user_id?: string; id?: string; full_name?: string; name?: string }[]) => Promise<void>;
  createSalesDocument: (client: SupabaseClient, document: { type: SalesDocument['type']; customerId: string; date: string; due: string; gst: boolean; items: Pick<LineItem, 'productId' | 'qty' | 'price' | 'discount'>[] }) => Promise<string>;
  setSalesDocumentStatus: (client: SupabaseClient, documentId: string, status: string) => Promise<void>;
  setFeedbackStatus: (client: SupabaseClient, feedbackId: string, status: string) => Promise<void>;
  signedInElsewhere: (client: SupabaseClient) => Promise<boolean>;
  inviteMember: (client: SupabaseClient, invite: { email: string; name: string; phone: string; role: string; linked?: string; address?: string; gstin?: string }) => Promise<Profile>;
  deleteAccount: (client: SupabaseClient) => Promise<unknown>;
  updateOrganization: (client: SupabaseClient, organizationId: string, details: { name: string; gstin: string; address: string; state: string; phone: string }) => Promise<Organization>;
  loadAuditLog: (client: SupabaseClient, organizationId: string, limit?: number) => Promise<{ id: number; table_name: string; record_id: string; action: string; changed_by: string | null; changed_at: string }[]>;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const gst: GstModule = require('../../../src/gst.js');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const data: DataModule = require('../../../src/supabase-data.js');

export const { gstStates, stateLabel, stateFromGstin, taxBreakup, amountInWords } = gst;
export const {
  loadWorkspace, saveWorkspaceRecords, createSalesDocument, setSalesDocumentStatus, setFeedbackStatus,
  signedInElsewhere, inviteMember, deleteAccount, updateOrganization, loadAuditLog
} = data;
