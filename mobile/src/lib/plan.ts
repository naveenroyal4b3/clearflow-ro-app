import { t } from './i18n';
import type { Organization } from './types';

// The same rules as the web app and the database's require_active_plan trigger.
export type PlanStatus =
  | { active: true; paid?: undefined; trial?: undefined }
  | { active: true; paid: true; trial?: undefined; until: Date }
  | { active: true; paid?: undefined; trial: true; until: Date; daysLeft: number }
  | { active: false; paid?: undefined; trial?: undefined };

export function planStatus(organization: Organization | null, now = Date.now()): PlanStatus {
  // Before plans existed there was no trial date; treat those workspaces as active.
  if (!organization?.trial_ends_at) return { active: true };
  const paidUntil = organization.paid_until ? new Date(organization.paid_until) : null;
  if (paidUntil && paidUntil.getTime() > now) return { active: true, paid: true, until: paidUntil };
  const trialEnds = new Date(organization.trial_ends_at);
  if (trialEnds.getTime() > now) return { active: true, trial: true, until: trialEnds, daysLeft: Math.ceil((trialEnds.getTime() - now) / 86400000) };
  return { active: false };
}

// Google Play allows this app to unlock a plan bought on the website, but not to link to that
// payment or show prices. Plain text naming the website is allowed.
export const webAppAddress = 'naveenroyal4b3.github.io/clearflow-ro-app';
export const renewalHint = () => t('To renew, sign in on our website, {address}, and open My account.', { address: webAppAddress });
export const planEndedMessage = () => t('This business’s plan has ended. You can still view records.');
