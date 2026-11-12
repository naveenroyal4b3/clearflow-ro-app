import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator, FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextInputProps, type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  ink: '#1c2927',
  muted: '#788480',
  line: '#e8ece8',
  paper: '#ffffff',
  canvas: '#f5f7f4',
  teal: '#197c70',
  tealDark: '#12594f',
  tealPale: '#e3f2ed',
  orange: '#bc7742',
  orangePale: '#fbefe4',
  red: '#b94a48',
  redPale: '#fae9e7',
  yellowPale: '#fff8e1',
  yellow: '#e7c66b'
};

export function Screen({ children, scroll = true, padded = true }: { children: ReactNode; scroll?: boolean; padded?: boolean }) {
  const content = <View style={padded ? styles.padded : undefined}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function Brand() {
  return (
    <View style={styles.brand}>
      <Image source={require('../../assets/icon.png')} style={styles.brandMark} accessibilityIgnoresInvertColors />
      <View>
        <Text style={styles.brandName}>clearflow</Text>
        <Text style={styles.brandCaption}>WATER SYSTEMS · OPERATIONS</Text>
      </View>
    </View>
  );
}

export function Heading({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.heading}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function CardTitle({ title, note, action }: { title: string; note?: string; action?: ReactNode }) {
  return (
    <View style={styles.cardHead}>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>{title}</Text>
        {note ? <Text style={styles.cardNote}>{note}</Text> : null}
      </View>
      {action}
    </View>
  );
}

type ButtonProps = { label: string; onPress: () => void | Promise<void>; variant?: 'primary' | 'secondary' | 'danger' | 'link'; disabled?: boolean; icon?: ReactNode; testID?: string };

// Shows a spinner and ignores taps while an async onPress is running.
export function Button({ label, onPress, variant = 'primary', disabled, icon, testID }: ButtonProps) {
  const [busy, setBusy] = useState(false);
  const press = async () => {
    if (busy) return;
    setBusy(true);
    try { await onPress(); } finally { setBusy(false); }
  };
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={press}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, inactive && styles.inactive]}
    >
      {busy ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.teal} /> : (
        <View style={styles.buttonInner}>
          {icon}
          <Text style={[styles.buttonText, variant !== 'primary' && variant !== 'danger' && styles.buttonTextAlt]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

type FieldProps = Omit<TextInputProps, 'style'> & { label: string; hint?: string; keyboardType?: KeyboardTypeOptions };

export function Field({ label, hint, multiline, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        accessibilityLabel={label}
        {...input}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

type Option = { value: string; label: string };

// A field that opens a list to choose from.
export function Select({ label, value, options, onChange, placeholder = 'Select' }: { label: string; value: string; options: Option[]; onChange: (value: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(option => option.value === value);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={label} style={styles.input} onPress={() => setOpen(true)}>
        <Text style={selected ? styles.selectText : styles.placeholder}>{selected?.label || placeholder}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={option => option.value || '_none'}
              renderItem={({ item }) => (
                <Pressable style={styles.option} onPress={() => { onChange(item.value); setOpen(false); }}>
                  <Text style={[styles.optionText, item.value === value && styles.optionSelected]}>{item.label}</Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

export function Notice({ title, children, tone = 'info' }: { title?: string; children?: ReactNode; tone?: 'info' | 'warning' | 'error' }) {
  return (
    <View style={[styles.notice, tone === 'warning' && styles.noticeWarning, tone === 'error' && styles.noticeError]} accessibilityRole="alert">
      <Text style={styles.noticeText}>
        {title ? <Text style={styles.noticeTitle}>{title} </Text> : null}
        {children}
      </Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'good' | 'warning' | 'bad' }) {
  return <Text style={[styles.badge, styles[`badge_${tone}`]]}>{label}</Text>;
}

export function Row({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas },
  scroll: { flexGrow: 1 },
  padded: { padding: 16, gap: 14 },
  flex: { flex: 1 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  brandMark: { width: 44, height: 44, borderRadius: 12 },
  brandName: { fontSize: 22, fontWeight: '800', color: colors.ink },
  brandCaption: { fontSize: 10, letterSpacing: 1, color: colors.muted },
  heading: { gap: 4 },
  eyebrow: { color: colors.teal, fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  card: { backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  cardNote: { fontSize: 12, color: colors.muted, marginTop: 2 },
  button: { minHeight: 48, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.teal },
  secondary: { backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line },
  danger: { backgroundColor: colors.red },
  link: { backgroundColor: 'transparent', minHeight: 40 },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  buttonTextAlt: { color: colors.teal },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: '#5f6d68' },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#d9e1dc', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#fff', fontSize: 15, color: colors.ink, justifyContent: 'center' },
  multiline: { minHeight: 90, paddingTop: 12, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: colors.muted },
  selectText: { fontSize: 15, color: colors.ink },
  placeholder: { fontSize: 15, color: colors.muted },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { maxHeight: '70%', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingTop: 16, paddingBottom: 24 },
  sheetTitle: { fontSize: 16, fontWeight: '700', paddingHorizontal: 20, paddingBottom: 8, color: colors.ink },
  option: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderColor: colors.line },
  optionText: { fontSize: 15, color: colors.ink },
  optionSelected: { color: colors.teal, fontWeight: '700' },
  notice: { borderWidth: 1, borderColor: '#dfece4', backgroundColor: '#f0f7f1', borderRadius: 10, padding: 12 },
  noticeWarning: { borderColor: colors.yellow, backgroundColor: colors.yellowPale },
  noticeError: { borderColor: '#efc5c2', backgroundColor: colors.redPale },
  noticeText: { fontSize: 13, color: '#4d5f58', lineHeight: 19 },
  noticeTitle: { fontWeight: '700', color: '#335c4c' },
  empty: { textAlign: 'center', color: colors.muted, paddingVertical: 20, fontSize: 14 },
  badge: { overflow: 'hidden', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, fontSize: 12, fontWeight: '700' },
  badge_neutral: { backgroundColor: colors.line, color: colors.ink },
  badge_good: { backgroundColor: colors.tealPale, color: colors.tealDark },
  badge_warning: { backgroundColor: colors.orangePale, color: colors.orange },
  badge_bad: { backgroundColor: colors.redPale, color: colors.red },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  divider: { height: 1, backgroundColor: colors.line }
});
