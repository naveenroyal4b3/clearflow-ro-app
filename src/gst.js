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
export function taxBreakup(lines, { gstEnabled, sellerState, buyerState }) {
  const seller = sellerState || '';
  const placeOfSupply = buyerState || seller;
  const interState = Boolean(seller && placeOfSupply && seller !== placeOfSupply);
  const rows = lines.map(line => {
    const taxable = round(line.qty * line.price);
    const rate = gstEnabled ? Number(line.gst) || 0 : 0;
    const tax = round(taxable * rate / 100);
    const igst = interState ? tax : 0;
    const cgst = interState ? 0 : round(tax / 2);
    const sgst = interState ? 0 : round(tax - cgst);
    return { ...line, taxable, rate, cgst, sgst, igst, total: round(taxable + tax) };
  });
  const sum = key => round(rows.reduce((total, row) => total + row[key], 0));
  return {
    rows,
    interState,
    placeOfSupply,
    taxable: sum('taxable'),
    cgst: sum('cgst'),
    sgst: sum('sgst'),
    igst: sum('igst'),
    total: sum('total')
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
