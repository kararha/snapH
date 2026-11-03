import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Upload, 
  Download, 
  Image as ImageIcon, 
  CheckCircle, 
  Loader2, 
  AlertCircle, 
  Plus, 
  ShieldCheck, 
  X, 
  MonitorDown, 
  Zap, 
  Check,
  FileText,
  Sliders,
  Maximize2,
  Layers,
  ArrowUp,
  ArrowDown,
  Sparkles,
  FileCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { PWAInstallModal } from './components/PWAInstallModal';
import { translations, Language } from './translations';
import { usePWAInstall } from './hooks/usePWAInstall';
import { 
  OutputFormat, 
  MaxDimension, 
  PdfPageFormat,
  PdfOrientation,
  PdfMargin,
  PdfExportOptions,
  isSupportedFile, 
  isDocxFile,
  getTargetExtension, 
  convertImageFile, 
  createMergedPdf 
} from './utils/converter';

import logoIcon from './assets/logo-icon.svg';

type ConversionStatus = 'idle' | 'converting' | 'completed' | 'error';
type View = 'converter' | 'privacy';
type AppMode = 'converter' | 'image-to-pdf';

interface ConversionItem {
  id: string;
  file: File;
  previewUrl: string;
  status: ConversionStatus;
  progress: number;
  resultBlob?: Blob;
  resultUrl?: string;
  dimensions?: { width: number; height: number };
  error?: string;
  format: OutputFormat;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const SnapHeicLogo = ({ size = 28 }: { size?: number }) => (
  <div 
    className="relative inline-flex items-center justify-center bg-black text-white p-1 overflow-hidden shadow-sm rounded-md" 
    style={{ width: size + 8, height: size + 8 }}
  >
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
  const [appMode, setAppMode] = useState<AppMode>('converter');
  const [items, setItems] = useState<ConversionItem[]>([]);
  
  // Conversion settings
  const [globalFormat, setGlobalFormat] = useState<OutputFormat>('image/jpeg');
  const [quality, setQuality] = useState<number>(0.85);
  const [maxDimension, setMaxDimension] = useState<MaxDimension>('original');
  const [stripMetadata, setStripMetadata] = useState<boolean>(true);
  
  // PDF specific settings
  const [pdfPageFormat, setPdfPageFormat] = useState<PdfPageFormat>('a4');
  const [pdfOrientation, setPdfOrientation] = useState<PdfOrientation>('auto');
  const [pdfMargin, setPdfMargin] = useState<PdfMargin>('none');
  const [combinePdf, setCombinePdf] = useState<boolean>(true);

  const [isDragging, setIsDragging] = useState(false);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [isMergingPdf, setIsMergingPdf] = useState(false);
  
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
      setToasts(prev => prev.filter(item => item.id !== id));
    }, 4000);
  }, []);

  const handlePermanentDismiss = () => {
    setDismissedPwaGuide(true);
    localStorage.setItem('snapheic_pwa_dismissed', 'true');
  };

  // Keyboard Shortcuts: Cmd/Ctrl+O to open file picker, and Clipboard Paste
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'o') {
        e.preventDefault();
        fileInputRef.current?.click();
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        addFiles(e.clipboardData.files);
        showToast(lang === 'ar' ? 'تم لصق الصور من الحافظة' : 'Pasted photo(s) from clipboard', 'info');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [lang, showToast]);

  // Listen to PWA installation success if browser emits it natively
  useEffect(() => {
    const handleAppInstalled = () => {
      showToast(lang === 'ar' ? "تم تثبيت التطبيق بنجاح!" : "App installed successfully!", "success");
      setDismissedPwaGuide(true);
    };
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => window.removeEventListener('appinstalled', handleAppInstalled);
  }, [lang, showToast]);

  // Handle switching between "Image Converter" and "Images to PDF" modes
  const handleModeSwitch = (mode: AppMode) => {
    setAppMode(mode);
    if (mode === 'image-to-pdf') {
      setGlobalFormat('application/pdf');
      setItems(prev => prev.map(item => item.status === 'idle' ? { ...item, format: 'application/pdf' } : item));
    } else {
      setGlobalFormat('image/jpeg');
      setItems(prev => prev.map(item => item.status === 'idle' ? { ...item, format: 'image/jpeg' } : item));
    }
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const allFiles = Array.from(files);
    const validFiles = allFiles.filter(file => isSupportedFile(file));

    if (validFiles.length < allFiles.length) {
      showToast(t.filesSkipped, 'error');
    }

    if (validFiles.length === 0) return;

    const newItems: ConversionItem[] = validFiles.map(file => {
      const isDoc = isDocxFile(file);
      return {
        id: Math.random().toString(36).substring(7),
        file,
        previewUrl: isDoc ? '' : URL.createObjectURL(file),
        status: 'idle',
        progress: 0,
        format: isDoc ? 'application/pdf' : globalFormat
      };
    });

    setItems(prev => [...prev, ...newItems]);
    setHasEngaged(true);
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

  const moveItem = (index: number, direction: 'up' | 'down') => {
    setItems(prev => {
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[newIndex];
      updated[newIndex] = temp;
      return updated;
    });
  };

  const currentPdfOptions: PdfExportOptions = {
    pageFormat: pdfPageFormat,
    orientation: pdfOrientation,
    margin: pdfMargin
  };

  const convertItem = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.status === 'converting') return;

    setItems(prev => prev.map(i => i.id === id ? { ...i, status: 'converting', progress: 40 } : i));

    try {
      const result = await convertImageFile(item.file, {
        format: item.format,
        quality: quality,
        maxDimension: maxDimension,
        stripMetadata: stripMetadata,
        pdfOptions: currentPdfOptions
      });

      const resultUrl = URL.createObjectURL(result.blob);

      setItems(prev => prev.map(i => i.id === id ? { 
        ...i, 
        status: 'completed', 
        progress: 100, 
        resultBlob: result.blob, 
        resultUrl,
        dimensions: { width: result.width, height: result.height }
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
    if (idleItems.length === 0) return;

    setIsConvertingAll(true);
    
    // Controlled concurrency queue (2 workers)
    const concurrency = 2;
    const queue = [...idleItems];

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item) {
          await convertItem(item.id);
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, idleItems.length) }, () => worker());
    await Promise.all(workers);
    setIsConvertingAll(false);
  };

  const downloadItem = (item: ConversionItem) => {
    if (!item.resultUrl) return;
    const link = document.createElement('a');
    link.href = item.resultUrl;
    const extension = getTargetExtension(item.format);
    const sanitizedName = item.file.name
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/\.[^/.]+$/, `.${extension}`);
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
      const extension = getTargetExtension(item.format);
      const sanitizedName = item.file.name
        .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
        .replace(/\.[^/.]+$/, `.${extension}`);
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

  const downloadMergedPdf = async () => {
    const completedItems = items.filter(i => i.status === 'completed' && i.resultBlob);
    if (completedItems.length === 0) return;

    setIsMergingPdf(true);
    try {
      const pdfBlob = await createMergedPdf(
        completedItems.map(item => ({
          blob: item.resultBlob!,
          name: item.file.name
        })),
        currentPdfOptions
      );

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `snapheic_merged_document_${Date.now()}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      showToast(lang === 'ar' ? 'تم إنشاء ملف PDF بنجاح!' : 'Merged PDF created successfully!', 'success');
    } catch (err) {
      console.error('Merged PDF creation error:', err);
      showToast(lang === 'ar' ? 'فشل إنشاء ملف PDF المدمج' : 'Failed to create merged PDF', 'error');
    } finally {
      setIsMergingPdf(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const isPdfMode = appMode === 'image-to-pdf' || globalFormat === 'application/pdf';

  return (
    <div className="min-h-screen pt-8 pb-4 md:pt-14 md:pb-8 px-4 md:px-8 max-w-5xl mx-auto flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Toast Notification Overlay */}
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
              {toast.type === 'error' && <AlertCircle size={16} className="text-red-400 shrink-0" />}
              {toast.type === 'success' && <CheckCircle size={16} className="text-green-400 shrink-0" />}
              {toast.type === 'info' && <AlertCircle size={16} className="text-white/60 shrink-0" />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 w-full">
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

        {/* Primary Tool Mode Selector Tabs */}
        {view === 'converter' && (
          <div className="flex items-center gap-2 pt-2 border-b border-black/10">
            <button
              onClick={() => handleModeSwitch('converter')}
              className={`flex items-center gap-2 px-4 py-2 font-bold text-xs tracking-tight border-b-2 transition-all -mb-px ${
                appMode === 'converter'
                  ? 'border-black text-black'
                  : 'border-transparent text-black/50 hover:text-black'
              }`}
            >
              <ImageIcon size={14} />
              {t.modeImageConverter}
            </button>

            <button
              onClick={() => handleModeSwitch('image-to-pdf')}
              className={`flex items-center gap-2 px-4 py-2 font-bold text-xs tracking-tight border-b-2 transition-all -mb-px ${
                appMode === 'image-to-pdf'
                  ? 'border-black text-black'
                  : 'border-transparent text-black/50 hover:text-black'
              }`}
            >
              <FileText size={14} className="text-red-500" />
              {t.modeImageToPdf}
              <span className="bg-red-50 text-red-600 text-[9px] px-1.5 py-0.2 rounded font-mono font-bold">PDF</span>
            </button>
          </div>
        )}

        {/* Settings Bar */}
        {view === 'converter' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-white technical-border">
            {/* Format Selector (or disabled in PDF mode) */}
            <div className="flex flex-col gap-1">
              <span className="mono-label !text-[9px] flex items-center gap-1">
                <Layers size={10} />
                {t.outputFormat}
              </span>
              <select 
                value={globalFormat}
                disabled={appMode === 'image-to-pdf'}
                onChange={(e) => {
                  const newFormat = e.target.value as OutputFormat;
                  setGlobalFormat(newFormat);
                  setItems(prev => prev.map(item => item.status === 'idle' ? { ...item, format: newFormat } : item));
                }}
                className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer disabled:opacity-80"
              >
                <option value="image/jpeg">JPEG (.jpg)</option>
                <option value="image/png">PNG (.png)</option>
                <option value="image/webp">WebP (.webp)</option>
                <option value="application/pdf">PDF (.pdf)</option>
              </select>
            </div>

            {/* If in PDF mode: Page Size, else: Quality */}
            {isPdfMode ? (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <FileText size={10} />
                  {t.pdfPageSize}
                </span>
                <select 
                  value={pdfPageFormat}
                  onChange={(e) => setPdfPageFormat(e.target.value as PdfPageFormat)}
                  className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  <option value="a4">{t.pageSizeA4}</option>
                  <option value="letter">{t.pageSizeLetter}</option>
                  <option value="fit">{t.pageSizeFit}</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <Sliders size={10} />
                  {t.quality}
                </span>
                <select 
                  value={quality}
                  disabled={globalFormat === 'image/png'}
                  onChange={(e) => setQuality(parseFloat(e.target.value))}
                  className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer disabled:opacity-40"
                >
                  <option value={0.9}>{t.qualityHigh}</option>
                  <option value={0.8}>{t.qualityBalanced}</option>
                  <option value={0.65}>{t.qualityCompact}</option>
                </select>
              </div>
            )}

            {/* If in PDF mode: Orientation, else: Max Dimension */}
            {isPdfMode ? (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <Maximize2 size={10} />
                  {t.pdfOrientation}
                </span>
                <select 
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value as PdfOrientation)}
                  className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  <option value="auto">{t.orientationAuto}</option>
                  <option value="portrait">{t.orientationPortrait}</option>
                  <option value="landscape">{t.orientationLandscape}</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <Maximize2 size={10} />
                  {t.maxDimension}
                </span>
                <select 
                  value={maxDimension}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxDimension(val === 'original' ? 'original' : (parseInt(val, 10) as MaxDimension));
                  }}
                  className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  <option value="original">{t.originalSize}</option>
                  <option value={3840}>{t.dimension4K}</option>
                  <option value={1920}>{t.dimension1080p}</option>
                  <option value={1200}>{t.dimension1200p}</option>
                  <option value={800}>{t.dimension800p}</option>
                </select>
              </div>
            )}

            {/* If in PDF mode: Margins, else: Strip GPS & EXIF */}
            {isPdfMode ? (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <ShieldCheck size={10} />
                  {t.pdfMargin}
                </span>
                <select 
                  value={pdfMargin}
                  onChange={(e) => setPdfMargin(e.target.value as PdfMargin)}
                  className="bg-black/[0.03] border border-black/10 rounded-md px-2.5 py-1.5 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer"
                >
                  <option value="none">{t.marginNone}</option>
                  <option value="small">{t.marginSmall}</option>
                  <option value="normal">{t.marginNormal}</option>
                </select>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <ShieldCheck size={10} />
                  {t.securityArchitecture}
                </span>
                <button
                  type="button"
                  onClick={() => setStripMetadata(!stripMetadata)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-md border transition-all active:scale-95 ${
                    stripMetadata 
                      ? 'bg-black text-white border-black shadow-xs' 
                      : 'bg-black/[0.03] text-black/60 border-black/10 hover:border-black/30'
                  }`}
                  title={t.stripMetadataDesc}
                >
                  <ShieldCheck size={13} className={stripMetadata ? "text-green-400" : ""} />
                  <span className="truncate">{t.stripMetadata}</span>
                </button>
              </div>
            )}
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
                relative h-[430px] flex flex-col items-center justify-center p-6 cursor-pointer transition-colors technical-border group overflow-hidden
                ${isDragging ? 'bg-black/5 border-dashed border-2' : 'bg-white hover:bg-black/[0.02]'}
              `}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                hidden 
                multiple 
                accept=".heic,.heif,.webp,.avif,.png,.jpg,.jpeg,.docx,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => e.target.files && addFiles(e.target.files)}
              />
              
              <motion.div 
                animate={{ y: isDragging ? -10 : 0 }}
                className="flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center mb-6 text-black/80 group-hover:bg-black/10 transition-colors shadow-sm">
                  {isPdfMode ? (
                    <FileText size={28} strokeWidth={1.5} className="text-red-500" />
                  ) : (
                    <Upload size={28} strokeWidth={1.5} />
                  )}
                </div>
                
                <h2 className="font-extrabold text-[22px] tracking-tight mb-2 text-black text-center">
                  {isPdfMode ? t.dropImagesToPdf : t.dropFiles}
                </h2>
                <p className="text-[13px] font-medium text-black/50 mb-3 text-center max-w-[280px] leading-snug">
                  {isPdfMode ? t.dropImagesToPdfSubtitle : t.dropFilesSubtitle}
                </p>
                <p className="text-[10px] font-mono text-black/40 mb-6 uppercase tracking-wider">
                  {t.allFormatsSupported}
                </p>
                
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
              <div className="absolute bottom-5 flex flex-wrap justify-center gap-2 text-[10px] font-semibold text-black/40 px-4">
                <div className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm"><ShieldCheck size={12} /> 100% Local</div>
                <div className="flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm"><Zap size={12} /> Fast</div>
                <div className="hidden sm:flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm border border-black/5">⌘O / Ctrl+O</div>
                <div className="hidden sm:flex items-center gap-1.5 bg-black/5 px-2 py-1 rounded-sm border border-black/5">⌘V Paste</div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Queue / Pages */}
          <div className="flex flex-col">
            <div className="border-b border-black/10 pb-4 mb-5 flex flex-wrap justify-between items-end gap-3 px-1">
              <h2 className="font-bold text-xs uppercase tracking-widest text-black/60 flex items-center gap-2">
                {isPdfMode ? t.pdfPagesTitle : t.queueTitle} 
                <span className="bg-black/10 text-black px-1.5 py-0.5 rounded-sm text-[9px]">{items.length}</span>
              </h2>
              {items.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  <button 
                    onClick={convertAll}
                    disabled={isConvertingAll || items.every(i => i.status === 'completed' || i.status === 'converting')}
                    className="text-[10px] font-bold uppercase tracking-widest text-black hover:text-black/70 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center gap-1 bg-black/5 px-2.5 py-1 rounded"
                  >
                    {isConvertingAll && <Loader2 size={11} className="animate-spin" />}
                    {t.convertAll}
                  </button>

                  {/* Primary PDF Document Export */}
                  {isPdfMode && items.some(i => i.status === 'completed') && (
                    <button 
                      onClick={downloadMergedPdf}
                      disabled={isMergingPdf}
                      className="text-[10px] font-bold uppercase tracking-widest text-white bg-black hover:bg-black/80 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center gap-1 px-3 py-1 rounded shadow-sm"
                      title={t.exportMergedPdfButton}
                    >
                      {isMergingPdf ? <Loader2 size={11} className="animate-spin" /> : <FileCheck size={12} />}
                      {t.exportMergedPdfButton} ({items.filter(i => i.status === 'completed').length})
                    </button>
                  )}

                  {!isPdfMode && items.some(i => i.status === 'completed') && (
                    <button 
                      onClick={downloadAll}
                      className="text-[10px] font-bold uppercase tracking-widest text-black hover:text-black/70 active:scale-[0.98] transition-all bg-black/5 px-2.5 py-1 rounded"
                    >
                      {t.downloadAll}
                    </button>
                  )}

                  <button 
                    onClick={() => {
                      items.forEach(item => {
                        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                        if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
                      });
                      setItems([]);
                    }}
                    className="text-[10px] font-bold uppercase tracking-widest text-black/40 hover:text-red-500 active:scale-[0.98] transition-colors px-2 py-1"
                  >
                    {t.clearQueue}
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {items.map((item, index) => (
                  <motion.div
                    layout
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.98, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -10 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    className="flex items-center justify-between p-3 gap-3 group technical-border !shadow-sm hover:!shadow-md transition-shadow"
                  >
                    {/* Item Thumbnail & File Info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {isPdfMode && (
                        <div className="w-6 h-6 bg-black/5 rounded flex items-center justify-center font-mono font-bold text-[10px] text-black shrink-0">
                          {index + 1}
                        </div>
                      )}

                      <div className="w-12 h-12 bg-black/[0.03] rounded-md flex items-center justify-center shrink-0 border border-black/5 overflow-hidden">
                        {isDocxFile(item.file) ? (
                          <FileText size={22} className="text-blue-600" />
                        ) : item.status === 'completed' && item.resultUrl ? (
                          item.format === 'application/pdf' ? (
                            <FileText size={22} className="text-red-500" />
                          ) : (
                            <img 
                              src={item.resultUrl} 
                              alt="Converted preview" 
                              className="w-full h-full object-cover"
                            />
                          )
                        ) : item.previewUrl ? (
                          <img 
                            src={item.previewUrl} 
                            alt="Original preview" 
                            className="w-full h-full object-cover opacity-80"
                          />
                        ) : (
                          <ImageIcon size={18} strokeWidth={1.5} className="opacity-40 text-black" />
                        )}
                      </div>

                      <div className="flex flex-col min-w-0 text-black">
                        <span className="font-bold truncate text-xs">{item.file.name}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono opacity-50 font-medium">
                            {formatFileSize(item.file.size)}
                          </span>
                          {item.dimensions && (
                            <span className="text-[9px] font-mono text-black/40 bg-black/5 px-1 py-0.2 rounded">
                              {item.dimensions.width}×{item.dimensions.height}
                            </span>
                          )}
                          {item.status === 'completed' && item.resultBlob && (
                            <span className="text-[10px] font-mono font-bold text-green-700">
                              → {formatFileSize(item.resultBlob.size)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Progress & Status */}
                    <div className="flex items-center gap-3 px-2">
                      {item.status === 'converting' ? (
                        <div className="flex items-center gap-2 min-w-[90px]">
                          <Loader2 size={14} className="animate-spin text-black/60 shrink-0" />
                          <div className="flex-1 h-1.5 bg-black/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              className="h-full bg-black rounded-full"
                            />
                          </div>
                        </div>
                      ) : item.status === 'completed' ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="flex items-center gap-1 text-black font-bold text-[10px] uppercase tracking-wider bg-black/5 px-2 py-0.5 rounded-sm">
                            <Check size={11} strokeWidth={2.5} /> 
                            {t.converted}
                          </span>
                          {stripMetadata && item.format !== 'application/pdf' && (
                            <span className="text-[8px] font-mono text-green-700 opacity-80">
                              {t.gpsScrubbed}
                            </span>
                          )}
                        </div>
                      ) : item.status === 'error' ? (
                        <span className="flex items-center gap-1.5 text-red-500 font-bold text-[10px] uppercase tracking-wider bg-red-50 px-2 py-1 rounded-sm">
                          <AlertCircle size={12} strokeWidth={2} />
                          {t.failed}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest text-black">{t.ready}</span>
                      )}
                    </div>

                    {/* Action & Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      {/* Page Reorder buttons in PDF mode */}
                      {isPdfMode && items.length > 1 && (
                        <div className="flex flex-col -space-y-1 mr-1">
                          <button
                            onClick={() => moveItem(index, 'up')}
                            disabled={index === 0}
                            className="p-1 hover:text-black text-black/30 disabled:opacity-10 transition-colors"
                            title={t.moveUp}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => moveItem(index, 'down')}
                            disabled={index === items.length - 1}
                            className="p-1 hover:text-black text-black/30 disabled:opacity-10 transition-colors"
                            title={t.moveDown}
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>
                      )}

                      {item.status === 'completed' ? (
                        <button 
                          onClick={() => downloadItem(item)}
                          className="p-1.5 hover:bg-black rounded-md hover:text-white transition-all border border-black/10 hover:border-black text-black active:scale-95"
                          title="Download"
                        >
                          <Download size={14} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => convertItem(item.id)}
                          disabled={item.status === 'converting'}
                          className="p-1.5 hover:bg-black rounded-md hover:text-white transition-all border border-black/5 hover:border-black text-black active:scale-95 disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-black disabled:hover:border-black/5"
                          title="Convert"
                        >
                          <Plus size={14} className={item.status !== 'converting' ? "group-hover:rotate-90 transition-transform" : ""} />
                        </button>
                      )}
                      
                      <button 
                        onClick={() => removeItem(item.id)}
                        className="p-1.5 text-black/40 hover:bg-red-50 rounded-md hover:text-red-500 transition-all border border-transparent hover:border-red-200 active:scale-95"
                        title="Remove"
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
                  <span className="text-black/30 font-medium text-[12px] max-w-[240px] text-center leading-tight">{t.queueEmptyDesc}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <PrivacyPolicy onBack={() => setView('converter')} lang={lang} />
      )}

      {/* Footer */}
      <footer className="mt-auto pt-10">
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
