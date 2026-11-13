import { Chips } from './Chips';
import { languages, t, useLanguage } from '@/lib/i18n';

const names = new Map(languages.map(language => [language.code, language.name]));

// The app languages, each named in its own script. Choosing one redraws the app in it.
export function LanguagePicker() {
  const { language, setLanguage } = useLanguage();
  return (
    <Chips
      label={t('Language')}
      options={languages.map(item => item.code)}
      value={language}
      onChange={setLanguage}
      format={code => names.get(code) || code}
    />
  );
}
