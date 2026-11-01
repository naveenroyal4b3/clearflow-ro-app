// @ts-check
// Indian states and union territories with their GST state codes (the first two digits of a GSTIN).
export const gstStates = {
  '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh', '05': 'Uttarakhand',
  '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan', '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim',
  '12': 'Arunachal Pradesh', '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura', '17': 'Meghalaya',
  '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand', '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh',
  '24': 'Gujarat', '26': 'Dadra and Nagar Haveli and Daman and Diu', '27': 'Maharashtra', '29': 'Karnataka', '30': 'Goa',
  '31': 'Lakshadweep', '32': 'Kerala', '33': 'Tamil Nadu', '34': 'Puducherry', '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana', '37': 'Andhra Pradesh', '38': 'Ladakh', '97': 'Other Territory'
};

export function stateLabel(code) {
  return gstStates[code] ? `${code} – ${gstStates[code]}` : '';
}

export function stateOptions(selected = '') {
  return `<option value="">Select state</option>${Object.entries(gstStates)
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([code, name]) => `<option value="${code}" ${code === selected ? 'selected' : ''}>${name}</option>`).join('')}`;
}

// A GSTIN starts with the state code, so it settles the state when one was not chosen.
export function stateFromGstin(gstin) {
  const code = String(gstin || '').slice(0, 2);
  return gstStates[code] ? code : '';
}

// Splits GST into CGST + SGST for a sale within the seller's state, or IGST for a sale to another
// state. When the buyer's state is unknown (a walk-in customer), the sale is treated as local.
// A line's discount is a rupee amount taken off before tax.
export function taxBreakup(lines, { gstEnabled, sellerState = '', buyerState = '' }) {
  const seller = sellerState || '';
  const placeOfSupply = buyerState || seller;
  const interState = Boolean(seller && placeOfSupply && seller !== placeOfSupply);
  const rows = lines.map(line => {
    const discount = round(Number(line.discount) || 0);
    const taxable = round(line.qty * line.price - discount);
    const rate = gstEnabled ? Number(line.gst) || 0 : 0;
    const tax = round(taxable * rate / 100);
    const igst = interState ? tax : 0;
    const cgst = interState ? 0 : round(tax / 2);
    const sgst = interState ? 0 : round(tax - cgst);
    return { ...line, discount, taxable, rate, cgst, sgst, igst, total: round(taxable + tax) };
  });
  const sum = key => round(rows.reduce((total, row) => total + row[key], 0));
  return {
    rows,
    interState,
    placeOfSupply,
    discount: sum('discount'),
    taxable: sum('taxable'),
    cgst: sum('cgst'),
    sgst: sum('sgst'),
    igst: sum('igst'),
    total: sum('total')
  };
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  return n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
}

// Indian numbering: thousand, lakh (1,00,000) and crore (1,00,00,000).
function indianWords(n) {
  const group = (size, name) => `${indianWords(Math.floor(n / size))} ${name}${n % size ? ` ${indianWords(n % size)}` : ''}`;
  if (n >= 1e7) return group(1e7, 'Crore');
  if (n >= 1e5) return group(1e5, 'Lakh');
  if (n >= 1e3) return group(1e3, 'Thousand');
  if (n >= 100) return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${belowHundred(n % 100)}` : ''}`;
  return belowHundred(n);
}

// The invoice total in words, as GST invoices commonly show it: "Rupees One Lakh Twenty Thousand Only".
export function amountInWords(amount) {
  const totalPaise = Math.round(Math.abs(Number(amount) || 0) * 100);
  const rupees = Math.floor(totalPaise / 100);
  const paise = totalPaise % 100;
  return `Rupees ${rupees ? indianWords(rupees) : 'Zero'}${paise ? ` and ${belowHundred(paise)} Paise` : ''} Only`;
}

function round(value) {
  return Math.round(value * 100) / 100;
}
