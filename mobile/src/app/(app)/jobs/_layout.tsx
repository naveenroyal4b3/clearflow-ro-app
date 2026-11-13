import { Stack } from 'expo-router';
import { colors } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: t('Service jobs') }} />
      <Stack.Screen name="edit" options={{ title: t('Service job'), presentation: 'modal' }} />
    </Stack>
  );
}
