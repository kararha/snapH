import { motion } from 'motion/react';
import { Share, MoreVertical, X } from 'lucide-react';
import { translations, Language } from '../translations';

interface PWAInstallModalProps {
  type: 'ios' | 'firefox';
  lang: Language;
  onDismiss: () => void;
}

export function PWAInstallModal({ type, lang, onDismiss }: PWAInstallModalProps) {
  const t = translations[lang];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      dir={lang === 'ar' ? 'rtl' : 'ltr'}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="technical-border p-6 max-w-sm w-full relative"
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 hover:opacity-60 transition-opacity"
          aria-label={t.pwaManualDismiss}
        >
          <X size={16} />
        </button>

        <div className="flex flex-col items-center text-center gap-5">
          <div className="p-3 bg-black text-white">
            {type === 'ios' ? <Share size={24} /> : <MoreVertical size={24} />}
          </div>

          <h3 className="font-bold text-sm uppercase tracking-widest">
            {type === 'ios' ? t.pwaIosTitle : t.pwaFirefoxTitle}
          </h3>

          {type === 'ios' ? (
            <div className="text-left w-full space-y-4">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                <p className="text-sm font-medium">{t.pwaIosStep1}</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                <p className="text-sm font-medium">{t.pwaIosStep2}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-left w-full">{t.pwaFirefoxStep}</p>
          )}

          <button
            onClick={onDismiss}
            className="bg-black text-white font-bold text-[10px] uppercase px-6 py-3 tracking-wider hover:bg-black/90 transition-colors"
          >
            {t.pwaManualDismiss}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
