import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors } from './ui';

// A row of filter chips; scrolls sideways when there are more than fit.
export function Chips<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={local.row} accessibilityLabel={label}>
      {options.map(option => (
        <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: option === value }} onPress={() => onChange(option)} style={[local.chip, option === value && local.active]}>
          <Text style={[local.text, option === value && local.activeText]}>{option}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const local = StyleSheet.create({
  row: { gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
  active: { backgroundColor: colors.teal, borderColor: colors.teal },
  text: { fontSize: 13, color: colors.ink },
  activeText: { color: '#fff', fontWeight: '700' }
});
