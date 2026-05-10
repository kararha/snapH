import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from '../translations';
import logoIcon from '../assets/logo-icon.svg';

type InstallModalType = 'safari-mobile' | 'firefox-desktop' | 'firefox-mobile' | 'safari-desktop' | 'chromium-mobile';

interface PWAInstallModalProps {
  type: InstallModalType;
  lang: Language;
  onDismiss: () => void;
  onPermanentDismiss?: () => void;
}

const SnapHeicLogo = ({ size = 28 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center bg-black text-white p-1.5 shadow-sm rounded-md" style={{ width: size + 10, height: size + 10 }}>
    <img src={logoIcon} style={{ width: size, height: size }} alt="SnapHeic" />
  </div>
);

const ElegantInstallHint = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.9, y: -10 }}
    transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
    style={{
      position: 'fixed',
      top: 16,
      right: 140, // Points approximately at the Firefox install icon
      zIndex: 60,
      pointerEvents: 'none',
    }}
  >
    <motion.div
      animate={{ y: [0, -3, 0] }}
      transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      className="flex flex-col items-center gap-1.5"
    >
      {/* Upward pointing triangle */}
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-b-[6px] border-l-transparent border-r-transparent border-b-black/90" />
      <div className="bg-black/90 text-white text-[9px] uppercase tracking-widest px-3 py-1.5 font-bold shadow-lg rounded-sm backdrop-blur-md">
        Install App
      </div>
      {/* Subtle pulse effect */}
      <motion.div 
        animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeOut" }}
        className="absolute top-0 w-8 h-8 bg-black/20 rounded-full -z-10 blur-sm pointer-events-none"
        style={{ marginTop: -10 }}
      />
    </motion.div>
  </motion.div>
);

export function PWAInstallModal({ type, lang, onDismiss, onPermanentDismiss }: PWAInstallModalProps) {
  const isRtl = lang === 'ar';
  
  const modalRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss();
    };
    document.addEventListener('keydown', handleKeyDown);
    if (modalRef.current) {
      modalRef.current.focus();
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onDismiss]);

  const getSteps = () => {
    switch (type) {
      case 'firefox-desktop':
        return [
          "Click the install icon in the top-right of Firefox",
          "Confirm the install popup",
          "Launch SnapHeic from your desktop"
        ];
      case 'safari-mobile':
        return [
          "Tap the Share button in the bottom bar",
          "Scroll down and tap 'Add to Home Screen'",
          "Launch SnapHeic from your home screen"
        ];
      case 'safari-desktop':
        return [
          "Go to File menu in the top bar",
          "Select 'Add to Dock'",
          "Launch SnapHeic from your Dock"
        ];
      case 'firefox-mobile':
      case 'chromium-mobile':
        return [
          "Tap the browser menu (⋮)",
          "Select 'Install' or 'Add to Home Screen'",
          "Launch SnapHeic from your home screen"
        ];
      default:
        return [];
    }
  };

  const steps = getSteps();

  const title = isRtl ? "تثبيت سناب هيك" : "Install SnapHeic";
  const desc = isRtl 
    ? "استخدم التطبيق على سطح المكتب لتحويل أسرع وبدون إنترنت." 
    : "Use SnapHeic as a desktop app for faster local HEIC conversions.";
  const btnGotIt = isRtl ? "فهمت ذلك" : "Got it";
  const btnContinue = isRtl ? "المتابعة في المتصفح" : "Continue in browser";

  return (
    <>
      <AnimatePresence>
        {type === 'firefox-desktop' && <ElegantInstallHint />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/5 backdrop-blur-[2px]"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={onDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.97, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.97, opacity: 0, y: 10 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="bg-white p-8 max-w-[340px] w-full shadow-[0_16px_40px_-12px_rgba(0,0,0,0.15)] border border-black/5 rounded-[12px] flex flex-col gap-6 relative outline-none"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-4 text-center">
            <SnapHeicLogo size={32} />
            <div className="space-y-1.5">
              <h2 id="modal-title" className="text-[22px] font-black tracking-tight text-black leading-none">
                {title}
              </h2>
              <p className="text-[13px] text-black/50 leading-snug max-w-[260px] mx-auto font-medium">
                {desc}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="w-full space-y-4 px-1 py-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-[4px] bg-black/5 text-black/70 text-[9px] font-bold flex items-center justify-center shrink-0 mt-[1px] border border-black/5">
                  {index + 1}
                </span>
                <p className="text-[13px] text-black/80 font-medium leading-tight pt-[2px]">{step}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-2 mt-1">
            <button
              onClick={onDismiss}
              className="w-full bg-black text-white font-bold text-[11px] uppercase px-5 py-3 tracking-widest rounded-md hover:bg-black/90 active:scale-[0.98] transition-all shadow-sm focus:ring-2 focus:ring-black/20 outline-none"
            >
              {btnGotIt}
            </button>
            <button
              onClick={() => {
                onPermanentDismiss?.();
                onDismiss();
              }}
              className="w-full text-black/40 hover:text-black font-semibold text-[11px] rounded-md transition-colors py-2.5 active:scale-[0.98] focus:outline-none"
            >
              {btnContinue}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
