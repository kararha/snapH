import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Trash2, 
  Download, 
  Image as ImageIcon, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  Plus,
  ShieldCheck,
  X,
  MonitorDown,
  ArrowDown,
  Lock,
  Zap,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import heic2any from 'heic2any';
import JSZip from 'jszip';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { PWAInstallModal } from './components/PWAInstallModal';
import { translations, Language } from './translations';
import { usePWAInstall } from './hooks/usePWAInstall';

import logoIcon from './assets/logo-icon.svg';

type ConversionFormat = 'image/jpeg' | 'image/png';
type ConversionStatus = 'idle' | 'converting' | 'completed' | 'error';
type View = 'converter' | 'privacy';

interface ConversionItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ConversionStatus;
  progress: number;
  resultBlob?: Blob;
  resultUrl?: string;
  error?: string;
  format: ConversionFormat;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const SnapHeicLogo = ({ size = 28 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center bg-black text-white p-1 overflow-hidden shadow-sm rounded-md" style={{ width: size + 8, height: size + 8 }}>
    <img src={logoIcon} style={{ width: size, height: size }} alt="SnapHeic" />
    <motion.div 
      initial={{ x: -size }}
      animate={{ x: size + 10 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
      className="absolute top-0 bottom-0 w-1 bg-white/30 rotate-12"
    />
  </div>
);

export default function App() {
  const [lang, setLang] = useState<Language>('en');
  const t = translations[lang];
  const [view, setView] = useState<View>('converter');
  const [items, setItems] = useState<ConversionItem[]>([]);
  const [globalFormat, setGlobalFormat] = useState<ConversionFormat>('image/jpeg');
  const quality = 0.9;
  const [isDragging, setIsDragging] = useState(false);
  
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { isInstallable, isInstalled, installationPath, triggerInstall, dismissInstall } = usePWAInstall();
  const [dismissedPwaGuide, setDismissedPwaGuide] = useState(() => {
    return localStorage.getItem('snapheic_pwa_dismissed') === 'true';
  });
  const [hasEngaged, setHasEngaged] = useState(false);
  const showPwaGuide = hasEngaged && installationPath !== 'CHROMIUM' && installationPath !== 'CHROMIUM_MOBILE' && installationPath !== 'INSTALLED' && !dismissedPwaGuide;

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handlePermanentDismiss = () => {
    setDismissedPwaGuide(true);
    localStorage.setItem('snapheic_pwa_dismissed', 'true');
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+O / Ctrl+O to open file picker
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Listen to PWA installation success if browser emits it natively (Chrome)
  useEffect(() => {
    const handleAppInstalled = () => {
      showToast("App installed successfully!", "success");
      setDismissedPwaGuide(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, [showToast]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const allFiles = Array.from(files);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB size limit
    
    const validHeicFiles = allFiles.filter(file => {
      const name = file.name.toLowerCase();
      const isValidExt = name.endsWith('.heic') || name.endsWith('.heif');
      const isValidSize = file.size <= MAX_FILE_SIZE;
      return isValidExt && isValidSize;
    });

    if (validHeicFiles.length < allFiles.length) {
      showToast(t.filesSkipped, 'error');
    }

    if (validHeicFiles.length === 0) return;

    const newItems: ConversionItem[] = validHeicFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'idle',
      progress: 0,
      format: globalFormat
    }));

    setItems(prev => [...prev, ...newItems]);
    setHasEngaged(true); // Trigger engagement state
  }, [globalFormat, t, showToast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  }, [addFiles]);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter(i => i.id !== id);
    });
  };

  const convertItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.status === 'converting') return;

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'converting', progress: 50 } : i));

    try {
      const result = await heic2any({
        blob: item.file,
        toType: item.format,
        quality: quality
      });

      const resultBlob = Array.isArray(result) ? result[0] : result;
      const resultUrl = URL.createObjectURL(resultBlob);

      setItems(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'completed', 
        progress: 100, 
        resultBlob, 
        resultUrl 
      } : i));
    } catch (err: any) {
      console.error("Local conversion error:", err);
      const errorMessage = t.conversionFailed || "Conversion securely failed.";

      setItems(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'error', 
        error: errorMessage
      } : i));
    }
  };

  const convertAll = async () => {
    const idleItems = items.filter(i => i.status === 'idle' || i.status === 'error');
    await Promise.all(idleItems.map(item => convertItem(item.id)));
  };

  const downloadItem = (item: ConversionItem) => {
    if (!item.resultUrl) return;
    const link = document.createElement('a');
    link.href = item.resultUrl;
    const extension = item.format === 'image/jpeg' ? 'jpg' : 'png';
    const sanitizedName = item.file.name
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/\.(heic|heif)$/i, `.${extension}`);
    link.download = sanitizedName;
    link.click();
  };

  const downloadAll = async () => {
    const completedItems = items.filter(i => i.status === 'completed' && i.resultBlob);
    if (completedItems.length === 0) return;

    if (completedItems.length === 1) {
      downloadItem(completedItems[0]);
      return;
    }

    const zip = new JSZip();
    completedItems.forEach(item => {
      const extension = item.format === 'image/jpeg' ? 'jpg' : 'png';
      const sanitizedName = item.file.name
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
        .replace(/\.(heic|heif)$/i, `.${extension}`);
      zip.file(sanitizedName, item.resultBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `snapheic_converted_${Date.now()}.zip`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen pt-8 pb-4 md:pt-16 md:pb-8 px-4 md:px-8 max-w-5xl mx-auto flex flex-col gap-10" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Toast Overlay */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="pointer-events-auto bg-black text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-3 text-sm font-medium"
            >
              {toast.type === 'error' && <AlertCircle size={16} className="text-red-400" />}
              {toast.type === 'success' && <CheckCircle size={16} className="text-green-400" />}
              {toast.type === 'info' && <AlertCircle size={16} className="text-white/60" />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex flex-col md:flex-row md:items-end gap-6 w-full justify-between">
          <div 
            className="cursor-pointer group flex flex-col"
            onClick={() => setView('converter')}
          >
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 text-black">
              <SnapHeicLogo />
              {t.title}
            </h1>
            <p className="text-sm font-medium text-black/50 mt-1">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang('en')} 
              className={`px-3 py-1.5 text-[10px] rounded-md font-mono border transition-all active:scale-[0.98] ${lang === 'en' ? 'bg-black text-white border-black shadow-sm' : 'border-black/10 hover:border-black/30 text-black/70 hover:text-black bg-white'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ar')} 
              className={`px-3 py-1.5 text-[10px] rounded-md font-mono border transition-all active:scale-[0.98] ${lang === 'ar' ? 'bg-black text-white border-black shadow-sm' : 'border-black/10 hover:border-black/30 text-black/70 hover:text-black bg-white'}`}
            >
              AR
            </button>
          </div>
        </div>
        
        {view === 'converter' && (
          <div className="flex items-center gap-4 px-4 py-2 bg-white rounded-lg border border-black/10 shadow-sm shrink-0">
            <div className="flex flex-col">
              <span className="mono-label !text-[9px] mb-0.5">{t.outputFormat}</span>
              <select 
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as ConversionFormat)}
                className="bg-transparent border-none p-0 text-sm font-bold focus:ring-0 cursor-pointer text-black outline-none"
              >
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {view === 'converter' ? (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 items-start">
          {/* Left Column: Upload Area */}
          <div className="flex flex-col">
            <motion.div 
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              animate={{ 
                scale: isDragging ? 0.98 : 1,
                borderColor: isDragging ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.1)'
              }}
              className={`
                relative h-[420px] flex flex-col items-center justify-center p-6 cursor-pointer transition-colors technical-border group overflow-hidden
                ${isDragging ? 'bg-black/5 border-dashed border-2' : 'bg-white hover:bg-black/[0.02]'}
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                hidden 
                multiple 
                accept=".heic,.heif"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              
              <motion.div 
                animate={{ y: isDragging ? -10 : 0 }}
                className="flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-6 text-black/80 group-hover:bg-black/10 transition-colors shadow-sm">
                  <Upload size={28} strokeWidth={1.5} />
                </div>
                
                <h2 className="font-extrabold text-[22px] tracking-tight mb-2 text-black text-center">{t.dropFiles}</h2>
                <p className="text-[13px] font-medium text-black/50 mb-8 text-center max-w-[240px] leading-snug">{t.dropFilesSubtitle}</p>
                
                <button 
                  className="bg-black text-white font-bold text-[11px] rounded-md uppercase px-8 py-3.5 tracking-widest hover:bg-black/80 active:scale-[0.98] transition-all shadow-md focus:ring-2 focus:ring-black/20 focus:outline-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t.browseFiles}
                </button>
              </motion.div>

              {/* Badges / Microcopy */}
              <div className="absolute bottom-6 flex gap-3 text-[10px] font-semibold text-black/40">
                <div className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm"><ShieldCheck size={12} /> 100% Local</div>
                <div className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm"><Zap size={12} /> Fast</div>
                <div className="hidden sm:flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm border border-black/5">⌘O / Ctrl+O</div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Queue */}
          <div className="flex flex-col">
            <div className="border-b border-black/10 pb-4 mb-5 flex justify-between items-end px-1">
              <h2 className="font-bold text-xs uppercase tracking-widest text-black/60 flex items-center gap-2">
                {t.queueTitle} 
                <span className="bg-black/10 text-black px-1.5 py-0.5 rounded-sm text-[9px]">{items.length}</span>
              </h2>
              {items.length > 0 && (
                <div className="flex gap-4">
                  <button 
                    onClick={convertAll}
                    disabled={items.every(i => i.status === 'completed' || i.status === 'converting')}
                    className="text-[10px] font-bold uppercase tracking-widest text-black hover:text-black/70 active:scale-[0.98] transition-all disabled:opacity-30"
                  >
                    {t.convertAll}
                  </button>
                  <button 
                    onClick={downloadAll}
                    disabled={!items.some(i => i.status === 'completed')}
                    className="text-[10px] font-bold uppercase tracking-widest text-black hover:text-black/70 active:scale-[0.98] transition-all disabled:opacity-30"
                  >
                    {t.downloadAll}
                  </button>
                  <button 
                    onClick={() => {
                      items.forEach(item => {
                        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
                      });
                      setItems([]);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-red-500 active:scale-[0.98] transition-colors"
                  >
                    {t.clearQueue}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {items.map((item) => (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -10 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="flex items-center justify-between p-3 gap-4 group technical-border !shadow-sm hover:!shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-black/[0.03] rounded-md flex items-center justify-center shrink-0 border border-black/5 overflow-hidden">
                        {item.status === 'completed' && item.resultUrl ? (
                          <img 
                            src={item.resultUrl} 
                            alt="Converted preview" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={16} strokeWidth={1.5} className="opacity-40 text-black" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 text-black">
                        <span className="font-bold truncate text-xs">{item.file.name}</span>
                        <span className="text-[10px] font-mono opacity-50 font-medium">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 px-2 flex-1">
                      {item.status === 'converting' ? (
                        <div className="flex items-center gap-2 w-full">
                          <Loader2 size={14} className="animate-spin text-black/60" />
                          <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              className="h-full bg-black rounded-full"
                            />
                          </div>
                        </div>
                      ) : item.status === 'completed' ? (
                        <span className="flex items-center gap-1.5 text-black font-bold text-[10px] uppercase tracking-wider bg-black/5 px-2 py-1 rounded-sm">
                          <Check size={12} strokeWidth={2.5} /> 
                          {t.converted}
                        </span>
                      ) : item.status === 'error' ? (
                        <span className="flex items-center gap-1.5 text-red-500 font-bold text-[10px] uppercase tracking-wider bg-red-50 px-2 py-1 rounded-sm">
                          <AlertCircle size={12} strokeWidth={2} />
                          {t.failed}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest text-black">{t.ready}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'completed' ? (
                        <button 
                          onClick={() => downloadItem(item)}
                          className="p-1.5 hover:bg-black rounded-md hover:text-white transition-all border border-black/10 hover:border-black text-black active:scale-95"
                        >
                          <Download size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => convertItem(item.id)}
                          disabled={item.status === 'converting'}
                          className="p-1.5 hover:bg-black rounded-md hover:text-white transition-all border border-black/5 hover:border-black text-black active:scale-95 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-black disabled:hover:border-black/5"
                        >
                          <Plus size={14} className={item.status !== 'converting' ? "group-hover:rotate-90 transition-transform" : ""} />
                        </button>
                      )}
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-black/40 hover:bg-red-50 rounded-md hover:text-red-500 transition-all border border-transparent hover:border-red-200 active:scale-95"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {items.length === 0 && (
                <div className="h-[240px] flex flex-col gap-3 items-center justify-center bg-white border border-black/5 rounded-lg shadow-sm">
                  <div className="w-12 h-12 bg-black/[0.02] rounded-full flex items-center justify-center text-black/20 mb-2">
                    <CheckCircle size={20} />
                  </div>
                  <span className="text-black/40 font-bold text-[11px] uppercase tracking-widest">{t.noFilesInQueue}</span>
                  <span className="text-black/30 font-medium text-[12px] max-w-[200px] text-center leading-tight">{t.queueEmptyDesc}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PrivacyPolicy onBack={() => setView('converter')} lang={lang} />
      )}

      <footer className="mt-auto pt-16">
        <div className="border-t border-black/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-1 items-center md:items-start text-black">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-100 opacity-50 transition-opacity"
              onClick={() => setView('privacy')}
            >
              <ShieldCheck size={14} />
              <span className="mono-label !opacity-100">{t.privacyFooter}</span>
            </div>
            <span className="mono-label !opacity-40 !text-[9px] mt-1">{t.createdBy}</span>
          </div>
          <div className="flex gap-5 items-center">
            <button onClick={() => setView('privacy')} className="mono-label hover:text-black hover:opacity-100 transition-all text-black">{t.privacyPolicy}</button>
            <a
              href="https://github.com/kararha/snapH"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label hover:text-black hover:opacity-100 transition-all flex items-center gap-1.5 text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View on GitHub
            </a>
          </div>
        </div>
      </footer>

      {/* PWA Install Banners */}
      <AnimatePresence>
        {isInstallable && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm"
            role="status"
            aria-live="polite"
          >
            <div className="bg-white border border-black/10 rounded-xl flex items-center gap-4 p-4 shadow-xl">
              <div className="w-10 h-10 bg-black/5 rounded-full flex items-center justify-center shrink-0">
                <MonitorDown size={18} className="text-black" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-[13px] text-black leading-tight mb-0.5">{t.pwaInstallTitle}</span>
                <span className="text-[11px] font-medium text-black/50 leading-snug">{t.pwaInstallDesc}</span>
              </div>
              <button
                id="pwa-install-btn"
                onClick={triggerInstall}
                className="shrink-0 bg-black text-white font-bold text-[10px] uppercase px-4 py-2.5 rounded-md tracking-wider hover:bg-black/80 active:scale-[0.96] transition-all shadow-sm"
              >
                {t.pwaInstallButton}
              </button>
              <button
                id="pwa-dismiss-btn"
                onClick={dismissInstall}
                aria-label={t.pwaInstallDismiss}
                className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-black/10 rounded-full flex items-center justify-center text-black/40 hover:text-black shadow-sm transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </motion.div>
        )}

        {showPwaGuide && installationPath === 'SAFARI_MOBILE' && (
          <PWAInstallModal type="safari-mobile" lang={lang} onDismiss={() => setDismissedPwaGuide(true)} onPermanentDismiss={handlePermanentDismiss} />
        )}

        {showPwaGuide && installationPath === 'FIREFOX_DESKTOP' && (
          <PWAInstallModal type="firefox-desktop" lang={lang} onDismiss={() => setDismissedPwaGuide(true)} onPermanentDismiss={handlePermanentDismiss} />
        )}

        {showPwaGuide && installationPath === 'FIREFOX_MOBILE' && (
          <PWAInstallModal type="firefox-mobile" lang={lang} onDismiss={() => setDismissedPwaGuide(true)} onPermanentDismiss={handlePermanentDismiss} />
        )}

        {showPwaGuide && installationPath === 'SAFARI_DESKTOP' && (
          <PWAInstallModal type="safari-desktop" lang={lang} onDismiss={() => setDismissedPwaGuide(true)} onPermanentDismiss={handlePermanentDismiss} />
        )}

        {!isInstallable && installationPath === 'CHROMIUM_MOBILE' && !isInstalled && !dismissedPwaGuide && hasEngaged && (
          <PWAInstallModal type="chromium-mobile" lang={lang} onDismiss={() => setDismissedPwaGuide(true)} onPermanentDismiss={handlePermanentDismiss} />
        )}
      </AnimatePresence>
    </div>
  );
}
