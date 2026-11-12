import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlanNotice } from '@/components/PlanNotice';
import { Brand, Button, colors, Screen } from '@/components/ui';
import { useSession } from '@/lib/session';
import { roleLabels } from '@/lib/types';

type Item = { href: Href; label: string; note: string; icon: keyof typeof Ionicons.glyphMap; ownerOnly?: boolean };
const items: Item[] = [
  { href: '/more/account', label: 'My account', note: 'Plan, other devices, delete account', icon: 'person-circle-outline' },
  { href: '/more/business', label: 'Business details', note: 'Printed as the seller on invoices', icon: 'business-outline', ownerOnly: true },
  { href: '/more/team', label: 'Team & access', note: 'Invite technicians, shops and customers', icon: 'people-circle-outline', ownerOnly: true },
  { href: '/more/feedback', label: 'Feedback & issues', note: 'Report a problem or share an idea', icon: 'chatbubble-ellipses-outline' },
  { href: '/more/activity', label: 'Activity log', note: 'Who changed what, and when', icon: 'time-outline', ownerOnly: true }
];

export default function More() {
  const { profile, organization, signOut } = useSession();
  const owner = profile?.role === 'owner';
  return (
    <Screen>
      <PlanNotice />
      <View style={local.header}>
        <Brand />
        <Text style={local.who}>{`${profile?.full_name || profile?.login_email} · ${profile ? roleLabels[profile.role] : ''}`}</Text>
        <Text style={local.note}>{organization?.name}</Text>
      </View>
      <View style={local.list}>
        {items.filter(item => owner || !item.ownerOnly).map(item => (
          <Pressable key={item.label} style={local.item} accessibilityRole="button" onPress={() => router.push(item.href)}>
            <Ionicons name={item.icon} size={24} color={colors.teal} />
            <View style={{ flex: 1 }}>
              <Text style={local.label}>{item.label}</Text>
              <Text style={local.note}>{item.note}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}

const local = StyleSheet.create({
  header: { gap: 4 },
  who: { fontSize: 15, fontWeight: '700', color: colors.ink },
  list: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: 1, borderColor: colors.line },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 }
});
