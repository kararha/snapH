import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { translations, Language } from '../translations';

interface Props {
  lang: Language;
}

export const HowItWorks: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];
  return (
    <div className="p-6 technical-border space-y-4">
      <h3 className="font-bold text-lg tracking-tighter text-[#0B0B0C]">{t.howItWorks}</h3>
      <ul className="space-y-3">
        {[t.step1, t.step2, t.step3, t.step4, t.step5].map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-[#0B0B0C]" />
            <span className="text-sm opacity-70 text-[#0B0B0C]">{item}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 pt-4 border-t border-[#0B0B0C]/10">
        <p className="text-xs font-mono opacity-80 bg-[#0B0B0C]/5 p-2 rounded-xs">
          {t.iphoneNote}
        </p>
      </div>
    </div>
  );
};
