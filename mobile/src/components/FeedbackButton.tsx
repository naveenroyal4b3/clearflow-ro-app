import Ionicons from '@expo/vector-icons/Ionicons';
import { router, usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from './ui';
import { t } from '@/lib/i18n';

// Opens the form for sending a suggestion or problem to the Clearflow team, noting the screen it
// was opened from. Shown in the header of every screen.
export function FeedbackButton() {
  const page = usePathname();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('Send feedback to Clearflow')} onPress={() => router.push({ pathname: '/app-feedback', params: { page } })} hitSlop={12} style={{ paddingHorizontal: 8 }}>
      <Ionicons name="chatbubble-ellipses-outline" size={23} color={colors.teal} />
    </Pressable>
  );
}

// A header's right side: the screen's own button, if any, then the feedback button.
export function headerWithFeedback(action?: ReactNode) {
  return function HeaderRight() {
    return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{action}<FeedbackButton /></View>;
  };
}
