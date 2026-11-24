import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, CardTitle, colors, styles as ui } from './ui';
import { money, shortDate, today } from '@/lib/format';
import { t } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { serviceDue, unpaidInvoices, whatsappLink } from '@/lib/shared';

function WhatsAppButton({ phone, text, label }: { phone: string; text: string; label: string }) {
  const link = whatsappLink(phone, text);
  if (!link) return null;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={8} onPress={() => Linking.openURL(link)} style={local.round}>
      <Ionicons name="logo-whatsapp" size={18} color="#1f9d55" />
    </Pressable>
  );
}

// Customers whose regular service is due within a week (or overdue) and not yet booked. For the
// owner: WhatsApp the customer, or open a new service job for them.
export function ServiceDueCard() {
  const { profile, organization, data } = useSession();
  if (profile?.role !== 'owner') return null;
  const due = serviceDue(data.customers, data.jobs, today());
  if (!due.length) return null;
  const business = organization?.name || '';
  return (
    <Card>
      <CardTitle title={t('Service due')} note={t('{count} customers due this week or overdue', { count: due.length })} />
      {due.slice(0, 6).map(({ customer, due: date, daysLeft }) => {
        const appliance = customer.purifier || t('appliance');
        const when = daysLeft < 0 ? t('Overdue since {date}', { date: shortDate(date) }) : daysLeft === 0 ? t('Due today') : t('Due {date}', { date: shortDate(date) });
        const message = t('Hello {name}, your {appliance} service is due on {date}. Reply to book a visit. – {business}', { name: customer.name, appliance, date: shortDate(date), business });
        return (
          <View key={customer.id} style={local.row}>
            <View style={ui.flex}>
              <Text style={local.title}>{customer.name}</Text>
              <Text style={[local.note, daysLeft < 0 && local.late]}>{`${appliance} · ${when}`}</Text>
            </View>
            <WhatsAppButton phone={customer.phone} text={message} label={t('WhatsApp {name}', { name: customer.name })} />
            <Pressable accessibilityRole="button" accessibilityLabel={t('Schedule service')} hitSlop={8} style={local.round}
              onPress={() => router.push({ pathname: '/jobs/edit', params: { customerId: customer.id, type: 'Service / cleaning' } })}>
              <Ionicons name="calendar-outline" size={18} color={colors.teal} />
            </Pressable>
          </View>
        );
      })}
      {due.length > 6 ? <Text style={local.note}>{t('and {count} more', { count: due.length - 6 })}</Text> : null}
    </Card>
  );
}

// Invoices not yet paid, oldest first, with a WhatsApp reminder for each. For the owner.
export function PaymentsDueCard() {
  const { profile, organization, data } = useSession();
  if (profile?.role !== 'owner') return null;
  const unpaid = unpaidInvoices(data.documents, today());
  if (!unpaid.length) return null;
  const total = unpaid.reduce((sum, entry) => sum + entry.amount, 0);
  const overdue = unpaid.filter(entry => entry.daysOverdue > 0).length;
  const business = organization?.name || '';
  const customer = (id: string) => data.customers.find(item => item.id === id);
  return (
    <Card>
      <CardTitle title={t('Payments pending')} note={t('{amount} across {count} invoices · {overdue} overdue', { amount: money(total), count: unpaid.length, overdue })} />
      {unpaid.slice(0, 5).map(({ doc, amount, daysOverdue }) => {
        const person = customer(doc.customerId);
        const message = t('Hello {name}, a friendly reminder that invoice {number} for {amount} is pending. Please pay at your convenience. – {business}', { name: person?.name || doc.buyer.name, number: doc.id, amount: money(amount), business });
        return (
          <Pressable key={doc.id} style={local.row} onPress={() => router.push({ pathname: '/sales/[id]', params: { id: doc.id } })}>
            <View style={ui.flex}>
              <Text style={local.title}>{person?.name || doc.buyer.name}</Text>
              <Text style={[local.note, daysOverdue > 0 && local.late]}>{`${doc.id} · ${money(amount)} · ${daysOverdue > 0 ? t('{count} days overdue', { count: daysOverdue }) : t('Due {date}', { date: shortDate(doc.due || doc.date) })}`}</Text>
            </View>
            {person ? <WhatsAppButton phone={person.phone} text={message} label={t('Send payment reminder')} /> : null}
          </Pressable>
        );
      })}
      {unpaid.length > 5 ? <Button label={t('See all invoices')} variant="link" onPress={() => router.push('/sales')} /> : null}
    </Card>
  );
}

const local = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.ink },
  note: { fontSize: 12, color: colors.muted, marginTop: 2 },
  late: { color: colors.red, fontWeight: '700' },
  round: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper }
});
