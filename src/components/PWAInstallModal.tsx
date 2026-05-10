import { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Language } from '../translations';
import logoIcon from '../assets/logo-icon.svg';

type InstallModalType = 'safari-mobile' | 'firefox-desktop' | 'firefox-mobile' | 'safari-desktop' | 'chromium-mobile';

interface PWAInstallModalProps {
  type: InstallModalType;
  lang: Language;
  onDismiss: () => void;
  onPermanentDismiss?: () => void;
}

const SnapHeicLogo = ({ size = 32 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center bg-black text-white p-2 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.2)]" style={{ width: size + 12, height: size + 12 }}>
    <img src={logoIcon} style={{ width: size, height: size }} alt="SnapHeic" />
  </div>
);

const ElegantInstallHint = () => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ delay: 0.6, duration: 0.8, ease: "easeOut" }}
    style={{
      position: 'fixed',
      top: 12,
      right: 140, // Points exactly under the Firefox install icon area
      zIndex: 60,
      pointerEvents: 'none',
    }}
  >
    <motion.div
      animate={{ y: [0, -4, 0] }}
      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      className="flex flex-col items-center gap-2"
    >
      {/* Upward pointing elegant indicator */}
      <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[8px] border-l-transparent border-r-transparent border-b-black" />
      <div className="bg-black text-white text-[10px] uppercase tracking-widest px-4 py-2 font-bold shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]">
        Install App
      </div>
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
    // Auto-focus the modal for accessibility
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
      {type === 'firefox-desktop' && <ElegantInstallHint />}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm"
        dir={isRtl ? 'rtl' : 'ltr'}
        onClick={onDismiss}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <motion.div
          ref={modalRef}
          initial={{ scale: 0.96, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="bg-white p-8 md:p-10 max-w-[400px] w-full shadow-[0_32px_64px_-12px_rgba(0,0,0,0.3)] border border-black/10 flex flex-col gap-8 relative outline-none"
          onClick={(e) => e.stopPropagation()}
          tabIndex={-1}
        >
          {/* Header */}
          <div className="flex flex-col items-center gap-6 text-center">
            <SnapHeicLogo size={36} />
            <div className="space-y-3">
              <h2 id="modal-title" className="text-2xl font-extrabold tracking-tight text-black">
                {title}
              </h2>
              <p className="text-[14px] text-black/60 leading-relaxed max-w-[280px] mx-auto font-medium">
                {desc}
              </p>
            </div>
          </div>

          {/* Steps */}
          <div className="w-full space-y-5 px-2">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start gap-4">
                <span className="w-6 h-6 bg-black/5 text-black text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 border border-black/10">
                  {index + 1}
                </span>
                <p className="text-[13.5px] text-black/80 font-medium leading-relaxed pt-0.5">{step}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col w-full gap-2 pt-4">
            <button
              onClick={onDismiss}
              className="w-full bg-black text-white font-bold text-[11px] uppercase px-6 py-4 tracking-widest hover:bg-black/90 transition-all shadow-[0_8px_16px_-4px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.4)] focus:ring-2 focus:ring-black focus:ring-offset-2 outline-none"
            >
              {btnGotIt}
            </button>
            <button
              onClick={() => {
                onPermanentDismiss?.();
                onDismiss();
              }}
              className="w-full text-black/40 hover:text-black font-semibold text-[12px] transition-colors py-3 focus:outline-none focus:text-black"
            >
              {btnContinue}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
