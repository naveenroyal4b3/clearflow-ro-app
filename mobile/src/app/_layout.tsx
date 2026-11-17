import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/components/ui';
import { useInAppUpdates } from '@/lib/inAppUpdates';
import { LanguageProvider, t } from '@/lib/i18n';
import { SessionProvider, useSession } from '@/lib/session';

function Navigator() {
  const { status } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={status === 'signed-out'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'needs-setup'}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={status === 'ready'}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="app-feedback" options={{ headerShown: true, presentation: 'modal', title: t('Send feedback to Clearflow'), headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' } }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useInAppUpdates();
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        {/* Changing the language redraws the screens but keeps the signed-in session. */}
        <LanguageProvider>
          <Navigator />
        </LanguageProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
