import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { Button, Card, CardTitle, Field, Notice, Screen, styles } from '@/components/ui';
import { PlanNotice } from '@/components/PlanNotice';
import { errorMessage, longDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { planStatus, renewalHint } from '@/lib/plan';
import { useSession } from '@/lib/session';
import { deleteAccount } from '@/lib/shared';
import { supabase } from '@/lib/supabase';
import { roleLabels } from '@/lib/types';

export default function Account() {
  const { profile, organization, offlineSince, signOut } = useSession();
  const [confirm, setConfirm] = useState('');
  if (!profile) return null;
  const owner = profile.role === 'owner';
  const plan = planStatus(organization);
  const businessName = organization?.name || t('your business');

  const signOutOthers = async () => {
    if (offlineSince) { Alert.alert(t('Offline'), t('Try again once you are back online.')); return; }
    const { error } = await supabase.auth.signOut({ scope: 'others' });
    Alert.alert(error ? t('Could not sign out other devices') : t('Done'), error ? errorMessage(error, t('Try again.')) : t('Signed out of all other devices. This device stays signed in.'));
  };

  const remove = async () => {
    try {
      await deleteAccount(supabase);
    } catch (error) {
      Alert.alert(t('Account not deleted'), errorMessage(error, t('Try again.')));
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    await signOut();
  };

  return (
    <Screen>
      <PlanNotice />
      <Card>
        <CardTitle title={profile.full_name || profile.login_email} note={`${profile.login_email} · ${t(roleLabels[profile.role])}`} />
        <Text style={styles.hint}>{businessName}</Text>
        <Button label={t('Sign out')} variant="secondary" onPress={signOut} />
      </Card>

      {owner ? (
        <Card>
          <CardTitle title={t('Plan')} />
          <Text style={styles.subtitle}>
            {plan.paid ? t('Active until {date} (renews automatically).', { date: longDate(plan.until) })
              : plan.trial ? t('Free trial until {date}.', { date: longDate(plan.until) })
                : plan.active ? t('Active.') : t('Ended. The workspace is read-only.')}
          </Text>
          {!plan.paid && organization?.trial_ends_at ? <Text style={styles.hint}>{renewalHint()}</Text> : null}
        </Card>
      ) : null}

      <Card>
        <CardTitle title={t('Signed in on another device?')} note={t('Sign out everywhere else so you can sign in on a new device. This device stays signed in.')} />
        <Button label={t('Sign out of other devices')} variant="secondary" onPress={signOutOthers} />
      </Card>

      <Card>
        <CardTitle title={t('Delete account')} />
        <Notice tone="error">
          {owner
            ? t('If you are the only owner, this permanently deletes the {business} workspace: every customer, service job, product, invoice and feedback item, and the login of everyone you invited. This cannot be undone. GST rules require you to keep invoices for six years, so export them from the website first.', { business: businessName })
            : t('This permanently deletes your login and the feedback you submitted. This cannot be undone. {business} keeps the records it needs for service history and GST invoices.', { business: businessName })}
        </Notice>
        <Field label={t('Type DELETE to confirm')} value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
        <Button label={t('Delete account')} variant="danger" disabled={confirm.trim() !== 'DELETE' || Boolean(offlineSince)} onPress={remove} />
      </Card>
    </Screen>
  );
}
