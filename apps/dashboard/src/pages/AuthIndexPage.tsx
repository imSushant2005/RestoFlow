import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, LayoutDashboard, Receipt, Store, Users } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';
import analyticsPreview from '../assets/preview/analytics.png';
import customerMenuPreview from '../assets/preview/customer-menu.png';
import liveOrdersPreview from '../assets/preview/live-orders-pipeline.png';
import tablesPreview from '../assets/preview/tables-qr.png';

type AuthIndexPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

type SiteLanguage = 'en' | 'hi' | 'hinglish';

const frames = [
  { src: customerMenuPreview, alt: 'Customer ordering', tag: 'Customer' },
  { src: liveOrdersPreview, alt: 'Live operations', tag: 'Operations' },
  { src: tablesPreview, alt: 'Tables and QR', tag: 'Tables' },
  { src: analyticsPreview, alt: 'Analytics and finance', tag: 'Finance' },
] as const;

const copy = {
  en: {
    language: 'Language',
    badge: 'Restaurant operating system',
    hero: 'Operate menu, tables, kitchen, waiter, billing, and growth from one calm control center.',
    body: 'RestoFlow helps restaurants run faster service with clearer staff coordination, cleaner billing, and a more trustworthy customer flow. Start with a 30-day free trial, finish setup in about 3 minutes, and go live after verification.',
    chips: ['30-day free trial', '3-minute setup', 'Verification call included'],
    primary: 'Start free trial',
    secondary: 'Book walkthrough',
    previewTitle: 'See how the full restaurant flow connects.',
    scenes: [
      'Guests scan, browse, and order from mobile.',
      'Kitchen, waiter, and cash desk stay aligned in real time.',
      'Tables, floors, and QR access stay mapped to service.',
      'Owners get cleaner billing, exports, and reporting.',
    ],
    problemTitle: 'What RestoFlow fixes',
    problems: [
      'Disconnected tools slow service.',
      'Rush-hour handoffs become unclear.',
      'Customer ordering and billing lose trust.',
    ],
    featureTitle: 'Built for real restaurant operations',
    features: [
      ['Menu and ordering', 'Create categories, modifiers, photos, and digital ordering flows from one workspace.'],
      ['Live floor and kitchen coordination', 'Track tables, active sessions, readiness, waiter delivery flow, and assistance calls.'],
      ['Billing and reconciliation', 'Close sessions with GST-ready totals, payment states, and exportable invoice records.'],
      ['Role-based access', 'Owners, managers, cashiers, kitchen, and waiter staff see only the tools they need.'],
    ],
    flowTitle: 'Go live in a practical sequence',
    flow: [
      'Create the workspace and complete the business profile.',
      'Import the menu and verify prices, modifiers, and photos.',
      'Map tables and QR codes for dine-in sessions.',
      'Run one test journey from customer order to paid bill.',
    ],
    trustTitle: 'India-first launch readiness',
    trust: [
      '30-day trial for every new business.',
      'Privacy and terms pages included.',
      'Customer account control and deactivation flow supported.',
      'Designed for mobile use across customer and staff roles.',
    ],
    finalTitle: 'Launch with more confidence, not more chaos.',
    finalBody: 'RestoFlow is designed to become the daily operating system your restaurant team can trust from first QR scan to final payment.',
    finalPrimary: 'Create workspace',
    finalSecondary: 'Login',
  },
  hi: {
    language: 'भाषा',
    badge: 'रेस्टोरेंट ऑपरेटिंग सिस्टम',
    hero: 'मेन्यू, टेबल, किचन, वेटर, बिलिंग और ग्रोथ को एक ही शांत कंट्रोल सेंटर से चलाइए।',
    body: 'RestoFlow रेस्टोरेंट्स को तेज़ सर्विस, साफ़ स्टाफ coordination, बेहतर billing और भरोसेमंद customer flow देता है। 30 दिन का फ्री ट्रायल शुरू करें, लगभग 3 मिनट में setup करें, और verification के बाद live हो जाएँ।',
    chips: ['30 दिन फ्री ट्रायल', 'लगभग 3 मिनट setup', 'Verification शामिल'],
    primary: 'फ्री ट्रायल शुरू करें',
    secondary: 'डेमो बुक करें',
    previewTitle: 'देखिए पूरा restaurant flow कैसे जुड़ता है।',
    scenes: [
      'गेस्ट मोबाइल से scan करके browse और order करते हैं।',
      'Kitchen, waiter और cash desk real time में sync रहते हैं।',
      'Tables, floors और QR access service से जुड़े रहते हैं।',
      'Owners को cleaner billing, exports और reporting मिलती है।',
    ],
    problemTitle: 'RestoFlow क्या सुधारता है',
    problems: [
      'अलग tools service को slow कर देते हैं।',
      'Rush-hour handoff साफ़ नहीं रहता।',
      'Customer ordering और billing trust खो देते हैं।',
    ],
    featureTitle: 'असल restaurant operations के लिए built',
    features: [
      ['Menu और ordering', 'Categories, modifiers, photos और digital ordering flows एक ही workspace में manage कीजिए।'],
      ['Live floor और kitchen coordination', 'Tables, active sessions, readiness, waiter delivery flow और assistance calls track कीजिए।'],
      ['Billing और reconciliation', 'GST-ready totals, payment states और exportable invoice records के साथ sessions close कीजिए।'],
      ['Role-based access', 'Owner, manager, cashier, kitchen और waiter को वही tools मिलते हैं जो उनके काम के हैं।'],
    ],
    flowTitle: 'एक practical sequence में live जाइए',
    flow: [
      'Workspace बनाइए और business profile पूरा कीजिए।',
      'Menu import करके prices, modifiers और photos verify कीजिए।',
      'Dine-in sessions के लिए tables और QR codes map कीजिए।',
      'Customer order से paid bill तक एक full test journey चलाइए।',
    ],
    trustTitle: 'India-first launch readiness',
    trust: [
      'हर नए business के लिए 30 दिन trial.',
      'Privacy और terms pages शामिल हैं।',
      'Customer account control और deactivation flow supported है।',
      'Customer और staff roles के लिए mobile use पर focus है।',
    ],
    finalTitle: 'ज़्यादा confidence के साथ launch कीजिए।',
    finalBody: 'RestoFlow को इस तरह बनाया जा रहा है कि आपकी team पहले QR scan से final payment तक रोज़ trust के साथ इसे use कर सके।',
    finalPrimary: 'Workspace बनाइए',
    finalSecondary: 'Login',
  },
  hinglish: {
    language: 'Language',
    badge: 'Restaurant operating system',
    hero: 'Menu, tables, kitchen, waiter, billing aur growth ko ek hi calm control center se chalao.',
    body: 'RestoFlow restaurants ko fast service, clear staff coordination, better billing aur trustworthy customer flow deta hai. 30-day free trial se start karo, lagbhag 3 minute me setup complete karo, aur verification ke baad live ho jao.',
    chips: ['30-day free trial', '3-minute setup', 'Verification included'],
    primary: 'Free trial start karo',
    secondary: 'Walkthrough book karo',
    previewTitle: 'Dekho full restaurant flow kaise connect hota hai.',
    scenes: [
      'Guest mobile se scan karke browse aur order karta hai.',
      'Kitchen, waiter aur cash desk real time me sync rehte hain.',
      'Tables, floors aur QR access service se linked rehte hain.',
      'Owners ko cleaner billing, exports aur reporting milti hai.',
    ],
    problemTitle: 'RestoFlow kya solve karta hai',
    problems: [
      'Disconnected tools service ko slow kar dete hain.',
      'Rush-hour handoff clear nahi hota.',
      'Customer ordering aur billing trust lose kar dete hain.',
    ],
    featureTitle: 'Real restaurant operations ke liye built',
    features: [
      ['Menu aur ordering', 'Categories, modifiers, photos aur digital ordering flow ek hi workspace se manage karo.'],
      ['Live floor aur kitchen coordination', 'Tables, active sessions, readiness, waiter delivery flow aur assistance calls track karo.'],
      ['Billing aur reconciliation', 'GST-ready totals, payment states aur exportable invoice records ke saath sessions close karo.'],
      ['Role-based access', 'Owner, manager, cashier, kitchen aur waiter ko unke role ke hisab se tools milte hain.'],
    ],
    flowTitle: 'Practical sequence me live jao',
    flow: [
      'Workspace banao aur business profile complete karo.',
      'Menu import karo aur prices, modifiers, photos verify karo.',
      'Dine-in sessions ke liye tables aur QR codes map karo.',
      'Customer order se paid bill tak ek full test journey chalao.',
    ],
    trustTitle: 'India-first launch readiness',
    trust: [
      'Har naye business ke liye 30-day trial.',
      'Privacy aur terms pages included hain.',
      'Customer account control aur deactivation flow supported hai.',
      'Customer aur staff roles ke liye mobile-first usage par focus hai.',
    ],
    finalTitle: 'Chaos se nahi, confidence se launch karo.',
    finalBody: 'RestoFlow ko is tarah build kiya ja raha hai ki team pehle QR scan se final payment tak trust ke saath operate kar sake.',
    finalPrimary: 'Workspace create karo',
    finalSecondary: 'Login',
  },
} as const;

