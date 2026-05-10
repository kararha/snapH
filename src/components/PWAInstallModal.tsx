import { motion } from 'motion/react';
import { Share, MoreVertical, X } from 'lucide-react';
import { translations, Language } from '../translations';

type InstallModalType = 'safari-mobile' | 'firefox-desktop' | 'firefox-mobile' | 'safari-desktop' | 'chromium-mobile';

interface PWAInstallModalProps {
  type: InstallModalType;
  lang: Language;
  onDismiss: () => void;
}

// Accurate Firefox "Install/Download" address-bar icon:
// A box (rect) with a downward arrow shaft + arrowhead + base tray line
const FirefoxDownloadBarIcon = ({ size = 32 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-label="Firefox install icon — box with downward arrow"
  >
    {/* Outer box */}
    <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
    {/* Arrow shaft (going down) */}
    <line x1="16" y1="9" x2="16" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    {/* Arrowhead (pointing down) */}
    <polyline
      points="11,16 16,22 21,16"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    {/* Base tray */}
    <line x1="10" y1="25" x2="22" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const SafariDesktopIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" fill="none" />
    <line x1="3" y1="8" x2="21" y2="8" stroke="currentColor" strokeWidth="2" />
    <circle cx="8" cy="5.5" r="1" fill="currentColor" />
    <circle cx="12" cy="5.5" r="1" fill="currentColor" />
    <circle cx="16" cy="5.5" r="1" fill="currentColor" />
  </svg>
);

// A curved dashed orange arrow that curves from the modal area up toward the top-right
// where Firefox's address bar install icon sits, with a "Look up here!" caption
const FloatingArrow = () => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0 }}
    transition={{ delay: 0.4, duration: 0.5 }}
    style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: 200,
      height: 260,
      zIndex: 60,
      pointerEvents: 'none',
    }}
    aria-hidden="true"
  >
    <svg
      viewBox="0 0 200 260"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', height: '100%' }}
    >
      {/* Curved dashed line going from lower-left to upper-right */}
      <path
        d="M 40 240 C 30 170, 90 100, 155 35"
        stroke="#e8a000"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        strokeDasharray="7 5"
      />
      {/* Arrowhead at top pointing up-right */}
      <polyline
        points="143,27 157,31 161,45"
        stroke="#e8a000"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* "Look up here!" caption near the tail of the arrow */}
      <text
        x="10"
        y="230"
        fill="#e8a000"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="14"
        letterSpacing="0.05em"
      >
        Look up here!
      </text>
    </svg>
  </motion.div>
);

export function PWAInstallModal({ type, lang, onDismiss }: PWAInstallModalProps) {
  const t = translations[lang];
  const isFirefoxDesktop = type === 'firefox-desktop';

  const getIcon = () => {
    switch (type) {
      case 'firefox-desktop':
        return <FirefoxDownloadBarIcon size={30} />;
      case 'firefox-mobile':
        return <MoreVertical size={24} />;
      case 'chromium-mobile':
        return <MoreVertical size={24} />;
      case 'safari-desktop':
        return <SafariDesktopIcon />;
      case 'safari-mobile':
        return <Share size={24} />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'safari-mobile':
        return t.pwaIosTitle;
      case 'firefox-desktop':
        return t.pwaFirefoxDesktopTitle;
      case 'firefox-mobile':
        return t.pwaFirefoxMobileTitle;
      case 'safari-desktop':
        return t.pwaSafariDesktopTitle;
      case 'chromium-mobile':
        return t.pwaChromiumMobileTitle;
    }
  };

  const getContent = () => {
    switch (type) {
      case 'safari-mobile':
        return (
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
        );

      case 'firefox-desktop':
        return (
          <div className="text-left w-full space-y-4">
            {/* Visual icon hint */}
            <div className="flex items-center gap-3 px-3 py-2 border border-black/15 bg-black/[0.04]">
              <span className="text-[10px] font-mono uppercase tracking-wider text-black/50">Look for:</span>
              <span className="inline-flex items-center gap-2 bg-black text-white px-2 py-1">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 32 32"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect x="3" y="3" width="26" height="26" rx="3" stroke="currentColor" strokeWidth="2.5" fill="none" />
                  <line x1="16" y1="9" x2="16" y2="20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  <polyline points="11,16 16,22 21,16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <line x1="10" y1="25" x2="22" y2="25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase">Install</span>
              </span>
            </div>
            {/* Steps */}
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              <p className="text-sm font-medium">{t.pwaFirefoxDesktopStep1}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              <p className="text-sm font-medium">{t.pwaFirefoxDesktopStep2}</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 bg-black text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              <p className="text-sm font-medium">{t.pwaFirefoxDesktopStep3}</p>
            </div>
          </div>
        );

      case 'firefox-mobile':
        return <p className="text-sm font-medium text-left w-full">{t.pwaFirefoxMobileStep}</p>;
      case 'safari-desktop':
        return <p className="text-sm font-medium text-left w-full">{t.pwaSafariDesktopStep}</p>;
      case 'chromium-mobile':
        return <p className="text-sm font-medium text-left w-full">{t.pwaChromiumMobileStep}</p>;
    }
  };

  return (
    <>
      {/* Floating arrow overlay: only for Firefox Desktop — points toward address bar area */}
      {isFirefoxDesktop && <FloatingArrow />}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
        onClick={onDismiss}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="technical-border p-6 max-w-sm w-full relative bg-white"
          onClick={(e) => e.stopPropagation()}
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
              {getIcon()}
            </div>

            <h3 className="font-bold text-sm uppercase tracking-widest">
              {getTitle()}
            </h3>

            {getContent()}

            <button
              onClick={onDismiss}
              className="bg-black text-white font-bold text-[10px] uppercase px-6 py-3 tracking-wider hover:bg-black/90 transition-colors"
            >
              {t.pwaManualDismiss}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </>
  );
}
