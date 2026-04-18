import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'en' | 'hi';

// ─── Customer App Translations ───────────────────────────────────────────────
const translations: Record<string, Record<Lang, string>> = {
  // Onboarding / Entry
  'entry.orderFrom': { en: 'Order from', hi: 'Order karo' },
  'entry.startWith': { en: 'Start with your name and phone number so the restaurant can keep your menu, tracker, and bill linked to the right session.', hi: 'Apna naam aur number do taaki restaurant aapka order track kar sake.' },
  'entry.displayName': { en: 'Display Name', hi: 'Aapka Naam' },
  'entry.phone': { en: 'Phone Number', hi: 'Mobile Number' },
  'entry.dineIn': { en: 'Dine In', hi: 'Andar Khana' },
  'entry.takeaway': { en: 'Takeaway', hi: 'Le Jaenge' },
  'entry.continue': { en: 'Continue to menu', hi: 'Menu Dekho' },
  'entry.signingIn': { en: 'Signing you in...', hi: 'Log in ho raha hai...' },
  'entry.directOrdering': { en: 'Direct ordering', hi: 'Direct Order' },
  'entry.secureSession': { en: 'Secure session', hi: 'Safe Session' },
  'entry.validationError': { en: 'Enter a valid customer name and 10-digit mobile number.', hi: 'Sahi naam aur 10 digit ka number daalo.' },
  'entry.error': { en: 'Unable to start ordering right now.', hi: 'Abhi order nahi ho sakta. Dobara try karo.' },

  // Header / Nav
  'header.tracker': { en: 'Tracker', hi: 'Track Karo' },
  'header.history': { en: 'History', hi: 'Purane Orders' },
  'header.table': { en: 'Table', hi: 'Table' },
  'header.pickupOrdering': { en: 'Pickup ordering', hi: 'Pickup Order' },
  'header.activeSession': { en: 'ACTIVE SESSION | Add more items any time', hi: 'SESSION ACTIVE | Aur items add karo' },
  'header.openTracker': { en: 'Open tracker', hi: 'Track Karo' },
  'header.language': { en: 'EN', hi: 'HI' },

  // Search / Filter
  'search.placeholder': { en: 'Search dishes, ingredients, combos...', hi: 'Khana dhundo...' },
  'search.noResults': { en: 'No matching dishes found', hi: 'Kuch nahi mila' },
  'search.tryDiff': { en: 'Try a different ingredient, dish name, or category.', hi: 'Alag naam ya category try karo.' },
  'filter.all': { en: 'All', hi: 'Sab' },
  'filter.veg': { en: 'Veg', hi: 'Veg' },
  'filter.nonveg': { en: 'Non-Veg', hi: 'Non-Veg' },
  'filter.egg': { en: 'Egg', hi: 'Egg' },

  // Categories
  'cat.browse': { en: 'Browse categories', hi: 'Categories Dekho' },
  'cat.jump': { en: 'Jump straight to the section you want.', hi: 'Jo chahiye us section pe jao.' },

  // Cart
  'cart.reviewOrder': { en: 'Review order', hi: 'Order Check Karo' },
  'cart.gstEta': { en: 'GST and ETA included', hi: 'GST + Samay Included' },
  'cart.categories': { en: 'Categories', hi: 'Categories' },

  // Misc
  'misc.menuUnavailable': { en: 'Menu unavailable right now', hi: 'Menu abhi available nahi hai' },
  'misc.checkConnection': { en: "We couldn't load this restaurant menu. Check the connection and try again.", hi: 'Menu load nahi hua. Connection check karo.' },
  'misc.retry': { en: 'Retry', hi: 'Dobara Try Karo' },
  'misc.scanQR': { en: 'Scan a QR code to order', hi: 'Order ke liye QR scan karo' },
  'misc.askServer': { en: 'Ask your server for the table QR code.', hi: 'Staff se table ka QR maango.' },
};

// ─── Context ─────────────────────────────────────────────────────────────────
interface LanguageContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

// ─── Provider ────────────────────────────────────────────────────────────────
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const stored = localStorage.getItem('rf_lang');
    return (stored === 'hi' ? 'hi' : 'en') as Lang;
  });

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('rf_lang', l);
  };

  const t = (key: string): string => {
    return translations[key]?.[lang] ?? translations[key]?.['en'] ?? key;
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────
export function useLanguage() {
  return useContext(LanguageContext);
}
