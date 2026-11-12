import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Text } from 'react-native';
import { Brand, Button, Card, Field, Heading, Notice, Screen, styles } from '@/components/ui';
import { GoogleButton } from '@/components/GoogleButton';
import { errorMessage } from '@/lib/format';
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
    if (error) { setAuthMessage(errorMessage(error, 'The account could not be created.')); return; }
    if (data.session) { await finishSignIn(data.session); return; }
    setAuthMessage('Check your email to confirm the owner account (look in Spam too), then sign in to finish business setup.');
    router.replace('/sign-in');
  };

  return (
    <Screen>
      <Card>
        <Brand />
        <Heading title="Create your workspace" subtitle="Set up the owner account for your water business." />
        {authMessage ? <Notice tone="warning">{authMessage}</Notice> : null}
        <GoogleButton />
        <Text style={[styles.hint, { textAlign: 'center' }]}>or use email</Text>
        <Field label="Your name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" maxLength={160} />
        <Field label="Phone number" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Business name" value={form.business} onChangeText={set('business')} maxLength={160} />
        <Field label="Business GSTIN (optional)" value={form.gstin} onChangeText={set('gstin')} autoCapitalize="characters" maxLength={15} />
        <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" hint="At least 8 characters." />
        <Button label="Create account" onPress={create} disabled={!ready} />
        <Button label="Already have an account? Sign in" variant="link" onPress={() => router.replace('/sign-in')} />
        <Text style={styles.hint}>
          By creating an account you agree to the{' '}
          <Text style={{ color: '#197c70' }} onPress={() => Linking.openURL(`https://${webAppAddress}/terms.html`)}>terms of service</Text> and{' '}
          <Text style={{ color: '#197c70' }} onPress={() => Linking.openURL(`https://${webAppAddress}/privacy.html`)}>privacy policy</Text>.
        </Text>
      </Card>
    </Screen>
  );
}
