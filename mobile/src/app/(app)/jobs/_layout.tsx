import { Stack } from 'expo-router';
import { headerWithFeedback } from '@/components/FeedbackButton';
import { colors } from '@/components/ui';
import { t } from '@/lib/i18n';

export default function JobsLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas }, headerRight: headerWithFeedback() }}>
      <Stack.Screen name="index" options={{ title: t('Service jobs') }} />
      <Stack.Screen name="edit" options={{ title: t('Service job'), presentation: 'modal' }} />
    </Stack>
  );
}
