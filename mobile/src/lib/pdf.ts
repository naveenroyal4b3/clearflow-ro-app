import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// Saves the HTML as a PDF named after the document (for example INV-26-27-0001.pdf) and opens
// Android's share sheet, so it can go to WhatsApp, email or Drive.
export async function sharePdf(html: string, name: string) {
  const { uri } = await Print.printToFileAsync({ html });
  const file = new File(uri);
  const named = new File(Paths.cache, `${name.replace(/[^\w.-]+/g, '-')}.pdf`);
  file.moveSync(named, { overwrite: true });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(named.uri, { mimeType: 'application/pdf', dialogTitle: name, UTI: 'com.adobe.pdf' });
}

// Opens Android's print screen, which can also save a PDF.
export async function printDocument(html: string) {
  await Print.printAsync({ html });
}
