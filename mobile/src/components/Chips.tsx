import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, OptionSheet } from './ui';
import { t } from '@/lib/i18n';

// A row of filter chips; scrolls sideways when there are more than fit. Options are English values,
// shown translated unless format is given.
export function Chips<T extends string>({ options, value, onChange, label, format = t }: { options: readonly T[]; value: T; onChange: (value: T) => void; label: string; format?: (value: T) => string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.row} accessibilityLabel={label}>
      {options.map(option => (
        <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === value }} onPress={() => onChange(option)} style={[local.chip, option === value && local.active]}>
          <Text style={[local.text, option === value && local.activeText]}>{format(option)}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// One chip showing the current choice; tapping it opens the full list. Highlighted when the choice
// isn't the first (the "all" choice).
export function ChipMenu({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const active = value !== options[0]?.value;
  const selected = options.find(option => option.value === value) || options[0];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[local.chip, local.menu, active && local.active]}>
        <Text style={[local.text, active && local.activeText]} numberOfLines={1}>{selected?.label}</Text>
        <Ionicons name="chevron-down" size={14} color={active ? '#fff' : colors.muted} />
      </Pressable>
      <OptionSheet title={label} open={open} onClose={() => setOpen(false)} options={options} value={value} onChange={onChange} />
    </>
  );
}

const local = StyleSheet.create({
  row: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  menu: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 220 },
  active: { backgroundColor: colors.teal, borderColor: colors.teal },
  text: { fontSize: 13, color: colors.ink },
  activeText: { color: '#fff', fontWeight: '700' }
});
