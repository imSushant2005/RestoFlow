import { useState } from 'react';
import { ArrowRight, CheckCircle2, ChefHat, QrCode, Receipt, Smartphone, Users, Globe2, Monitor, Phone } from 'lucide-react';
import { SiteChrome } from '../components/site/SiteChrome';
import customerMenuPreview from '../assets/preview/customer-menu.png';
import liveOrdersPreview from '../assets/preview/live-orders-session.png';
import menuPreview from '../assets/preview/menu-management.png';
import analyticsPreview from '../assets/preview/analytics.png';

type DemoPageProps = {
  onLoginClick: () => void;
  onSignupClick: () => void;
  onContactClick: () => void;
};

export function DemoPage({ onLoginClick, onSignupClick, onContactClick }: DemoPageProps) {
  const [lang, setLang] = useState<'en' | 'in'>('en');

  const content = {
    en: {
      header: {
        tag: "Guided Demo",
        titleDesktop: "Follow the full BHOJFLOW story from workspace creation to completed order and settled bill.",
        titleMobile: "See how BHOJFLOW powers your restaurant right from your pocket.",
        subtitleDesktop: "This is not just a gallery. Each step explains who the screen is for, what it changes operationally, and why the connected flow is stronger than using separate customer, kitchen, and billing systems.",
        subtitleMobile: "Discover how our mobile-first system connects your customers, kitchen, and billing seamlessly without bulky hardware."
      },
      steps: [
        {
          step: 'Step 1',
          title: 'Create the workspace and publish the menu',
          desktopBody: 'The restaurant owner or manager starts by building categories, items, modifiers, and pricing. This becomes the single source of truth for both customers and staff.',
          mobileBody: 'Quickly manage your restaurant menu, simple pricing, and venue settings directly from your phone on the go.',
          image: menuPreview,
          icon: QrCode,
          badge: 'Owner / Manager'
        },
        {
          step: 'Step 2',
          title: 'Guests scan and order from mobile',
          desktopBody: 'Customers discover dishes through search, categories, recommendations, and clearer food cards, then customize and place the order with more trustworthy totals.',
          mobileBody: 'Your guests just scan the QR on the table and order in seconds with a seamless, lag-free mobile menu.',
          image: customerMenuPreview,
          icon: Smartphone,
          badge: 'Customer'
        },
        {
          step: 'Step 3',
          title: 'Kitchen, waiter, and cash stay aligned',
          desktopBody: 'Orders stay linked to the dining session so the kitchen knows what is cooking, the waiter sees what is ready, and the cashier closes the right bill.',
          mobileBody: 'Track live tables on mobile and send orders straight to the kitchen instantly without running back and forth.',
          image: liveOrdersPreview,
          icon: ChefHat,
          badge: 'Kitchen & Staff'
        },
        {
          step: 'Step 4',
          title: 'Owners review performance and reconcile',
          desktopBody: 'After service, analytics and billing records remain connected to the same restaurant flow for cleaner review, follow-up, and reporting.',
          mobileBody: 'Check today\'s revenue drops and table performance analytics right from your pocket anytime, anywhere.',
          image: analyticsPreview,
          icon: Receipt,
          badge: 'Analytics'
        },
      ],
      footer: {
        tag: "Demo Outcomes",
        title: "The value is continuity across the whole flow.",
        cards: [
          { icon: Users, title: 'Less staff confusion', body: 'Everyone sees the same live session story.' },
          { icon: CheckCircle2, title: 'More customer trust', body: 'Cleaner ordering and tracking reduce checkout friction.' },
          { icon: ArrowRight, title: 'Fewer breaks', body: 'A stronger sequence prevents broken service flows.' },
        ]
      }
    },
    in: {
      header: {
        tag: "Guided Demo",
        titleDesktop: "BHOJFLOW ka poora safar dekhein: Naya account banane se lekar order poora hone tak.",
        titleMobile: "Dekhiye kaise BHOJFLOW aapke mobile se hi restaurant ko smart banata hai.",
        subtitleDesktop: "Ye sirf screenshots nahi hain. Har step samajhata hai ki konsi screen kiske liye hai aur kaise connected systems alag-alag software use karne se behtar hain.",
        subtitleMobile: "Janiye kaise mobile-first system aapke customers, kitchen aur billing ko bina kisi bhari hardware ke connect karta hai."
      },
      steps: [
        {
          step: 'Step 1',
          title: 'Workspace banayein aur menu publish karein',
          desktopBody: 'Restaurant owner ya manager categories aur items set karte hain. Yehi ek main menu ban jata hai customers aur staff dono ke liye.',
          mobileBody: 'Apne phone se hi aasaani se restaurant ka menu, daam aur settings ko kahin se bhi manage karein.',
          image: menuPreview,
          icon: QrCode,
          badge: 'Owner / Manager'
        },
        {
          step: 'Step 2',
          title: 'Guests scan karke easily order karte hain',
          desktopBody: 'Customers search, categories, aur acche food cards ke zariye dish dhoondte hain aur bina kisi doubt ke customize karke order karte hain.',
          mobileBody: 'Aapke guests table pe sirf QR scan karte hain aur fast, lag-free mobile menu se turant order kar dete hain.',
          image: customerMenuPreview,
          icon: Smartphone,
          badge: 'Customer'
        },
        {
          step: 'Step 3',
          title: 'Kitchen, waiter, aur cashier synced rehte hain',
          desktopBody: 'Orders dining session se jude rehte hain, jisse kitchen ko pata chalta hai kya pak raha hai, aur waiter sahi table par khana le jaata hai.',
          mobileBody: 'Phone se hi live tables monitor karein aur bina bhag-doud kiye orders seedhe kitchen ko forward karein.',
          image: liveOrdersPreview,
          icon: ChefHat,
          badge: 'Kitchen & Staff'
        },
        {
          step: 'Step 4',
          title: 'Performance check karein aur details analyse karein',
          desktopBody: 'Din khatam hone ke baad analytics aur billing dono connected rehte hain jisse hisaab milaana aur report nikalna asaan hota hai.',
          mobileBody: 'Apne hisaab aur aaj ki galla-kamai ki performance pocket se hi daily track karein.',
          image: analyticsPreview,
          icon: Receipt,
          badge: 'Analytics'
        },
      ],
      footer: {
        tag: "Nateeja (Outcomes)",
        title: "Asli fayda ek fully connected system me hai.",
        cards: [
          { icon: Users, title: 'Staff me no confusion', body: 'Sab ek hi live session dekhte hain koi confusion nahi.' },
          { icon: CheckCircle2, title: 'Customers ka bharosa', body: 'Clean digital ordering se checkout par doubt nahi hota.' },
          { icon: ArrowRight, title: 'Fast service', body: 'Ek solid system se service delay aane ke chances kam hain.' },
        ]
      }
    }
  };

  const current = content[lang];

  return (
    <SiteChrome onLoginClick={onLoginClick} onSignupClick={onSignupClick} onContactClick={onContactClick}>
      <main className="space-y-16 pb-16">
        
        {/* Language & Device Toggles Area */}
        <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4 px-2 sm:px-0 max-w-3xl border-b border-[var(--border)] pb-6 relative z-10">
          
          <div className="flex items-center gap-2 p-1.5 bg-[var(--surface-raised)] border border-[var(--border)] rounded-2xl shadow-sm">
            <button 
              onClick={() => setLang('en')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${lang === 'en' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-[var(--text-2)] hover:text-blue-500 hover:bg-blue-500/5'}`}
            >
              <Globe2 size={16} /> English
            </button>
            <button 
              onClick={() => setLang('in')} 
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all ${lang === 'in' ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20' : 'text-[var(--text-2)] hover:text-orange-500 hover:bg-orange-500/5'}`}
            >
              Hinglish <span className="text-[10px] bg-white/20 px-1.5 rounded uppercase tracking-wider ml-1">IN</span>
            </button>
          </div>

          <div className="flex gap-4 items-center text-xs font-bold text-[var(--text-3)] bg-[var(--surface-2)] px-4 py-2 rounded-2xl">
            <span className="hidden md:flex items-center gap-1.5 text-indigo-500"><Monitor size={14} /> Desktop Mode</span>
            <span className="md:hidden flex items-center gap-1.5 text-indigo-500"><Phone size={14} /> Mobile Mode</span>
          </div>

        </div>

        <section className="max-w-3xl relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: 'var(--brand)' }}>
            {current.header.tag}
          </p>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl hidden md:block" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
            {current.header.titleDesktop}
          </h1>
          <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl md:hidden" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
            {current.header.titleMobile}
          </h1>

          <p className="mt-5 text-base leading-8 sm:text-lg hidden md:block" style={{ color: 'var(--text-2)' }}>
            {current.header.subtitleDesktop}
          </p>
          <p className="mt-5 text-base leading-8 sm:text-lg md:hidden" style={{ color: 'var(--text-2)' }}>
            {current.header.subtitleMobile}
          </p>
        </section>

        <section className="grid gap-8">
          {current.steps.map((section, index) => {
            const Icon = section.icon;
            return (
              <article
                key={section.title}
                className="grid gap-6 overflow-hidden rounded-[32px] border p-6 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] shadow-sm hover:shadow-xl hover:shadow-[var(--brand-soft)] transition-all duration-500 group animate-in zoom-in-95"
                style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
              >
                <div className={`overflow-hidden rounded-[24px] border border-[var(--border)] shadow-md group-hover:scale-[1.02] transition-transform duration-700 ${index % 2 === 1 ? 'lg:order-2' : ''}`}>
                  <img src={section.image} alt={section.title} className="h-full min-h-[280px] w-full object-cover object-top" />
                </div>
                <div className={`${index % 2 === 1 ? 'lg:order-1 lg:pr-8' : 'lg:pl-8'} flex flex-col justify-center`}>
                  <div className="flex items-center gap-3">
                    <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em]" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                      <Icon size={14} />
                      {section.step}
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-[var(--text-3)] bg-[var(--surface-3)] px-2 py-1 rounded-lg">
                      {section.badge}
                    </span>
                  </div>
                  
                  <h2 className="mt-5 text-3xl font-black tracking-tight leading-tight" style={{ color: 'var(--text-1)' }}>
                    {section.title}
                  </h2>
                  
                  {/* Desktop explanation */}
                  <div className="hidden md:block">
                     <p className="mt-4 text-[15px] leading-relaxed font-medium" style={{ color: 'var(--text-2)' }}>
                       {section.desktopBody}
                     </p>
                  </div>
                  
                  {/* Mobile explanation */}
                  <div className="md:hidden">
                     <p className="mt-4 text-[15px] leading-relaxed font-medium" style={{ color: 'var(--text-2)' }}>
                       {section.mobileBody}
                     </p>
                  </div>

                </div>
              </article>
            );
          })}
        </section>

        <section className="rounded-[32px] border p-8 sm:p-12 shadow-inner" style={{ borderColor: 'var(--border)', background: 'var(--surface-raised)' }}>
          <div className="mb-10 max-w-3xl text-center md:text-left mx-auto md:mx-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] mb-3 inline-block px-3 py-1 bg-[var(--brand-soft)] rounded-full" style={{ color: 'var(--brand)' }}>
              {current.footer.tag}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl" style={{ color: 'var(--text-1)' }}>
              {current.footer.title}
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {current.footer.cards.map((item) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="rounded-3xl border p-6 hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-lg" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl mb-5 shadow-inner" style={{ background: 'var(--brand-soft)', color: 'var(--brand)' }}>
                    <Icon size={24} />
                  </div>
                  <h3 className="text-xl font-black tracking-tight" style={{ color: 'var(--text-1)' }}>
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed font-medium" style={{ color: 'var(--text-3)' }}>
                    {item.body}
                  </p>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </SiteChrome>
  );
}
