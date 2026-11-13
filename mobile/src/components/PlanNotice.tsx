import { Notice } from './ui';
import { longDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { planEndedMessage, planStatus, renewalHint } from '@/lib/plan';
import { useSession } from '@/lib/session';

// Plain text only: Google Play does not allow this app to link to the website payment.
export function PlanNotice() {
  const { organization, profile, offlineSince } = useSession();
  const plan = planStatus(organization);
  const notices = [];
  if (offlineSince) {
    notices.push(
      <Notice key="offline" tone="warning" title={t('Offline.')}>
        {t('Showing data last synced {time}. Changes can be made once you are back online.', { time: new Date(offlineSince).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) })}
      </Notice>
    );
  }
  if (!plan.active) {
    const action = profile?.role === 'owner' ? renewalHint() : t('Ask the business owner to renew it.');
    notices.push(<Notice key="plan" tone="warning" title={t('Plan ended.')}>{`${planEndedMessage()} ${action}`}</Notice>);
  } else if (plan.trial && profile?.role === 'owner' && plan.daysLeft <= 3) {
    notices.push(<Notice key="plan" tone="warning" title={t('Free trial ends on {date}.', { date: longDate(plan.until) })}>{renewalHint()}</Notice>);
  }
  return <>{notices}</>;
}

// True when changes are blocked; the caller shows why.
export function useReadOnlyReason() {
  const { organization, offlineSince } = useSession();
  if (offlineSince) return t('You are offline. Changes can be made once you are back online.');
  if (!planStatus(organization).active) return planEndedMessage();
  return '';
}
