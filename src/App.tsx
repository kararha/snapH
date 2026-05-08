/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
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
  MonitorDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import heic2any from 'heic2any';
import JSZip from 'jszip';
import { PrivacyPolicy } from './components/PrivacyPolicy';
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

const SnapHeicLogo = ({ size = 28 }: { size?: number }) => (
  <div className="relative inline-flex items-center justify-center bg-black text-white p-1 overflow-hidden" style={{ width: size + 8, height: size + 8 }}>
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
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isInstallable, triggerInstall, dismissInstall } = usePWAInstall();

  const addFiles = useCallback((files: FileList | File[]) => {
    const allFiles = Array.from(files);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB size limit to prevent memory exhaustion
    
    const validHeicFiles = allFiles.filter(file => {
      const name = file.name.toLowerCase();
      const isValidExt = name.endsWith('.heic') || name.endsWith('.heif');
      const isValidSize = file.size <= MAX_FILE_SIZE;
      return isValidExt && isValidSize;
    });

    if (validHeicFiles.length < allFiles.length) {
      setValidationError(t.filesSkipped);
      setTimeout(() => setValidationError(null), 4000);
    }

    if (validHeicFiles.length === 0) return;

    const newItems: ConversionItem[] = validHeicFiles.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      previewUrl: URL.createObjectURL(file), // Note: HEIC won't show in browser normally, this is just a placeholder reference
      status: 'idle',
      progress: 0,
      format: globalFormat
    }));

    setItems(prev => [...prev, ...newItems]);
  }, [globalFormat, t]);

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
      // Sanitize error message to prevent technical information disclosure in UI
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
    // Sanitize filename to prevent malicious or malformed file saves
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
    <div className="min-h-screen p-4 md:p-8 max-w-5xl mx-auto flex flex-col gap-8" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col md:flex-row md:items-end gap-4 w-full justify-between">
          <div 
            className="cursor-pointer group flex flex-col"
            onClick={() => setView('converter')}
          >
            <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-2 text-black">
              <SnapHeicLogo />
              {t.title}
            </h1>
            <p className="mono-label mt-1 text-black">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang('en')} 
              className={`px-3 py-1 text-[10px] font-mono border transition-all ${lang === 'en' ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black text-black'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ar')} 
              className={`px-3 py-1 text-[10px] font-mono border transition-all ${lang === 'ar' ? 'bg-black text-white border-black' : 'border-black/20 hover:border-black text-black'}`}
            >
              AR
            </button>
          </div>
        </div>
        
        {view === 'converter' && (
          <div className="flex items-center gap-4 p-3 technical-border">
            <div className="flex flex-col gap-1">
              <span className="mono-label">{t.outputFormat}</span>
              <select 
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as ConversionFormat)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer text-black"
              >
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {view === 'converter' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Upload Area */}
          <div className="flex flex-col">
            <AnimatePresence>
              {validationError && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-3 flex items-center gap-2 overflow-hidden mb-4 technical-border"
                >
                  <AlertCircle size={14} className="text-black" />
                  <span className="mono-label text-black opacity-100 lowercase font-bold">{validationError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <div 
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative h-[400px] flex flex-col items-center justify-center gap-6 cursor-pointer transition-all technical-border
                ${isDragging ? 'bg-black/5' : 'hover:bg-black/[0.02]'}
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
              <Upload size={32} strokeWidth={1} className="text-black" />
              <div className="text-center flex flex-col items-center">
                <h2 className="font-bold text-xl tracking-tight mb-2 text-black">{t.dropFiles}</h2>
                <p className="text-sm text-black/60 mb-6">{t.dropFilesSubtitle}</p>
                <button 
                  className="bg-black text-white font-bold text-xs uppercase px-6 py-3 tracking-wider hover:bg-black/90 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  {t.browseFiles}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Queue */}
          <div className="flex flex-col">
            <div className="border-b border-black pb-3 mb-4 flex justify-between items-end">
              <h2 className="font-bold text-sm uppercase tracking-widest text-black">{t.queueTitle} ({items.length})</h2>
              {items.length > 0 && (
                <div className="flex gap-4">
                  <button 
                    onClick={convertAll}
                    disabled={items.every(i => i.status === 'completed' || i.status === 'converting')}
                    className="text-[10px] font-bold font-mono uppercase text-black hover:underline disabled:opacity-30"
                  >
                    {t.convertAll}
                  </button>
                  <button 
                    onClick={downloadAll}
                    disabled={!items.some(i => i.status === 'completed')}
                    className="text-[10px] font-bold font-mono uppercase text-black hover:underline disabled:opacity-30"
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
                    className="text-[10px] font-mono uppercase text-black/50 hover:text-black transition-colors"
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
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex items-center justify-between p-3 gap-4 group technical-border"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 bg-black/5 flex items-center justify-center shrink-0 border border-black/10">
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
                        <span className="text-[10px] font-mono opacity-50">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 px-2 flex-1">
                      {item.status === 'converting' ? (
                        <div className="flex items-center gap-2 w-full">
                          <Loader2 size={14} className="animate-spin text-black" />
                          <div className="flex-1 h-1 bg-black/10">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              className="h-full bg-black"
                            />
                          </div>
                        </div>
                      ) : item.status === 'completed' ? (
                        <span className="flex items-center gap-1.5 text-black font-bold text-[10px] uppercase tracking-wider">
                          <CheckCircle size={14} strokeWidth={1.5} /> 
                          {t.converted}
                        </span>
                      ) : item.status === 'error' ? (
                        <span className="flex items-center gap-1.5 text-black font-bold text-[10px] uppercase tracking-wider">
                          <AlertCircle size={14} strokeWidth={1.5} />
                          {t.failed}
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono opacity-50 uppercase tracking-widest text-black">{t.ready}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {item.status === 'completed' ? (
                        <button 
                          onClick={() => downloadItem(item)}
                          className="p-1.5 hover:bg-black hover:text-white transition-all border border-black text-black"
                        >
                          <Download size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => convertItem(item.id)}
                          disabled={item.status === 'converting'}
                          className="p-1.5 hover:bg-black hover:text-white transition-all border border-transparent hover:border-black group text-black"
                        >
                          <Plus size={14} className="group-hover:rotate-90 transition-transform" />
                        </button>
                      )}
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-black hover:bg-black hover:text-white transition-all border border-transparent hover:border-black"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {items.length === 0 && (
                <div className="h-[200px] flex items-center justify-center technical-border">
                  <span className="text-black font-bold text-sm uppercase tracking-widest">QUEUE IS EMPTY</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PrivacyPolicy onBack={() => setView('converter')} lang={lang} />
      )}

      <footer className="mt-auto pt-12 pb-4">
        <div className="border-t border-black/10 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1 items-center md:items-start text-black">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-100 opacity-60 transition-opacity"
              onClick={() => setView('privacy')}
            >
              <ShieldCheck size={14} />
              <span className="mono-label opacity-100">{t.privacyFooter}</span>
            </div>
            <span className="mono-label !opacity-40 text-[9px]">{t.createdBy}</span>
          </div>
          <div className="flex gap-4 items-center">
            <button onClick={() => setView('privacy')} className="mono-label hover:text-black transition-colors text-black">{t.privacyPolicy}</button>
            <a
              href="https://github.com/kararha/snapH"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label hover:text-black transition-colors flex items-center gap-1 text-black"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>
              View on GitHub
            </a>
          </div>
        </div>
      </footer>
      {/* PWA Install Toast Banner */}
      <AnimatePresence>
        {isInstallable && (
          <motion.div
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md"
            role="status"
            aria-live="polite"
          >
            <div className="bg-black text-white technical-border flex items-center gap-4 p-4 shadow-2xl">
              <MonitorDown size={20} className="shrink-0" />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-sm uppercase tracking-widest">{t.pwaInstallTitle}</span>
                <span className="text-[10px] font-mono opacity-60 mt-0.5">{t.pwaInstallDesc}</span>
              </div>
              <button
                id="pwa-install-btn"
                onClick={triggerInstall}
                className="shrink-0 bg-white text-black font-bold text-[10px] uppercase px-4 py-2 tracking-wider hover:bg-white/90 transition-colors"
              >
                {t.pwaInstallButton}
              </button>
              <button
                id="pwa-dismiss-btn"
                onClick={dismissInstall}
                aria-label={t.pwaInstallDismiss}
                className="shrink-0 p-1.5 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
