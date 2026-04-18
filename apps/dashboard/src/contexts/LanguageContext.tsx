import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Lang = 'en' | 'hi';

// ─── Translations ────────────────────────────────────────────────────────────
const translations: Record<string, Record<Lang, string>> = {
  // Navigation / Header
  'nav.liveOrders': { en: 'Live Orders', hi: 'Live Orders' },
  'nav.waiter': { en: 'Waiter Console', hi: 'Waiter Mode' },
  'nav.notifications': { en: 'Notifications', hi: 'Notifications' },
  'nav.settings': { en: 'Settings', hi: 'Settings' },
  'nav.language': { en: 'Language', hi: 'Bhasha' },
  'nav.english': { en: 'English', hi: 'English' },
  'nav.hinglish': { en: 'Hinglish', hi: 'Hinglish' },
  'nav.switchLang': { en: 'Switch Language', hi: 'Bhasha Badlo' },
  'nav.logout': { en: 'Logout', hi: 'Bahar Jao' },
  'nav.profile': { en: 'Profile', hi: 'Profile' },
  'nav.myWorkspace': { en: 'My Workspace', hi: 'Mera Workspace' },

  // Dashboard  
  'dash.dailyRevenue': { en: 'Daily Revenue', hi: 'Aaj Ki Kamai' },
  'dash.liveOrders': { en: 'Live Orders', hi: 'Live Orders' },
  'dash.occupancy': { en: 'Occupancy', hi: 'Jagah Bhari' },
  'dash.avgTicket': { en: 'Average Ticket', hi: 'Average Bill' },
  'dash.openTables': { en: 'Open Tables', hi: 'Tables Dekho' },
  'dash.openOrders': { en: 'Open Orders', hi: 'Orders Dekho' },
  'dash.openMenu': { en: 'Open Menu', hi: 'Menu Dekho' },
  'dash.openAnalytics': { en: 'Open Analytics', hi: 'Analytics Dekho' },
  'dash.tableMap': { en: 'Table Map', hi: 'Table Naksha' },
  'dash.popularItems': { en: 'Popular Items', hi: 'Bestseller Items' },
  'dash.revenueHourly': { en: 'Revenue (Hourly)', hi: 'Hourly Kamai' },
  'dash.occupancySnapshot': { en: 'Occupancy snapshot', hi: 'Abhi kitni jagah bhari hai' },
  'dash.noLiveOrders': { en: 'No live orders right now.', hi: 'Abhi koi order nahi hai.' },
  'dash.itemTrends': { en: 'Item trends appear after orders.', hi: 'Order aane ke baad dikhega.' },

  // Floor Plan / Tables
  'floor.zones': { en: 'Floors', hi: 'Floors' },
  'floor.addZone': { en: 'Add Floor', hi: 'Naya Floor Jodon' },
  'floor.addFloor': { en: 'Add Floor', hi: 'Naya Floor' },
  'floor.dashboard': { en: 'Floors & Tables', hi: 'Floors Aur Tables' },
  'floor.subtitle': { en: 'Manage your restaurant layout, tables, and QR codes across all floors.', hi: 'Apne restaurant ki floors aur tables manage karo.' },
  'floor.available': { en: 'Available', hi: 'Available' },
  'floor.occupied': { en: 'Occupied', hi: 'Occupied' },
  'floor.reserved': { en: 'Reserved', hi: 'Reserved' },
  'floor.cleaning': { en: 'Cleaning', hi: 'Cleaning' },
  'floor.totalTables': { en: 'total tables', hi: 'total tables' },
  'floor.enterZone': { en: 'ENTER FLOOR', hi: 'ANDAR JAO' },
  'floor.dynamicNodes': { en: 'Tables', hi: 'Tables' },
  'floor.collapseSidebar': { en: 'Collapse Sidebar', hi: 'Chota Karo' },
  'floor.viewZoneList': { en: 'View Floors', hi: 'Floors Dekho' },
  'floor.changeZone': { en: 'Change Floor', hi: 'Floor Badlo' },
  'floor.noZones': { en: 'No floors created yet.', hi: 'Abhi koi floor nahi.' },
  'floor.selectZone': { en: 'Select a floor to manage layout', hi: 'Layout dekhne ke liye floor chuno' },
  'floor.browseManage': { en: 'Browse & Manage', hi: 'Dekho aur Manage Karo' },
  'floor.openCategory': { en: 'Open Category', hi: 'Category Kholo' },
  'floor.openFloor': { en: 'Open Floor Map', hi: 'Floor Map Kholo' },

  // Menu
  'menu.categories': { en: 'Menu Categories', hi: 'Menu Categories' },
  'menu.subtitle': { en: 'Select a category to manage your items or use AI Magic Import to build instantly.', hi: 'Category chuno ya AI Magic Import use karo.' },
  'menu.createCategory': { en: 'Create New Category', hi: 'Naya Category Banao' },
  'menu.aiImport': { en: 'AI Magic Import', hi: 'AI Se Import Karo' },
  'menu.livePreview': { en: 'Live Preview', hi: 'Live Preview' },
  'menu.dragHint': { en: 'Drag to reorder • Inline edit on cards • Bulk show/hide supported', hi: 'Drag karo reorder ke liye • Card pe edit karo • Bulk hide/show available' },

  // Orders
  'orders.newOrders': { en: 'New Orders', hi: 'Naye Orders' },
  'orders.readyToServe': { en: 'Ready to Serve', hi: 'Serve Karne Ko Ready' },
  'orders.inKitchen': { en: 'In Kitchen', hi: 'Kitchen Mein' },
  'orders.served': { en: 'Served', hi: 'Serve Ho Gaya' },
  'orders.noOrders': { en: 'No Orders', hi: 'Koi Order Nahi' },

  // Invoices
  'invoice.register': { en: 'Invoice Register', hi: 'Invoice Register' },
  'invoice.volume': { en: 'Volume', hi: 'Total' },
  'invoice.revenue': { en: 'Revenue', hi: 'Kamai' },
  'invoice.tax': { en: 'Tax', hi: 'Tax' },
  'invoice.viewReceipt': { en: 'VIEW RECEIPT', hi: 'RECEIPT DEKHO' },
  'invoice.open': { en: 'OPEN', hi: 'KHOLO' },

  // General
  'general.loading': { en: 'Loading...', hi: 'Load ho raha hai...' },
  'general.save': { en: 'Save', hi: 'Save Karo' },
  'general.cancel': { en: 'Cancel', hi: 'Chhodo' },
  'general.delete': { en: 'Delete', hi: 'Hatao' },
  'general.edit': { en: 'Edit', hi: 'Edit Karo' },
  'general.add': { en: 'Add', hi: 'Jodon' },
  'general.close': { en: 'Close', hi: 'Band Karo' },
  'general.back': { en: 'Back', hi: 'Wapas Jao' },
  'general.search': { en: 'Search', hi: 'Dhundo' },
  'general.noData': { en: 'No data found', hi: 'Kuch nahi mila' },
  'general.upgrade': { en: 'Upgrade Now', hi: 'Upgrade Karo' },
  'general.viewDetails': { en: 'View Details', hi: 'Details Dekho' },
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

  // Update html lang attribute
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
