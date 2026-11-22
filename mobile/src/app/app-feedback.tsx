import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Button, Field, Notice, Screen } from '@/components/ui';
import { Chips } from '@/components/Chips';
import { errorMessage } from '@/lib/format';
import { msg, t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { sendAppFeedback } from '@/lib/shared';
import { supabase } from '@/lib/supabase';

const kinds = [msg('Suggestion'), msg('Problem')] as const;
const appVersion = `${Constants.expoConfig?.version ?? ''} (${Constants.expoConfig?.android?.versionCode ?? ''})`;

// A suggestion or problem about the app, sent to the TiruFix team (not to the business).
export default function AppFeedback() {
  const { page = '' } = useLocalSearchParams<{ page?: string }>();
  const { offlineSince } = useSession();
  const [kind, setKind] = useState<(typeof kinds)[number]>('Suggestion');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    setError('');
    setSending(true);
    try {
      await sendAppFeedback(supabase, { kind, page, message, platform: Platform.OS === 'ios' ? 'ios' : 'android', appVersion });
    } catch (sendError) {
      setError(errorMessage(sendError, t('Not sent. Try again.')));
      setSending(false);
      return;
    }
    Alert.alert(t('Thank you! Your feedback was sent.'));
    router.back();
  };

  return (
    <Screen>
      <Notice>{t('Ideas to improve the app, or something that is not working')}</Notice>
      {offlineSince ? <Notice tone="warning">{t('You are offline. Feedback can be sent once you are back online.')}</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Chips options={kinds} value={kind} onChange={setKind} label={t('What would you like to share? *')} />
      <Field label={t('Your message *')} value={message} onChangeText={setMessage} multiline maxLength={2000} />
      <Notice>{t('This goes to the TiruFix app team.')}</Notice>
      <Button label={t('Send feedback')} onPress={send} disabled={sending || Boolean(offlineSince) || !message.trim()} />
    </Screen>
  );
}
