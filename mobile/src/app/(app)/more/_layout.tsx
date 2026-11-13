import { Stack } from 'expo-router';
import { colors } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: t('More') }} />
      <Stack.Screen name="account" options={{ title: t('My account') }} />
      <Stack.Screen name="business" options={{ title: t('Business details') }} />
      <Stack.Screen name="team" options={{ title: t('Team & access') }} />
      <Stack.Screen name="team-edit" options={{ title: t('Team member'), presentation: 'modal' }} />
      <Stack.Screen name="feedback" options={{ title: t('Feedback & issues') }} />
      <Stack.Screen name="feedback-new" options={{ title: t('Submit feedback'), presentation: 'modal' }} />
      <Stack.Screen name="language" options={{ title: t('Language') }} />
      <Stack.Screen name="activity" options={{ title: t('Activity log') }} />
    </Stack>
  );
}
