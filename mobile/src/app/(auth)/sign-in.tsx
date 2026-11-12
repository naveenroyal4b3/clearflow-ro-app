import { router } from 'expo-router';
import { useState } from 'react';
import { Brand, Button, Card, Field, Heading, Notice, Screen, styles } from '@/components/ui';
import { GoogleButton } from '@/components/GoogleButton';
import { errorMessage } from '@/lib/format';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { Text } from 'react-native';

export default function SignIn() {
  const { finishSignIn, authMessage, setAuthMessage } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const signIn = async () => {
    setAuthMessage('');
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) { setAuthMessage(errorMessage(error, 'Sign-in failed. Check your details and try again.')); return; }
    await finishSignIn(data.session);
  };

  return (
    <Screen>
      <Card>
        <Brand />
        <Heading title="Welcome back" subtitle="Sign in to your water business workspace." />
        {authMessage ? <Notice tone="warning">{authMessage}</Notice> : null}
        <GoogleButton />
        <Text style={[styles.hint, { textAlign: 'center' }]}>or use email</Text>
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" />
        <Button label="Sign in" onPress={signIn} disabled={!email.trim() || password.length < 8} />
        <Button label="Forgot password?" variant="link" onPress={() => router.push('/forgot-password')} />
        <Button label="New business? Create an account" variant="link" onPress={() => router.push('/sign-up')} />
        <Text style={styles.hint}>Invited technicians, shops and customers: open the invitation email from your business to set your password, then sign in here.</Text>
      </Card>
    </Screen>
  );
}
