import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { colors, Notice, Screen } from '@/components/ui';
import { t } from '@/lib/i18n';
import { configured } from '@/lib/supabase';
import { useSession } from '@/lib/session';

// Sends the user to the right place once the saved session has been checked.
export default function Start() {
  const { status } = useSession();
  if (!configured) {
    return <Screen><Notice tone="error" title={t('Not configured.')}>{t('This build has no Supabase settings.')}</Notice></Screen>;
  }
  if (status === 'signed-out') return <Redirect href="/sign-in" />;
  if (status === 'needs-setup') return <Redirect href="/setup" />;
  if (status === 'ready') return <Redirect href="/home" />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
      <ActivityIndicator size="large" color={colors.teal} />
    </View>
  );
}
