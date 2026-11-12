import { taxBreakup } from './shared';
import type { SalesDocument } from './types';

// Whole rupees unless the amount has paise.
export function money(value: number) {
  const amount = Math.round((Number(value) || 0) * 100) / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: Number.isInteger(amount) ? 0 : 2, maximumFractionDigits: 2 }).format(amount);
}

export function rupees(value: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value) || 0);
}

// Dates are stored as YYYY-MM-DD.
export function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export function shortDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
}

export function longDate(value: Date) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(value);
}

// Today's date in the device's time zone, as YYYY-MM-DD.
export function today(now = new Date()) {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function totals(doc: Pick<SalesDocument, 'items' | 'gst'>) {
  const bill = taxBreakup(doc.items, { gstEnabled: doc.gst });
  return { subtotal: bill.taxable, gst: Math.round((bill.total - bill.taxable) * 100) / 100, grand: bill.total };
}

export function initials(name = '') {
  return name.split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

// Supabase returns database errors as plain objects, not Error instances.
export function errorMessage(error: unknown, fallback: string) {
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message ? message : fallback;
}
