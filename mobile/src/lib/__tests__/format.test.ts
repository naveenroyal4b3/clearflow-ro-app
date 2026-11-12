import { errorMessage, formatDate, initials, today, totals } from '../format';

describe('format', () => {
  it('totals a GST invoice with a discount, using the shared web GST maths', () => {
    const result = totals({ gst: true, items: [{ productId: 'P', name: 'Filter', qty: 2, price: 500, gst: 18, hsn: '8421', unit: 'Nos', discount: 100 }] });
    expect(result).toEqual({ subtotal: 900, gst: 162, grand: 1062 });
  });

  it('adds no tax to a non-GST document', () => {
    expect(totals({ gst: false, items: [{ productId: 'P', name: 'Filter', qty: 1, price: 250, gst: 18, hsn: '', unit: 'Nos', discount: 0 }] }).grand).toBe(250);
  });

  it('formats dates and initials', () => {
    expect(formatDate('2026-11-05')).toMatch(/05.*Nov.*2026/);
    expect(formatDate('')).toBe('—');
    expect(initials('Lakshmi Prasad Rao')).toBe('LP');
  });

  it('gives today in the local time zone', () => {
    expect(today(new Date(2026, 0, 31, 23, 30))).toBe('2026-01-31');
  });

  it('reads messages from Supabase error objects', () => {
    expect(errorMessage({ message: 'plan has ended' }, 'fallback')).toBe('plan has ended');
    expect(errorMessage(null, 'fallback')).toBe('fallback');
  });
});