export function AuthIndexPage({ onLoginClick, onSignupClick, onContactClick }: AuthIndexPageProps) {
  const [language, setLanguage] = useState<SiteLanguage>('en');
  const [scene, setScene] = useState(0);
  const t = copy[language];

  useEffect(() => {
    const timer = window.setInterval(() => setScene((current) => (current + 1) % frames.length), 3800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16 font-sans">
        <section className="pt-4">
          <div className="grid items-center gap-10 lg:grid-cols-[1.02fr_0.98fr]">
            <div className="px-2 text-center lg:text-left">
              <div className="mb-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-bold" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--brand)' }}>
                {t.badge}
              </div>
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                <span className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-3)' }}>{t.language}</span>
                {(['en', 'hi', 'hinglish'] as SiteLanguage[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setLanguage(item)}
                    className="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]"
                    style={{
                      background: language === item ? 'var(--brand)' : 'var(--surface)',
                      border: `1px solid ${language === item ? 'var(--brand)' : 'var(--border)'}`,
                      color: language === item ? '#ffffff' : 'var(--text-2)',
                    }}
                  >
                    {item === 'en' ? 'English' : item === 'hi' ? 'हिंदी' : 'Hinglish'}
                  </button>
                ))}
              </div>
              <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
                {t.hero}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed sm:text-lg" style={{ color: 'var(--text-2)' }}>{t.body}</p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                {t.chips.map((chip) => (
                  <span key={chip} className="rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em]" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-2)' }}>
                    {chip}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white" style={{ background: 'var(--brand)' }}>
                  {t.primary}
                  <ArrowRight size={16} />
                </button>
                <button onClick={onContactClick} className="rounded-full px-6 py-3 text-sm font-bold" style={{ border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-1)' }}>
                  {t.secondary}
                </button>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[620px]">
              <div className="absolute inset-10 rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, rgba(59,130,246,0) 70%)' }} />
              <div className="relative overflow-hidden rounded-[36px] border p-4 shadow-2xl" style={{ borderColor: 'var(--border)', background: 'linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.85))' }}>
                <div className="mb-4 flex items-start justify-between gap-4 px-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-cyan-300">{frames[scene].tag}</p>
                    <h2 className="mt-2 text-2xl font-black text-white">{t.previewTitle}</h2>
                    <p className="mt-3 max-w-lg text-sm leading-relaxed text-slate-300">{t.scenes[scene]}</p>
                  </div>
                  <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-slate-200">Scene {scene + 1}</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-[1.12fr_0.88fr]">
                  <article className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/55 p-3">
                    <div className="overflow-hidden rounded-[22px] border border-white/10">
                      <img src={frames[scene].src} alt={frames[scene].alt} className="h-[290px] w-full object-cover object-top" />
                    </div>
                  </article>
                  <div className="grid gap-3">
                    {frames.map((frame, index) => (
                      <button
                        key={frame.alt}
                        type="button"
                        onClick={() => setScene(index)}
                        className="overflow-hidden rounded-[24px] border p-2 text-left"
                        style={{ borderColor: index === scene ? 'rgba(96,165,250,0.65)' : 'rgba(255,255,255,0.1)', background: index === scene ? 'rgba(15,23,42,0.96)' : 'rgba(15,23,42,0.72)' }}
                      >
                        <div className="overflow-hidden rounded-[18px] border border-white/10">
                          <img src={frame.src} alt={frame.alt} className="h-[100px] w-full object-cover object-top" />
                        </div>
                        <p className="mt-3 px-1 text-sm font-bold text-white">{t.scenes[index]}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 lg:grid-cols-[0.94fr_1.06fr]">
            <article className="rounded-3xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>{t.problemTitle}</p>
              <div className="mt-6 space-y-4">
                {t.problems.map((problem) => (
                  <div key={problem} className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                    {problem}
                  </div>
                ))}
              </div>
            </article>

            <article id="features" className="rounded-3xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>{t.featureTitle}</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {t.features.map(([title, summary], index) => {
                  const Icon = [Store, LayoutDashboard, Receipt, Users][index];
                  return (
                    <div key={title} className="rounded-2xl border p-5" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                        <Icon size={18} />
                      </div>
                      <h3 className="mt-4 text-lg font-black" style={{ color: 'var(--text-1)' }}>{title}</h3>
                      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{summary}</p>
                    </div>
                  );
                })}
              </div>
            </article>
          </div>
        </section>

        <section id="setup" className="mx-auto max-w-7xl px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-3xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>{t.flowTitle}</p>
              <div className="mt-6 space-y-3">
                {t.flow.map((step, index) => (
                  <div key={step} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white" style={{ background: 'var(--brand)' }}>{index + 1}</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{step}</p>
                  </div>
                ))}
              </div>
            </article>

            <article id="compliance" className="rounded-3xl border p-8" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>{t.trustTitle}</p>
              <div className="mt-6 space-y-3">
                {t.trust.map((point) => (
                  <div key={point} className="flex items-start gap-3 rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      <CheckCircle2 size={14} />
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>{point}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-12">
          <div className="rounded-3xl border p-10 text-center" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
            <h2 className="text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>{t.finalTitle}</h2>
            <p className="mx-auto mt-4 max-w-2xl text-base" style={{ color: 'var(--text-2)' }}>{t.finalBody}</p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button onClick={onSignupClick} className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-sm font-bold text-white" style={{ background: 'var(--brand)' }}>
                {t.finalPrimary}
                <ArrowRight size={16} />
              </button>
              <button onClick={onLoginClick} className="rounded-full px-8 py-3.5 text-sm font-bold" style={{ border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)' }}>
                {t.finalSecondary}
              </button>
            </div>
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
