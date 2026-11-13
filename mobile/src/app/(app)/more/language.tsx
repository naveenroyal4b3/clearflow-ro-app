import { Text } from 'react-native';
import { LanguagePicker } from '@/components/LanguagePicker';
import { Card, CardTitle, Screen, styles } from '@/components/ui';
import { t } from '@/lib/i18n';

// Changes the app's language on this device. Printed quotations and invoices stay in English.
export default function Language() {
  return (
    <Screen>
      <Card>
        <CardTitle title={t('Language')} note={t('Choose the language of the app')} />
        <LanguagePicker />
        <Text style={styles.hint}>{t('Quotations and invoices are always printed in English.')}</Text>
      </Card>
    </Screen>
  );
}
