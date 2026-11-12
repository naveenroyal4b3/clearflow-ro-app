export type Role = 'owner' | 'technician' | 'shop' | 'customer';

export type Profile = {
  user_id: string;
  organization_id: string | null;
  role: Role;
  full_name: string;
  login_email: string;
  phone: string;
  business_name: string;
  business_address: string;
  gstin: string;
  customer_id: string | null;
  active: boolean;
};

export type Organization = {
  id: string;
  name: string;
  gstin: string | null;
  address: string;
  state_code: string;
  phone: string;
  trial_ends_at?: string | null;
  paid_until?: string | null;
};

export type Customer = {
  id: string; name: string; phone: string; email: string; address: string; type: string;
  installed: string; purifier: string; notes: string; gstin: string; state: string;
};
export type Product = {
  id: string; name: string; category: string; description: string; hsn: string; unit: string;
  stock: number | null; gst: number; customer?: number; technician?: number; shop?: number;
};
export type Job = { id: string; customerId: string; type: string; date: string; technician: string; status: string; notes: string };
export type LineItem = { productId: string; name: string; qty: number; price: number; gst: number; hsn: string; unit: string; discount: number };
export type SalesDocument = {
  id: string; type: 'Quotation' | 'Invoice'; customerId: string; date: string; due: string; gst: boolean; status: string;
  seller: { name: string; gstin: string; address: string; state: string; phone: string };
  buyer: { name: string; gstin: string; address: string; state: string };
  items: LineItem[];
};
export type Feedback = {
  id: string; customerId: string; type: string; priority: string; title: string; description: string; reference: string;
  name: string; phone: string; email: string; status: string; date: string; createdAt: string;
};
export type Account = { id: string; name: string; username: string; role: string; phone: string; address: string; gstin: string; linked: string; status: string };

export type WorkspaceData = {
  customers: Customer[];
  products: Product[];
  jobs: Job[];
  documents: SalesDocument[];
  feedback: Feedback[];
  accounts: Account[];
};

export const emptyData: WorkspaceData = { customers: [], products: [], jobs: [], documents: [], feedback: [], accounts: [] };
export const roleLabels: Record<Role, string> = { owner: 'Business owner', technician: 'Technician', shop: 'Shop', customer: 'Customer' };
