import { Stack } from 'expo-router';
import { colors } from '@/components/ui';

export default function MoreLayout() {
  return (
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.paper }, headerTitleStyle: { color: colors.ink, fontWeight: '700' }, contentStyle: { backgroundColor: colors.canvas } }}>
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="account" options={{ title: 'My account' }} />
      <Stack.Screen name="business" options={{ title: 'Business details' }} />
      <Stack.Screen name="team" options={{ title: 'Team & access' }} />
      <Stack.Screen name="team-edit" options={{ title: 'Team member', presentation: 'modal' }} />
      <Stack.Screen name="feedback" options={{ title: 'Feedback & issues' }} />
      <Stack.Screen name="feedback-new" options={{ title: 'Submit feedback', presentation: 'modal' }} />
      <Stack.Screen name="activity" options={{ title: 'Activity log' }} />
    </Stack>
  );
}
