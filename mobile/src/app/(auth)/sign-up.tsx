import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { Brand, Button, Card, Field, Heading, Notice, Screen, styles } from '@/components/ui';
import { GoogleButton } from '@/components/GoogleButton';
import { errorMessage } from '@/lib/format';
import { t } from '@/lib/i18n';
import { webAppAddress } from '@/lib/plan';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const { finishSignIn, authMessage, setAuthMessage } = useSession();
  const [form, setForm] = useState({ fullName: '', phone: '', business: '', gstin: '', email: '', password: '' });
  const set = (key: keyof typeof form) => (value: string) => setForm(current => ({ ...current, [key]: value }));
  const ready = form.fullName.trim() && form.phone.trim() && form.business.trim() && form.email.trim() && form.password.length >= 8;

  const create = async () => {
    setAuthMessage('');
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: { data: { full_name: form.fullName.trim(), phone: form.phone.trim(), organization_name: form.business.trim(), gstin: form.gstin.trim() } }
    });
    if (error) { setAuthMessage(errorMessage(error, t('The account could not be created.'))); return; }
    if (data.session) { await finishSignIn(data.session); return; }
    setAuthMessage(t('Check your email to confirm the owner account (look in Spam too), then sign in to finish business setup.'));
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <Card>
        <Brand />
        <Heading title={t('Create your workspace')} subtitle={t('Set up the owner account for your water business.')} />
        {authMessage ? <Notice tone="warning">{authMessage}</Notice> : null}
        <GoogleButton />
        <Text style={[styles.hint, { textAlign: 'center' }]}>{t('or use email')}</Text>
        <Field label={t('Your name')} value={form.fullName} onChangeText={set('fullName')} autoComplete="name" maxLength={160} />
        <Field label={t('Phone number')} value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
        <Field label={t('Business name')} value={form.business} onChangeText={set('business')} maxLength={160} />
        <Field label={t('Business GSTIN (optional)')} value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
        <Field label={t('Email')} value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label={t('Password')} value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" hint={t('At least 8 characters.')} />
        <Button label={t('Create account')} onPress={create} disabled={!ready} />
        <Button label={t('Already have an account? Sign in')} variant="link" onPress={() => router.replace('/sign-in')} />
        <Text style={styles.hint}>
          {t('By creating an account you agree to the {terms} and {privacy}.').split(/(\{terms\}|\{privacy\})/).map((part, index) => (
            part === '{terms}' ? <Text key={index} style={{ color: '#197c70' }} onPress={() => Linking.openURL(`https://${webAppAddress}/terms.html`)}>{t('terms of service')}</Text>
              : part === '{privacy}' ? <Text key={index} style={{ color: '#197c70' }} onPress={() => Linking.openURL(`https://${webAppAddress}/privacy.html`)}>{t('privacy policy')}</Text>
                : part
          ))}
        </Text>
      </Card>
    </Screen>
  );
}
