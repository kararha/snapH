import React from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Lock, Globe, ArrowLeft } from 'lucide-react';
import { HowItWorks } from './HowItWorks';
import { translations, Language } from '../translations';

interface PolicyProps {
  onBack: () => void;
  lang: Language;
}

export const PrivacyPolicy: React.FC<PolicyProps> = ({ onBack, lang }) => {
  const t = translations[lang];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white technical-border p-8 md:p-12"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <button 
        onClick={onBack}
        className="flex items-center gap-2 mb-8 mono-label hover:text-black transition-colors group"
      >
        <ArrowLeft size={16} className={`transition-transform ${lang === 'ar' ? 'group-hover:translate-x-1 rotate-180' : 'group-hover:-translate-x-1'}`} />
        {t.returnToConverter}
      </button>

      <div className="max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-black text-white text-[10px] font-mono tracking-widest uppercase mb-6">
          <ShieldCheck size={14} /> {t.securityArchitecture}
        </div>
        
        <h2 className="text-4xl font-bold tracking-tighter mb-6 underline decoration-4 decoration-black/10 underline-offset-8">
          {t.privacyPolicy}
        </h2>

        <div className="space-y-8 text-sm leading-relaxed">
          <section>
            <p className="text-lg font-medium italic mb-4">
              {t.privacyQuote}
            </p>
            <p className="opacity-70">
              {t.privacyDescription}
            </p>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div className="bg-[#F4F4F2] p-6 technical-border !shadow-none cursor-default hover:border-black transition-colors">
              <Lock className="mb-4" />
              <h3 className="font-bold mb-2">{t.zeroDataCollection}</h3>
              <p className="text-xs opacity-60">{t.zeroDataDesc}</p>
            </div>
            <div className="bg-[#F4F4F2] p-6 technical-border !shadow-none cursor-default hover:border-black transition-colors">
              <Globe className="mb-4" />
              <h3 className="font-bold mb-2">{t.localProcessing}</h3>
              <p className="text-xs opacity-60">{t.localProcessingDesc}</p>
            </div>
          </div>

          <section className="space-y-4">
            <HowItWorks lang={lang} />
          </section>

          <section className="border-t border-black/10 pt-8 mt-12">
            <p className="mono-label leading-normal">
              {t.tagline}
            </p>
            <p className="text-[10px] opacity-40 mt-4 font-mono">
              {t.lastUpdated}
            </p>
          </section>
        </div>
      </div>
    </motion.div>
  );
};
