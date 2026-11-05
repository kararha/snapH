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
  Eye,
  Sparkles,
  FileCheck,
  RefreshCw,
  FolderOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { PrivacyPolicy } from './components/PrivacyPolicy';
import { HowItWorks } from './components/HowItWorks';
import { PWAInstallModal } from './components/PWAInstallModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
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

const SnapHeicLogo = ({ size = 36 }: { size?: number }) => (
  <div 
    className="relative inline-flex items-center justify-center shrink-0 drop-shadow-xs" 
    style={{ width: size, height: size }}
  >
    <img src={logoIcon} style={{ width: size, height: size }} alt="SnapHeic" />
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

  const [isDragging, setIsDragging] = useState(false);
  const [isConvertingAll, setIsConvertingAll] = useState(false);
  const [isMergingPdf, setIsMergingPdf] = useState(false);
  
  // Preview Modal state
  const [inspectItem, setInspectItem] = useState<ConversionItem | null>(null);

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

  const applyPreset = (preset: 'heic-jpg' | 'heic-webp' | 'photos-pdf' | 'word-pdf' | 'downscale-1080') => {
    if (preset === 'heic-jpg') {
      setAppMode('converter');
      setGlobalFormat('image/jpeg');
      setQuality(0.9);
      setMaxDimension('original');
    } else if (preset === 'heic-webp') {
      setAppMode('converter');
      setGlobalFormat('image/webp');
      setQuality(0.8);
      setMaxDimension('original');
    } else if (preset === 'photos-pdf') {
      setAppMode('image-to-pdf');
      setGlobalFormat('application/pdf');
      setPdfPageFormat('a4');
    } else if (preset === 'word-pdf') {
      setAppMode('image-to-pdf');
      setGlobalFormat('application/pdf');
    } else if (preset === 'downscale-1080') {
      setAppMode('converter');
      setGlobalFormat('image/jpeg');
      setQuality(0.8);
      setMaxDimension(1920);
    }
    fileInputRef.current?.click();
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

  // Calculate batch metrics
  const totalInputBytes = items.reduce((acc, curr) => acc + curr.file.size, 0);
  const completedItems = items.filter(i => i.status === 'completed' && i.resultBlob);
  const totalOutputBytes = completedItems.reduce((acc, curr) => acc + (curr.resultBlob?.size || 0), 0);
  const netSavedBytes = Math.max(0, totalInputBytes - totalOutputBytes);
  const netSavedPercent = totalInputBytes > 0 && completedItems.length === items.length
    ? Math.round((netSavedBytes / totalInputBytes) * 100)
    : 0;

  return (
    <div className="min-h-screen pt-6 pb-6 md:pt-10 md:pb-12 px-4 md:px-8 max-w-6xl mx-auto flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      {/* Toast Notification Overlay */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="pointer-events-auto bg-[#0B0B0C] text-[#F4F1EA] border border-[#D6FF3F]/30 px-4 py-3 rounded-lg shadow-2xl flex items-center gap-3 text-sm font-medium"
            >
              {toast.type === 'error' && <AlertCircle size={16} className="text-[#FF4B1F] shrink-0" />}
              {toast.type === 'success' && <CheckCircle size={16} className="text-[#D6FF3F] shrink-0" />}
              {toast.type === 'info' && <AlertCircle size={16} className="text-white/60 shrink-0" />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Image Inspection & Audit Modal */}
      <ImagePreviewModal
        isOpen={inspectItem !== null}
        onClose={() => setInspectItem(null)}
        lang={lang}
        item={inspectItem}
      />

      {/* Header */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 w-full">
          <div 
            className="cursor-pointer group flex flex-col"
            onClick={() => setView('converter')}
          >
            <div className="flex items-center gap-3">
              <SnapHeicLogo size={38} />
              {lang === 'ar' ? (
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0B0B0C] flex items-center gap-2">
                  <span>سناب</span>
                  <span className="bg-[#D6FF3F] text-[#0B0B0C] px-2 py-0.5 rounded-xs">هيك</span>
                </h1>
              ) : (
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-[#0B0B0C] flex items-center font-display">
                  <span>SNAP</span>
                  <span className="bg-[#D6FF3F] text-[#0B0B0C] px-2 py-0.5 ml-1.5 rounded-xs">HEIC</span>
                </h1>
              )}
            </div>
            <p className="font-mono text-[11px] font-medium tracking-wide text-[#0B0B0C]/60 mt-1.5 uppercase">
              {t.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => setLang('en')} 
              className={`px-3 py-1.5 text-[10px] rounded-md font-mono border transition-all active:scale-[0.98] ${lang === 'en' ? 'bg-[#0B0B0C] text-[#F4F1EA] border-[#0B0B0C] shadow-xs' : 'border-[#0B0B0C]/15 hover:border-[#0B0B0C]/40 text-[#0B0B0C]/70 hover:text-[#0B0B0C] bg-white'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('ar')} 
              className={`px-3 py-1.5 text-[10px] rounded-md font-mono border transition-all active:scale-[0.98] ${lang === 'ar' ? 'bg-[#0B0B0C] text-[#F4F1EA] border-[#0B0B0C] shadow-xs' : 'border-[#0B0B0C]/15 hover:border-[#0B0B0C]/40 text-[#0B0B0C]/70 hover:text-[#0B0B0C] bg-white'}`}
            >
              AR
            </button>
          </div>
        </div>
      </header>

      {view === 'converter' ? (
        /* ========================================================================= */
        /* TWO-COLUMN REDESIGN: Big Box (Workspace) on Left, Options/PDF on Right    */
        /* ========================================================================= */
        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Hidden File Input */}
          <input 
            type="file" 
            ref={fileInputRef} 
            hidden 
            multiple 
            accept=".heic,.heif,.webp,.avif,.png,.jpg,.jpeg,.docx,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />

          {/* ========================================================================= */}
          {/* LEFT SIDE: Big Box (Dropzone / Queue Workspace)                          */}
          {/* ========================================================================= */}
          <div className="flex flex-col gap-6 w-full min-w-0">
            {items.length === 0 ? (
              /* EMPTY STATE: Hero Big Box Dropzone */
              <div className="flex flex-col gap-6">
                <motion.div 
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  animate={{ 
                    scale: isDragging ? 0.99 : 1,
                    borderColor: isDragging ? '#0B0B0C' : 'rgba(11,11,12,0.15)'
                  }}
                  className={`
                    relative min-h-[420px] md:min-h-[460px] flex flex-col items-center justify-center p-8 cursor-pointer transition-all technical-border group overflow-hidden
                    ${isDragging ? 'bg-[#D6FF3F]/10 border-dashed border-2 shadow-lg' : 'bg-white hover:bg-white/90'}
                  `}
                >
                  {/* Viewfinder Corner Accents */}
                  <div className="absolute top-4 left-4 w-5 h-5 border-t-2 border-l-2 border-[#0B0B0C]/40 group-hover:border-[#0B0B0C] transition-colors" />
                  <div className="absolute top-4 right-4 w-5 h-5 border-t-2 border-r-2 border-[#0B0B0C]/40 group-hover:border-[#0B0B0C] transition-colors" />
                  <div className="absolute bottom-4 left-4 w-5 h-5 border-b-2 border-l-2 border-[#0B0B0C]/40 group-hover:border-[#0B0B0C] transition-colors" />
                  <div className="absolute bottom-4 right-4 w-5 h-5 border-b-2 border-r-2 border-[#0B0B0C]/40 group-hover:border-[#0B0B0C] transition-colors" />

                  <motion.div 
                    animate={{ y: isDragging ? -8 : 0 }}
                    className="flex flex-col items-center justify-center max-w-md text-center"
                  >
                    <div className="w-20 h-20 bg-[#0B0B0C]/5 rounded-full flex items-center justify-center mb-6 text-[#0B0B0C] group-hover:scale-105 group-hover:bg-[#D6FF3F] transition-all shadow-xs">
                      {isPdfMode ? (
                        <FileText size={36} strokeWidth={1.75} className="text-[#0B0B0C]" />
                      ) : (
                        <Upload size={36} strokeWidth={1.75} className="text-[#0B0B0C]" />
                      )}
                    </div>
                    
                    <h2 className="font-extrabold text-2xl md:text-3xl tracking-tight mb-2 text-[#0B0B0C]">
                      {isPdfMode ? t.dropImagesToPdf : t.dropFiles}
                    </h2>
                    <p className="text-sm font-medium text-[#0B0B0C]/60 mb-5 leading-relaxed">
                      {isPdfMode ? t.dropImagesToPdfSubtitle : t.dropFilesSubtitle}
                    </p>

                    {/* Format Badges */}
                    <div className="flex flex-wrap justify-center gap-1.5 mb-8">
                      {['HEIC', 'HEIF', 'WEBP', 'AVIF', 'PNG', 'JPG', 'DOCX'].map(fmt => (
                        <span key={fmt} className="font-mono text-[9px] font-bold px-2 py-0.5 bg-[#0B0B0C]/5 text-[#0B0B0C]/70 rounded-xs border border-[#0B0B0C]/10">
                          .{fmt.toLowerCase()}
                        </span>
                      ))}
                      <span className="font-mono text-[9px] font-bold px-2 py-0.5 bg-[#D6FF3F] text-[#0B0B0C] rounded-xs border border-[#0B0B0C]/20">
                        → {isPdfMode ? 'PDF' : globalFormat.split('/')[1].toUpperCase()}
                      </span>
                    </div>
                    
                    <button 
                      className="bg-[#0B0B0C] text-[#F4F1EA] font-bold text-xs rounded-md uppercase px-10 py-3.5 tracking-widest hover:bg-[#0B0B0C]/85 active:scale-[0.98] transition-all shadow-md focus:ring-2 focus:ring-[#0B0B0C]/20 focus:outline-none"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      {t.browseFiles}
                    </button>
                  </motion.div>

                  {/* Footer Microcopy Badges */}
                  <div className="absolute bottom-5 flex flex-wrap justify-center gap-3 text-[10px] font-semibold text-[#0B0B0C]/50 px-4">
                    <div className="flex items-center gap-1.5 bg-[#0B0B0C]/5 px-2.5 py-1 rounded-sm">
                      <ShieldCheck size={12} className="text-emerald-700" /> 100% Local (Zero Uploads)
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-[#0B0B0C]/5 px-2.5 py-1 rounded-sm border border-[#0B0B0C]/10 font-mono">
                      ⌘O Browse
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-[#0B0B0C]/5 px-2.5 py-1 rounded-sm border border-[#0B0B0C]/10 font-mono">
                      ⌘V Paste
                    </div>
                  </div>
                </motion.div>

                {/* 3 Value Cards Below Dropzone */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="p-4 bg-white/80 technical-border flex flex-col">
                    <div className="w-7 h-7 rounded-md bg-[#0B0B0C] text-[#D6FF3F] flex items-center justify-center mb-2.5">
                      <Zap size={14} />
                    </div>
                    <h3 className="font-bold text-xs text-[#0B0B0C] mb-1">{t.feature1Title}</h3>
                    <p className="text-[11px] text-[#0B0B0C]/60 leading-relaxed">{t.feature1Desc}</p>
                  </div>

                  <div className="p-4 bg-white/80 technical-border flex flex-col">
                    <div className="w-7 h-7 rounded-md bg-[#0B0B0C] text-[#D6FF3F] flex items-center justify-center mb-2.5">
                      <ShieldCheck size={14} />
                    </div>
                    <h3 className="font-bold text-xs text-[#0B0B0C] mb-1">{t.feature2Title}</h3>
                    <p className="text-[11px] text-[#0B0B0C]/60 leading-relaxed">{t.feature2Desc}</p>
                  </div>

                  <div className="p-4 bg-white/80 technical-border flex flex-col">
                    <div className="w-7 h-7 rounded-md bg-[#0B0B0C] text-[#D6FF3F] flex items-center justify-center mb-2.5">
                      <FileText size={14} />
                    </div>
                    <h3 className="font-bold text-xs text-[#0B0B0C] mb-1">{t.feature3Title}</h3>
                    <p className="text-[11px] text-[#0B0B0C]/60 leading-relaxed">{t.feature3Desc}</p>
                  </div>
                </div>

                {/* How it works */}
                <HowItWorks lang={lang} />
              </div>
            ) : (
              /* ACTIVE STATE: Comprehensive Queue & Dashboard */
              <div className="flex flex-col gap-4">
                {/* Batch Dashboard Bar */}
                <div className="p-4 bg-white technical-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-5">
                    <div className="flex flex-col">
                      <span className="mono-label !text-[9px]">{t.summaryTotal}</span>
                      <span className="font-extrabold text-sm text-[#0B0B0C] font-mono">{items.length} files</span>
                    </div>

                    <div className="w-px h-7 bg-[#0B0B0C]/10 hidden sm:block" />

                    <div className="flex flex-col">
                      <span className="mono-label !text-[9px]">{t.summaryOriginal}</span>
                      <span className="font-bold text-sm text-[#0B0B0C] font-mono">{formatFileSize(totalInputBytes)}</span>
                    </div>

                    {completedItems.length > 0 && (
                      <>
                        <div className="w-px h-7 bg-[#0B0B0C]/10 hidden sm:block" />
                        <div className="flex flex-col">
                          <span className="mono-label !text-[9px]">{t.summaryConverted}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-sm text-emerald-800 font-mono">
                              {formatFileSize(totalOutputBytes)}
                            </span>
                            {netSavedPercent > 0 && (
                              <span className="bg-[#D6FF3F] text-[#0B0B0C] font-mono font-bold text-[9px] px-1 py-0.2 rounded-xs">
                                -{netSavedPercent}%
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={convertAll}
                      disabled={isConvertingAll || items.every(i => i.status === 'completed' || i.status === 'converting')}
                      className="bg-[#0B0B0C] text-[#F4F1EA] hover:bg-[#0B0B0C]/85 px-3.5 py-1.5 rounded-md font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-30 flex items-center gap-1.5 shadow-xs"
                    >
                      {isConvertingAll ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                      {t.convertAll}
                    </button>

                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-white border border-[#0B0B0C]/20 hover:border-[#0B0B0C] text-[#0B0B0C] px-3 py-1.5 rounded-md font-bold text-xs tracking-tight transition-all flex items-center gap-1"
                    >
                      <Plus size={13} />
                      {t.addMoreFiles}
                    </button>

                    <button 
                      onClick={() => {
                        items.forEach(item => {
                          if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
                          if (item.resultUrl) URL.revokeObjectURL(item.resultUrl);
                        });
                        setItems([]);
                      }}
                      className="p-1.5 text-[#0B0B0C]/40 hover:text-[#FF4B1F] rounded-md transition-colors"
                      title={t.clearQueue}
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>

                {/* Queue Items List */}
                <div className="flex flex-col gap-2.5">
                  <AnimatePresence mode="popLayout">
                    {items.map((item, index) => (
                      <motion.div
                        layout
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: -10 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                        className="flex items-center justify-between p-3 gap-3.5 group bg-white technical-border hover:shadow-md transition-shadow"
                      >
                        {/* Left: Thumbnail & Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {isPdfMode && (
                            <div className="w-6 h-6 bg-[#0B0B0C]/5 rounded-md flex items-center justify-center font-mono font-bold text-[11px] text-[#0B0B0C] shrink-0 border border-[#0B0B0C]/10">
                              {index + 1}
                            </div>
                          )}

                          <div 
                            onClick={() => item.status === 'completed' && setInspectItem(item)}
                            className={`w-12 h-12 bg-[#0B0B0C]/[0.03] rounded-md flex items-center justify-center shrink-0 border border-[#0B0B0C]/10 overflow-hidden relative group/thumb ${item.status === 'completed' ? 'cursor-pointer' : ''}`}
                          >
                            {isDocxFile(item.file) ? (
                              <FileText size={22} className="text-blue-600" />
                            ) : item.status === 'completed' && item.resultUrl ? (
                              item.format === 'application/pdf' ? (
                                <FileText size={22} className="text-red-500" />
                              ) : (
                                <>
                                  <img 
                                    src={item.resultUrl} 
                                    alt="Converted preview" 
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity text-white">
                                    <Eye size={14} />
                                  </div>
                                </>
                              )
                            ) : item.previewUrl ? (
                              <img 
                                src={item.previewUrl} 
                                alt="Original preview" 
                                className="w-full h-full object-cover opacity-80"
                              />
                            ) : (
                              <ImageIcon size={18} strokeWidth={1.5} className="opacity-40 text-[#0B0B0C]" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 text-[#0B0B0C]">
                            <span className="font-bold truncate text-xs">{item.file.name}</span>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-[#0B0B0C]/50 font-medium">
                                {formatFileSize(item.file.size)}
                              </span>

                              {item.dimensions && (
                                <span className="text-[9px] font-mono text-[#0B0B0C]/60 bg-[#0B0B0C]/5 px-1 py-0.2 rounded-xs border border-[#0B0B0C]/10">
                                  {item.dimensions.width}×{item.dimensions.height}
                                </span>
                              )}

                              {item.status === 'completed' && item.resultBlob && (
                                <div className="flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-800">
                                  <span>→ {formatFileSize(item.resultBlob.size)}</span>
                                  {item.file.size > item.resultBlob.size && (
                                    <span className="bg-[#D6FF3F] text-[#0B0B0C] text-[8px] px-1 py-0.2 rounded-xs">
                                      -{Math.round(((item.file.size - item.resultBlob.size) / item.file.size) * 100)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2.5 px-2">
                          {item.status === 'converting' ? (
                            <div className="flex items-center gap-2 min-w-[90px]">
                              <Loader2 size={13} className="animate-spin text-[#0B0B0C] shrink-0" />
                              <div className="flex-1 h-1.5 bg-[#0B0B0C]/10 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.progress}%` }}
                                  className="h-full bg-[#0B0B0C] rounded-full"
                                />
                              </div>
                            </div>
                          ) : item.status === 'completed' ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="flex items-center gap-1 text-[#0B0B0C] font-bold text-[9px] uppercase tracking-wider bg-[#D6FF3F] px-1.5 py-0.5 rounded-xs">
                                <Check size={10} strokeWidth={2.5} /> 
                                {t.converted}
                              </span>
                              {stripMetadata && item.format !== 'application/pdf' && (
                                <span className="text-[8px] font-mono text-emerald-800 font-semibold">
                                  {t.gpsScrubbed}
                                </span>
                              )}
                            </div>
                          ) : item.status === 'error' ? (
                            <span className="flex items-center gap-1 text-[#FF4B1F] font-bold text-[9px] uppercase tracking-wider bg-red-50 px-1.5 py-0.5 rounded-xs border border-red-200">
                              <AlertCircle size={10} strokeWidth={2} />
                              {t.failed}
                            </span>
                          ) : (
                            <span className="text-[9px] font-bold opacity-40 uppercase tracking-widest text-[#0B0B0C] font-mono">
                              {t.ready}
                            </span>
                          )}
                        </div>

                        {/* Item Actions */}
                        <div className="flex items-center gap-1">
                          {isPdfMode && items.length > 1 && (
                            <div className="flex flex-col -space-y-1 mr-1">
                              <button
                                onClick={() => moveItem(index, 'up')}
                                disabled={index === 0}
                                className="p-1 hover:text-[#0B0B0C] text-[#0B0B0C]/30 disabled:opacity-10 transition-colors"
                                title={t.moveUp}
                              >
                                <ArrowUp size={11} />
                              </button>
                              <button
                                onClick={() => moveItem(index, 'down')}
                                disabled={index === items.length - 1}
                                className="p-1 hover:text-[#0B0B0C] text-[#0B0B0C]/30 disabled:opacity-10 transition-colors"
                                title={t.moveDown}
                              >
                                <ArrowDown size={11} />
                              </button>
                            </div>
                          )}

                          {item.status === 'completed' && (
                            <button
                              onClick={() => setInspectItem(item)}
                              className="p-1.5 hover:bg-[#0B0B0C]/5 rounded text-[#0B0B0C]/70 hover:text-[#0B0B0C] transition-colors"
                              title={t.previewAction}
                            >
                              <Eye size={13} />
                            </button>
                          )}

                          {item.status === 'completed' ? (
                            <button 
                              onClick={() => downloadItem(item)}
                              className="p-1.5 bg-[#0B0B0C] text-[#D6FF3F] hover:bg-black rounded transition-all active:scale-95 shadow-xs"
                              title="Download"
                            >
                              <Download size={13} />
                            </button>
                          ) : (
                            <button 
                              onClick={() => convertItem(item.id)}
                              disabled={item.status === 'converting'}
                              className="p-1.5 bg-[#0B0B0C]/5 hover:bg-[#0B0B0C] text-[#0B0B0C] hover:text-[#F4F1EA] rounded transition-all active:scale-95 disabled:opacity-30"
                              title="Convert"
                            >
                              <Plus size={13} className={item.status !== 'converting' ? "group-hover:rotate-90 transition-transform" : ""} />
                            </button>
                          )}
                          
                          <button 
                            onClick={() => removeItem(item.id)}
                            className="p-1.5 text-[#0B0B0C]/40 hover:bg-red-50 rounded hover:text-[#FF4B1F] transition-all"
                            title="Remove"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {/* Secondary Compact Dropzone Bar */}
                <div 
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragLeave={onDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3.5 border-2 border-dashed border-[#0B0B0C]/20 hover:border-[#0B0B0C] rounded-lg bg-white/60 hover:bg-white text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold text-[#0B0B0C]/60 hover:text-[#0B0B0C]"
                >
                  <Upload size={14} />
                  <span>Drag more files here or click to browse</span>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* RIGHT SIDE: Image to PDF & Options Panel (All Options "One Under One")    */}
          {/* ========================================================================= */}
          <aside data-testid="options-sidebar" className="flex flex-col gap-4 w-full sticky top-6">
            <div className="p-4 bg-white technical-border flex flex-col gap-4 shadow-sm">
              {/* Mode Segmented Control */}
              <div className="flex flex-col gap-1.5 pb-3 border-b border-[#0B0B0C]/10">
                <span className="mono-label !text-[9px]">TOOL WORKFLOW</span>
                <div className="grid grid-cols-2 gap-1 bg-[#0B0B0C]/5 p-1 rounded-md">
                  <button
                    onClick={() => handleModeSwitch('converter')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-bold text-xs transition-all ${
                      appMode === 'converter'
                        ? 'bg-[#0B0B0C] text-[#F4F1EA] shadow-xs'
                        : 'text-[#0B0B0C]/70 hover:text-[#0B0B0C]'
                    }`}
                  >
                    <ImageIcon size={12} />
                    <span>Images</span>
                  </button>
                  <button
                    onClick={() => handleModeSwitch('image-to-pdf')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded font-bold text-xs transition-all ${
                      appMode === 'image-to-pdf'
                        ? 'bg-[#0B0B0C] text-[#D6FF3F] shadow-xs'
                        : 'text-[#0B0B0C]/70 hover:text-[#0B0B0C]'
                    }`}
                  >
                    <FileText size={12} />
                    <span>To PDF</span>
                  </button>
                </div>
              </div>

              {/* OPTION 1: Output Format */}
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
                  className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer disabled:opacity-80"
                >
                  <option value="image/jpeg">JPEG (.jpg)</option>
                  <option value="image/png">PNG (.png)</option>
                  <option value="image/webp">WebP (.webp)</option>
                  <option value="application/pdf">PDF (.pdf)</option>
                </select>
              </div>

              {/* OPTION 2: When PDF mode -> Page Size / When Image mode -> Quality */}
              {isPdfMode ? (
                <div className="flex flex-col gap-1">
                  <span className="mono-label !text-[9px] flex items-center gap-1">
                    <FileText size={10} />
                    {t.pdfPageSize}
                  </span>
                  <select 
                    value={pdfPageFormat}
                    onChange={(e) => setPdfPageFormat(e.target.value as PdfPageFormat)}
                    className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer"
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
                    className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer disabled:opacity-40"
                  >
                    <option value={0.9}>{t.qualityHigh}</option>
                    <option value={0.8}>{t.qualityBalanced}</option>
                    <option value={0.65}>{t.qualityCompact}</option>
                  </select>
                </div>
              )}

              {/* OPTION 3: When PDF mode -> Orientation / When Image mode -> Max Dimension */}
              {isPdfMode ? (
                <div className="flex flex-col gap-1">
                  <span className="mono-label !text-[9px] flex items-center gap-1">
                    <Maximize2 size={10} />
                    {t.pdfOrientation}
                  </span>
                  <select 
                    value={pdfOrientation}
                    onChange={(e) => setPdfOrientation(e.target.value as PdfOrientation)}
                    className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer"
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
                    className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer"
                  >
                    <option value="original">{t.originalSize}</option>
                    <option value={3840}>{t.dimension4K}</option>
                    <option value={1920}>{t.dimension1080p}</option>
                    <option value={1200}>{t.dimension1200p}</option>
                    <option value={800}>{t.dimension800p}</option>
                  </select>
                </div>
              )}

              {/* OPTION 4: When PDF mode -> Margins / When Image mode -> GPS Stripper */}
              {isPdfMode ? (
                <div className="flex flex-col gap-1">
                  <span className="mono-label !text-[9px] flex items-center gap-1">
                    <ShieldCheck size={10} />
                    {t.pdfMargin}
                  </span>
                  <select 
                    value={pdfMargin}
                    onChange={(e) => setPdfMargin(e.target.value as PdfMargin)}
                    className="bg-[#0B0B0C]/[0.03] border border-[#0B0B0C]/15 rounded-md px-3 py-2 text-xs font-bold text-[#0B0B0C] focus:outline-none focus:ring-1 focus:ring-[#0B0B0C] cursor-pointer"
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
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-md border transition-all active:scale-95 ${
                      stripMetadata 
                        ? 'bg-[#0B0B0C] text-[#D6FF3F] border-[#0B0B0C] shadow-xs' 
                        : 'bg-[#0B0B0C]/[0.03] text-[#0B0B0C]/60 border-[#0B0B0C]/15 hover:border-[#0B0B0C]/30'
                    }`}
                    title={t.stripMetadataDesc}
                  >
                    <ShieldCheck size={13} className={stripMetadata ? "text-[#D6FF3F]" : ""} />
                    <span className="truncate">{t.stripMetadata}</span>
                  </button>
                </div>
              )}

              {/* PRIMARY ACTION BUTTON IN SIDEBAR */}
              <div className="pt-2 border-t border-[#0B0B0C]/10 flex flex-col gap-2">
                {isPdfMode ? (
                  <button 
                    onClick={downloadMergedPdf}
                    disabled={isMergingPdf || completedItems.length === 0}
                    className="w-full bg-[#0B0B0C] text-[#D6FF3F] hover:bg-black py-2.5 px-3 rounded-md font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isMergingPdf ? <Loader2 size={13} className="animate-spin" /> : <FileCheck size={14} />}
                    <span>{t.exportMergedPdfButton}</span>
                    {completedItems.length > 0 && <span>({completedItems.length})</span>}
                  </button>
                ) : (
                  <button 
                    onClick={convertAll}
                    disabled={isConvertingAll || items.every(i => i.status === 'completed' || i.status === 'converting')}
                    className="w-full bg-[#0B0B0C] text-[#F4F1EA] hover:bg-[#0B0B0C]/85 py-2.5 px-3 rounded-md font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isConvertingAll ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                    <span>{t.convertAll}</span>
                  </button>
                )}

                {/* Download All ZIP for multiple converted items */}
                {completedItems.length > 1 && (
                  <button 
                    onClick={downloadAll}
                    className="w-full bg-white border border-[#0B0B0C]/20 hover:border-[#0B0B0C] text-[#0B0B0C] py-2 px-3 rounded-md font-bold text-xs uppercase tracking-wider active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    <Download size={13} />
                    <span>{t.downloadAll} (.zip)</span>
                  </button>
                )}
              </div>

              {/* QUICK WORKFLOW PRESETS */}
              <div className="flex flex-col gap-2 pt-2 border-t border-[#0B0B0C]/10">
                <span className="mono-label !text-[9px] flex items-center gap-1">
                  <Sparkles size={10} />
                  {t.quickPresets}
                </span>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => applyPreset('heic-jpg')}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#0B0B0C]/[0.02] hover:bg-[#D6FF3F]/20 border border-[#0B0B0C]/10 rounded text-xs font-bold text-[#0B0B0C] text-left transition-colors"
                  >
                    <span>📸 {t.presetHeicToJpg}</span>
                    <span className="mono-label !text-[8px]">JPG</span>
                  </button>
                  <button
                    onClick={() => applyPreset('heic-webp')}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#0B0B0C]/[0.02] hover:bg-[#D6FF3F]/20 border border-[#0B0B0C]/10 rounded text-xs font-bold text-[#0B0B0C] text-left transition-colors"
                  >
                    <span>🌐 {t.presetHeicToWebp}</span>
                    <span className="mono-label !text-[8px]">-80%</span>
                  </button>
                  <button
                    onClick={() => applyPreset('photos-pdf')}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#0B0B0C]/[0.02] hover:bg-[#D6FF3F]/20 border border-[#0B0B0C]/10 rounded text-xs font-bold text-[#0B0B0C] text-left transition-colors"
                  >
                    <span>📄 {t.presetPhotosToPdf}</span>
                    <span className="mono-label !text-[8px]">PDF</span>
                  </button>
                  <button
                    onClick={() => applyPreset('word-pdf')}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#0B0B0C]/[0.02] hover:bg-[#D6FF3F]/20 border border-[#0B0B0C]/10 rounded text-xs font-bold text-[#0B0B0C] text-left transition-colors"
                  >
                    <span>📝 {t.presetWordToPdf}</span>
                    <span className="mono-label !text-[8px]">DOCX</span>
                  </button>
                </div>
              </div>

              {/* Local Security Footnote */}
              <div className="pt-2 border-t border-[#0B0B0C]/10 flex items-center gap-1.5 text-[9px] font-mono text-[#0B0B0C]/50">
                <ShieldCheck size={12} className="text-emerald-700 shrink-0" />
                <span>100% In-Browser Engine • Zero Servers</span>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <PrivacyPolicy onBack={() => setView('converter')} lang={lang} />
      )}

      {/* Footer */}
      <footer className="mt-auto pt-8 border-t border-[#0B0B0C]/10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-1 items-center md:items-start text-[#0B0B0C]">
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-100 opacity-60 transition-opacity"
              onClick={() => setView('privacy')}
            >
              <ShieldCheck size={14} className="text-emerald-700" />
              <span className="mono-label !opacity-100 font-bold">{t.privacyFooter}</span>
            </div>
            <span className="mono-label !opacity-40 !text-[9px] mt-0.5">{t.createdBy}</span>
          </div>
          <div className="flex gap-5 items-center">
            <button onClick={() => setView('privacy')} className="mono-label hover:text-[#0B0B0C] hover:opacity-100 transition-all text-[#0B0B0C]">{t.privacyPolicy}</button>
            <a
              href="https://github.com/kararha/snapH"
              target="_blank"
              rel="noopener noreferrer"
              className="mono-label hover:text-[#0B0B0C] hover:opacity-100 transition-all flex items-center gap-1.5 text-[#0B0B0C]"
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
            <div className="bg-white border border-[#0B0B0C]/15 rounded-xl flex items-center gap-4 p-4 shadow-2xl">
              <div className="w-10 h-10 bg-[#D6FF3F] rounded-full flex items-center justify-center shrink-0 border border-[#0B0B0C]">
                <MonitorDown size={18} className="text-[#0B0B0C]" />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <span className="font-bold text-[13px] text-[#0B0B0C] leading-tight mb-0.5">{t.pwaInstallTitle}</span>
                <span className="text-[11px] font-medium text-[#0B0B0C]/60 leading-snug">{t.pwaInstallDesc}</span>
              </div>
              <button
                id="pwa-install-btn"
                onClick={triggerInstall}
                className="shrink-0 bg-[#0B0B0C] text-[#D6FF3F] font-bold text-[10px] uppercase px-4 py-2.5 rounded-md tracking-wider hover:bg-black active:scale-[0.96] transition-all shadow-xs"
              >
                {t.pwaInstallButton}
              </button>
              <button
                id="pwa-dismiss-btn"
                onClick={dismissInstall}
                aria-label={t.pwaInstallDismiss}
                className="absolute -top-2 -right-2 w-6 h-6 bg-white border border-[#0B0B0C]/15 rounded-full flex items-center justify-center text-[#0B0B0C]/40 hover:text-[#0B0B0C] shadow-xs transition-colors"
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
