import { Text } from 'react-native';
import { Button } from './ui';
import { errorMessage } from '@/lib/format';
import { googleWebClientId, signInWithGoogle } from '@/lib/google';
import { useSession } from '@/lib/session';

// "Continue with Google". Hidden when the build has no Google client ID.
export function GoogleButton() {
  const { finishSignIn, setAuthMessage } = useSession();
  if (!googleWebClientId) return null;
  const press = async () => {
    setAuthMessage('');
    try {
      const session = await signInWithGoogle();
      if (session) await finishSignIn(session);
    } catch (error) {
      setAuthMessage(errorMessage(error, 'Google sign-in failed. Try again.'));
    }
  };
  return <Button label="Continue with Google" variant="secondary" onPress={press} icon={<Text style={{ fontSize: 17, fontWeight: '800', color: '#4285F4' }}>G</Text>} />;
}
