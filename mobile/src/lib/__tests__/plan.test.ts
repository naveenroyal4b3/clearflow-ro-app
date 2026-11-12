import { planStatus } from '../plan';
import type { Organization } from '../types';

const base: Organization = { id: 'o', name: 'Test', gstin: null, address: '', state_code: '', phone: '' };
const now = Date.parse('2026-11-12T10:00:00Z');
const day = 86400000;

describe('planStatus', () => {
  it('treats workspaces from before plans existed as active', () => {
    expect(planStatus(base, now)).toEqual({ active: true });
    expect(planStatus(null, now)).toEqual({ active: true });
  });

  it('reports a running trial with the days left', () => {
    const status = planStatus({ ...base, trial_ends_at: new Date(now + 2.5 * day).toISOString() }, now);
    expect(status).toMatchObject({ active: true, trial: true, daysLeft: 3 });
  });

  it('ends when the trial is over and nothing is paid', () => {
    expect(planStatus({ ...base, trial_ends_at: new Date(now - day).toISOString() }, now)).toEqual({ active: false });
  });

  it('prefers a paid period over the trial', () => {
    const status = planStatus({ ...base, trial_ends_at: new Date(now - day).toISOString(), paid_until: new Date(now + 30 * day).toISOString() }, now);
    expect(status).toMatchObject({ active: true, paid: true });
  });

  it('ends when the paid period has run out', () => {
    expect(planStatus({ ...base, trial_ends_at: new Date(now - 40 * day).toISOString(), paid_until: new Date(now - day).toISOString() }, now)).toEqual({ active: false });
  });
});
