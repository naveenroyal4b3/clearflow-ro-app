import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Pressable, Text, View } from 'react-native';
import { styles } from './ui';
import { formatDate, today } from '@/lib/format';
import { t } from '@/lib/i18n';

// A date field that opens Android's calendar. Values are YYYY-MM-DD strings, like the database.
export function DateField({ label, value, onChange, optional, maximumDate, minimumDate }: {
  label: string; value: string; onChange: (value: string) => void; optional?: boolean; maximumDate?: Date; minimumDate?: Date;
}) {
  const open = () => DateTimePickerAndroid.open({
    value: value ? new Date(`${value}T00:00:00`) : new Date(),
    mode: 'date',
    maximumDate,
    minimumDate,
    onChange: (event, date) => { if (event.type === 'set' && date) onChange(today(date)); }
  });
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? formatDate(value) : t('not set')}`} style={[styles.input, { flex: 1 }]} onPress={open}>
          <Text style={value ? styles.selectText : styles.placeholder}>{value ? formatDate(value) : t('Choose a date')}</Text>
        </Pressable>
        {optional && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('Clear {label}', { label })} style={[styles.input, { paddingHorizontal: 14 }]} onPress={() => onChange('')}>
            <Text style={styles.placeholder}>{t('Clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
