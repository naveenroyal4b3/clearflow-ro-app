// App languages, shared with the web app (../src/i18n.js). Wrap every English text shown on screen
// in t(); use msg() for text kept in lookup tables and translated later with t(value).
// Choosing a language redraws the whole app (LanguageProvider remounts its children).
import { createContext, useContext, useState, type ReactNode } from 'react';
import 'expo-sqlite/localStorage/install';

type I18nModule = {
  languages: { code: string; name: string }[];
  getLanguage: () => string;
  setLanguage: (code: string) => void;
  t: (text: string, values?: Record<string, string | number>) => string;
  msg: <T extends string>(text: T) => T;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const i18n: I18nModule = require('../../../src/i18n.js');
export const { languages, t, msg } = i18n;

const LanguageContext = createContext<{ language: string; setLanguage: (code: string) => void }>({
  language: i18n.getLanguage(),
  setLanguage: () => {}
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState(i18n.getLanguage());
  const setLanguage = (code: string) => {
    i18n.setLanguage(code);
    setState(i18n.getLanguage());
  };
  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      <LanguageRoot key={language}>{children}</LanguageRoot>
    </LanguageContext.Provider>
  );
}

function LanguageRoot({ children }: { children: ReactNode }) {
  return children;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
