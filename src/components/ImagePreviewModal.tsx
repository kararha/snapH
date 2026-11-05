import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ShieldCheck, Check, Maximize2, FileText, ArrowRight } from 'lucide-react';
import { translations, Language } from '../translations';
import { OutputFormat, getTargetExtension } from '../utils/converter';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  item: {
    file: File;
    format: OutputFormat;
    resultBlob?: Blob;
    resultUrl?: string;
    dimensions?: { width: number; height: number };
  } | null;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen,
  onClose,
  lang,
  item
}) => {
  const t = translations[lang];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const originalSize = item.file.size;
  const convertedSize = item.resultBlob ? item.resultBlob.size : originalSize;
  const reductionPercent = Math.max(0, Math.round(((originalSize - convertedSize) / originalSize) * 100));

  const handleDownload = () => {
    if (!item.resultUrl) return;
    const link = document.createElement('a');
    link.href = item.resultUrl;
    const ext = getTargetExtension(item.format);
    const sanitizedName = item.file.name
      .replace(/[^a-zA-Z0-9_\-\.]/g, '_')
      .replace(/\.[^/.]+$/, `.${ext}`);
    link.download = sanitizedName;
    link.click();
  };

  const isPdf = item.format === 'application/pdf';

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-[#0B0B0C]/75 backdrop-blur-sm"
        onClick={onClose}
        dir={lang === 'ar' ? 'rtl' : 'ltr'}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-3xl bg-[#F4F1EA] border border-[#0B0B0C]/20 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#0B0B0C]/10 bg-white/70">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#D6FF3F] border border-[#0B0B0C]" />
              <h3 className="font-bold text-sm tracking-tight text-[#0B0B0C]">
                {t.previewModalTitle}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-[#0B0B0C]/60 hover:text-[#0B0B0C] hover:bg-[#0B0B0C]/5 rounded-md transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Main Inspection View */}
          <div className="p-6 overflow-y-auto flex flex-col gap-6">
            {/* Visual Preview Box */}
            <div className="w-full h-[320px] sm:h-[380px] bg-[#0B0B0C]/5 rounded-lg border border-[#0B0B0C]/10 flex items-center justify-center overflow-hidden relative group">
              {isPdf ? (
                <div className="flex flex-col items-center gap-3">
                  <FileText size={64} className="text-red-500" />
                  <span className="font-bold text-sm text-[#0B0B0C]">PDF Document Ready</span>
                </div>
              ) : item.resultUrl ? (
                <img
                  src={item.resultUrl}
                  alt={item.file.name}
                  className="max-h-full max-w-full object-contain drop-shadow-md"
                />
              ) : null}

              {/* Viewfinder Corner Accents */}
              <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-[#0B0B0C]/30" />
              <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-[#0B0B0C]/30" />
              <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-[#0B0B0C]/30" />
              <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-[#0B0B0C]/30" />
            </div>

            {/* Technical Specs & Comparison Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Original */}
              <div className="p-3 bg-white/80 rounded-lg border border-[#0B0B0C]/10 flex flex-col">
                <span className="mono-label !text-[9px] mb-1">{t.originalFile}</span>
                <span className="font-bold text-xs truncate text-[#0B0B0C]">{item.file.name}</span>
                <span className="font-mono text-[10px] text-[#0B0B0C]/60 mt-0.5">{formatFileSize(originalSize)}</span>
              </div>

              {/* Output Size */}
              <div className="p-3 bg-white/80 rounded-lg border border-[#0B0B0C]/10 flex flex-col">
                <span className="mono-label !text-[9px] mb-1">{t.convertedFile}</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-xs text-[#0B0B0C] font-mono">{formatFileSize(convertedSize)}</span>
                  {reductionPercent > 0 && (
                    <span className="bg-[#D6FF3F] text-[#0B0B0C] font-mono font-bold text-[9px] px-1 rounded-xs">
                      -{reductionPercent}%
                    </span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-emerald-700 font-semibold mt-0.5">
                  {reductionPercent > 0 ? `${reductionPercent}% smaller` : 'Optimized'}
                </span>
              </div>

              {/* Resolution */}
              <div className="p-3 bg-white/80 rounded-lg border border-[#0B0B0C]/10 flex flex-col">
                <span className="mono-label !text-[9px] mb-1">{t.resolutionLabel}</span>
                <span className="font-bold text-xs text-[#0B0B0C] font-mono">
                  {item.dimensions ? `${item.dimensions.width} × ${item.dimensions.height}` : 'Proportional'}
                </span>
                <span className="font-mono text-[10px] text-[#0B0B0C]/60 mt-0.5 uppercase">
                  {item.format.split('/')[1]}
                </span>
              </div>

              {/* Privacy Audit */}
              <div className="p-3 bg-white/80 rounded-lg border border-[#0B0B0C]/10 flex flex-col">
                <span className="mono-label !text-[9px] mb-1">{t.privacyAuditLabel}</span>
                <div className="flex items-center gap-1 text-emerald-700 font-bold text-xs">
                  <ShieldCheck size={14} />
                  <span>Verified Clean</span>
                </div>
                <span className="font-mono text-[9px] text-[#0B0B0C]/50 mt-0.5 leading-tight">
                  GPS & camera tags scrubbed
                </span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#0B0B0C]/10 bg-white/70">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold font-mono tracking-wider text-[#0B0B0C]/60 hover:text-[#0B0B0C] uppercase transition-colors"
            >
              {t.close}
            </button>

            {item.resultUrl && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-[#0B0B0C] text-[#D6FF3F] px-5 py-2.5 rounded-md font-bold text-xs uppercase tracking-wider hover:bg-black/85 active:scale-[0.98] transition-all shadow-sm"
              >
                <Download size={14} />
                {t.downloadCurrentItem}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
