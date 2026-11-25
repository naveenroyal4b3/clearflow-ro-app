import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { Button, Card, CardTitle, colors, Empty, Screen } from '@/components/ui';
import { detailsFor } from '@/lib/documents';
import { errorMessage, money } from '@/lib/format';
import { t, useLanguage } from '@/lib/i18n';
import { shareTextFile } from '@/lib/pdf';
import { useSession } from '@/lib/session';
import { gstr1, monthReport } from '@/lib/shared';

// The last six months as 'YYYY-MM', newest first.
function recentMonths() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
}
const monthLabel = (month: string, language: string) => new Intl.DateTimeFormat(language, { month: 'short', year: 'numeric' }).format(new Date(`${month}-01T00:00:00`));

// The owner's month at a glance: sales, collections, GST, service work and the best products and
// customers.
export default function Report() {
  const { data, profile, organization } = useSession();
  const { language } = useLanguage();
  const [months] = useState(recentMonths);
  const [month, setMonth] = useState(months[0]);
  if (profile?.role !== 'owner') return <Screen><Empty text={t('Only the business owner can see the report.')} /></Screen>;
  const report = monthReport(data, month);
  const previous = monthReport(data, months[months.indexOf(month) + 1] || '');
  const change = previous.sales ? Math.round((report.sales - previous.sales) / previous.sales * 100) : null;
  const gstFiles = gstr1(data.documents, month, doc => detailsFor(doc, data, organization));
  const shareFile = async (file: { name: string; text: string }) => {
    try { await shareTextFile(file.name, file.text); }
    catch (shareError) { Alert.alert(t('Export failed'), errorMessage(shareError, t('Try again.'))); }
  };

  return (
    <Screen>
      <Chips label={t('Month')} options={months} value={month} onChange={setMonth} format={value => monthLabel(value, language)} />
      <View style={local.metrics}>
        <Metric label={t('Sales')} value={money(report.sales)} note={change === null ? t('{count} invoices', { count: report.invoices }) : t('{change}% vs last month · {count} invoices', { change: change > 0 ? `+${change}` : String(change), count: report.invoices })} />
        <Metric label={t('Collected')} value={money(report.collected)} note={t('{amount} still pending', { amount: money(report.pending) })} />
        <Metric label={t('GST collected')} value={money(report.tax)} note={t('On this month’s invoices')} />
        <Metric label={t('Service jobs done')} value={String(report.jobsDone)} note={t('{count} still open', { count: report.jobsOpen })} />
      </View>
      <Card>
        <CardTitle title={t('Top products')} note={t('By sales this month')} />
        {report.topProducts.length ? report.topProducts.map((item, index) => (
          <Line key={item.name} rank={index + 1} name={item.name} detail={t('{count} sold', { count: item.qty })} amount={money(item.amount)} />
        )) : <Empty text={t('No invoices this month.')} />}
      </Card>
      <Card>
        <CardTitle title={t('Top customers')} note={t('By sales this month')} />
        {report.topCustomers.length ? report.topCustomers.map((item, index) => (
          <Line key={`${item.name}-${index}`} rank={index + 1} name={item.name || t('Customer')} amount={money(item.amount)} />
        )) : <Empty text={t('No invoices this month.')} />}
      </Card>
      <Card>
        <CardTitle title={t('Purchases')} note={t('{count} bills from suppliers', { count: report.purchases })} />
        <Line name={t('Bought (with GST)')} amount={money(report.purchased)} />
        <Line name={t('GST paid on purchases')} amount={money(report.inputTax)} />
        <Line name={t('GST to pay (collected − paid)')} amount={money(Math.max(0, report.tax - report.inputTax))} />
      </Card>
      <Card>
        <CardTitle title={t('GSTR-1 for your accountant')} note={t('{count} GST invoices this month', { count: gstFiles.invoices })} />
        <Text style={local.note}>{t('Three CSV files in the GST offline tool format: B2B, B2C small and HSN summary.')}</Text>
        {gstFiles.files.map(file => (
          <Button key={file.name} label={t('Share {file} ({count} rows)', { file: file.name, count: file.rows })} variant="secondary" onPress={() => shareFile(file)} />
        ))}
      </Card>
      <Text style={local.note}>{t('{count} quotations made this month. Cancelled invoices are not counted.', { count: report.quotations })}</Text>
    </Screen>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <View style={local.metric}>
      <Text style={local.note}>{label}</Text>
      <Text style={local.value}>{value}</Text>
      <Text style={local.note}>{note}</Text>
    </View>
  );
}

function Line({ rank, name, detail, amount }: { rank?: number; name: string; detail?: string; amount: string }) {
  return (
    <View style={local.line}>
      {rank ? <Text style={local.rank}>{rank}</Text> : null}
      <View style={{ flex: 1 }}>
        <Text style={local.name}>{name}</Text>
        {detail ? <Text style={local.note}>{detail}</Text> : null}
      </View>
      <Text style={local.amount}>{amount}</Text>
    </View>
  );
}

const local = StyleSheet.create({
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.paper, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 },
  value: { fontSize: 20, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, color: colors.muted },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.tealPale, color: colors.tealDark, textAlign: 'center', fontSize: 12, fontWeight: '800', lineHeight: 22 },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  amount: { fontSize: 14, fontWeight: '800', color: colors.ink, fontVariant: ['tabular-nums'] }
});
