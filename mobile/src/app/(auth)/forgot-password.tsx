import { router } from 'expo-router';
import { useState } from 'react';
import { Brand, Button, Card, Field, Heading, Notice, Screen } from '@/components/ui';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

// The reset email opens the website, where the new password is chosen. A password reset also
// signs out every other device, which is the way back in when the other phone is lost.
export default function ForgotPassword() {
  const { setAuthMessage } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const send = async () => {
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (resetError) { setError(resetError.message); return; }
    setAuthMessage(t('If that email has an account, a password reset link is on its way. Open it, choose a new password, then sign in here.'));
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <Card>
        <Brand />
        <Heading title={t('Reset your password')} subtitle={t("Enter your account email and we'll send you a link to choose a new password.")} />
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label={t('Email')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Button label={t('Send reset link')} onPress={send} disabled={!email.trim()} />
        <Button label={t('Back to sign in')} variant="link" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}
