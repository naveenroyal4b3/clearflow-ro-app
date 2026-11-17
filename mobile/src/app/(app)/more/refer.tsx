import { useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { Button, Card, colors, Field, Notice, Screen } from '@/components/ui';
import { errorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { appLinks, applyReferral } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

// The owner shares the business's referral code with other dealers, or enters the code of the
// dealer who told them about Clearflow. Rewards are described on the website only (Google Play's
// payments rules), so this screen just shares the code.
export default function Refer() {
  const { organization, setOrganization } = useSession();
  const [entered, setEntered] = useState('');
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [now] = useState(() => Date.now());
  const code = organization?.referral_code || '';
  const canEnter = Boolean(organization && !organization.referred_by && !organization.paid_until && organization.created_at && now - new Date(organization.created_at).getTime() < 14 * 86400000);

  const share = async () => { await Share.share({ message: t('I use Clearflow RO for GST bills, service jobs and spare parts. Use my code {code} when you set up your business: {link}', { code, link: appLinks.play }) }); };
  const apply = async () => {
    setMessage(null);
    try {
      await applyReferral(supabase, entered);
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error, t('Not saved. Try again.')) });
      return;
    }
    if (organization) setOrganization({ ...organization, referred_by: 'set' });
    setMessage({ tone: 'info', text: t('Referral code saved') });
  };

  return (
    <Screen>
      <Card>
        <Text style={local.note}>{t('Share Clearflow RO with another RO dealer. They enter your code when they set up their business.')}</Text>
        <Text style={local.label}>{t('Your referral code')}</Text>
        <Text style={local.code} selectable>{code || '—'}</Text>
        <Button label={t('Share code')} onPress={share} disabled={!code} />
      </Card>
      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      {canEnter ? (
        <Card>
          <Field label={t('Have a code from another dealer?')} value={entered} onChangeText={value => setEntered(value.toUpperCase())} autoCapitalize="characters" maxLength={6} />
          <Button label={t('Apply')} variant="secondary" onPress={apply} disabled={entered.trim().length !== 6} />
        </Card>
      ) : null}
      <View />
    </Screen>
  );
}

const local = StyleSheet.create({
  note: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  label: { fontSize: 13, color: colors.muted, marginTop: 8 },
  code: { fontSize: 34, fontWeight: '800', letterSpacing: 6, color: colors.teal }
});
