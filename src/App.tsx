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
  Settings, 
  CheckCircle, 
  Loader2, 
  AlertCircle,
  FileUp,
  X,
  Plus,
  ShieldCheck,
  ArrowLeft,
  Lock,
  Globe,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import heic2any from 'heic2any';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { HowItWorks } from './components/HowItWorks';
import { translations, Language } from './translations';

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
  <div className="relative inline-flex items-center justify-center bg-black text-white p-1 rounded overflow-hidden" style={{ width: size + 8, height: size + 8 }}>
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
      setValidationError("Some files skipped: Only HEIC/HEIF under 50MB allowed.");
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
  }, [globalFormat]);

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

  const downloadAll = () => {
    items.forEach(item => {
      if (item.status === 'completed') downloadItem(item);
    });
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
            <h1 className="text-4xl font-bold tracking-tighter flex items-center gap-2">
              <SnapHeicLogo />
              {t.title}
            </h1>
            <p className="mono-label mt-1 group-hover:text-black transition-colors">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang('en')} 
              className={`px-3 py-1 text-[10px] font-mono border-2 transition-all ${lang === 'en' ? 'bg-black text-white border-black' : 'border-black/10 hover:border-black'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ar')} 
              className={`px-3 py-1 text-[10px] font-mono border-2 transition-all ${lang === 'ar' ? 'bg-black text-white border-black' : 'border-black/10 hover:border-black'}`}
            >
              AR
            </button>
          </div>
        </div>
        
        {view === 'converter' && (
          <div className="flex items-center gap-4 bg-white p-3 technical-border">
            <div className="flex flex-col gap-1">
              <span className="mono-label">{t.outputFormat}</span>
              <select 
                value={globalFormat}
                onChange={(e) => setGlobalFormat(e.target.value as ConversionFormat)}
                className="bg-transparent border-none text-sm font-bold focus:ring-0 cursor-pointer"
              >
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
              </select>
            </div>
          </div>
        )}
      </header>

      {view === 'converter' ? (
        <>
          <HowItWorks lang={lang} />
          {/* Upload Zone */}
          <div className="flex flex-col gap-2">
        <AnimatePresence>
          {validationError && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border-l-4 border-red-600 p-3 flex items-center gap-2 overflow-hidden"
            >
              <AlertCircle size={14} className="text-red-600" />
              <span className="mono-label text-red-600 opacity-100 lowercase font-bold">{validationError}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div 
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative h-64 border-2 border-dashed border-[#1A1A1A] flex flex-col items-center justify-center gap-4 cursor-pointer transition-all
            ${isDragging ? 'bg-black/5 scale-[0.99] border-solid' : 'bg-white hover:bg-black/[0.02]'}
            ${validationError ? 'border-red-600 bg-red-50/10' : ''}
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
          <div className="bg-[#1A1A1A] text-white p-4 rounded-full">
            <Upload size={32} />
          </div>
          <div className="text-center">
            <p className="font-bold text-xl tracking-tight">{t.dropFiles}</p>
            <p className="mono-label">{t.browseFiles}</p>
          </div>
          {items.length > 0 && (
            <div className={`absolute top-2 ${lang === 'ar' ? 'left-2' : 'right-2'} px-2 py-1 bg-black text-white font-mono text-[10px] uppercase`}>
              {items.length} {t.filesQueued}
            </div>
          )}
        </div>
      </div>

      {/* Batch Actions */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center justify-between gap-4 p-4 bg-white technical-border"
          >
            <div className="flex gap-2">
              <button 
                onClick={convertAll}
                disabled={items.every(i => i.status === 'completed' || i.status === 'converting')}
                className="flex items-center gap-2 bg-[#1A1A1A] text-white px-4 py-2 font-bold hover:opacity-90 disabled:opacity-30 transition-opacity"
              >
                <FileUp size={18} />
                {t.convertAll}
              </button>
              <button 
                onClick={downloadAll}
                disabled={!items.some(i => i.status === 'completed')}
                className="flex items-center gap-2 border-2 border-black px-4 py-2 font-bold hover:bg-black/5 disabled:opacity-30 transition-all"
              >
                <Download size={18} />
                {t.downloadAll}
              </button>
            </div>
            
            <button 
              onClick={() => {
                // Clean up object URLs so we don't hog memory
                items.forEach(item => {
                  if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                  if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
                });
                setItems([]);
              }}
              className="mono-label hover:text-red-600 transition-colors flex items-center gap-1"
            >
              <X size={12} /> {t.clearQueue}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {items.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-center justify-between bg-white p-4 technical-border gap-4 group"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 bg-black/5 flex items-center justify-center shrink-0 overflow-hidden technical-border !shadow-none border-black/10">
                  {item.status === 'completed' && item.resultUrl ? (
                    <img 
                      src={item.resultUrl} 
                      alt="Converted preview" 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={20} className="opacity-30" />
                  )}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="font-bold truncate text-sm">{item.file.name}</span>
                  <span className="mono-label">{(item.file.size / (1024 * 1024)).toFixed(2)} MB</span>
                </div>
              </div>

              {/* Progress and status */}
              <div className="flex items-center gap-8 px-4 flex-1">
                {item.status === 'converting' ? (
                  <div className="flex items-center gap-2 w-full">
                    <Loader2 size={16} className="animate-spin text-black" />
                    <div className="flex-1 h-1 bg-black/10">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress}%` }}
                        className="h-full bg-black"
                      />
                    </div>
                  </div>
                ) : item.status === 'completed' ? (
                  <span className="flex items-center gap-2 text-green-600 font-bold text-xs">
                    <CheckCircle size={16} /> 
                    <span className="mono-label text-green-600 opacity-100">{t.converted}</span>
                  </span>
                ) : item.status === 'error' ? (
                  <div className="flex flex-col min-w-0">
                    <span className="flex items-center gap-2 text-red-600 font-bold text-xs">
                      <AlertCircle size={16} />
                      <span className="mono-label text-red-600 opacity-100">{t.failed}</span>
                    </span>
                    {item.error && (
                      <span 
                        className="text-[9px] text-red-500 font-mono mt-0.5 truncate max-w-[150px] opacity-70" 
                        title={item.error}
                      >
                        {item.error}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="mono-label">{t.ready}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {item.status === 'completed' ? (
                  <button 
                    onClick={() => downloadItem(item)}
                    className="p-2 hover:bg-black hover:text-white transition-all border border-black rounded"
                    title="Download"
                  >
                    <Download size={18} />
                  </button>
                ) : (
                  <button 
                    onClick={() => convertItem(item.id)}
                    disabled={item.status === 'converting'}
                    className="p-2 hover:bg-black hover:text-white transition-all border border-transparent hover:border-black rounded group"
                    title="Convert"
                  >
                    <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                  </button>
                )}
                <button 
                  onClick={() => removeItem(item.id)}
                  className="p-2 text-red-500 hover:bg-red-50 transition-all rounded"
                  title="Remove"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {items.length === 0 && (
          <div className="h-32 flex items-center justify-center text-black/20 font-mono text-sm border-2 border-dashed border-black/10">
            {t.noFilesInQueue}
          </div>
        )}
      </div>
    </>
  ) : (
    <PrivacyPolicy onBack={() => setView('converter')} lang={lang} />
  )}

      <footer className="mt-auto pt-12 pb-4">
        <div className="border-t border-black/10 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex flex-col gap-1 items-center md:items-start">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-100 opacity-60 transition-opacity"
              onClick={() => setView('privacy')}
            >
              <ShieldCheck size={14} />
              <span className="mono-label opacity-100">{t.privacyFooter}</span>
            </div>
            <span className="mono-label !opacity-40 text-[9px]">{t.createdBy}</span>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setView('privacy')} className="mono-label hover:text-black transition-colors">{t.privacyPolicy}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
