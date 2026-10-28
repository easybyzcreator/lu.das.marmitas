import React from 'react';
import { motion } from 'motion/react';
import { Printer, ExternalLink, Copy, X } from 'lucide-react';
import { toast } from 'sonner';
import { Order } from '../types';

export interface PrintReceiptData {
  title: string;
  htmlContent: string;
  textVersion: string;
  order?: Order;
}

interface PrintReceiptModalProps {
  activePrintReceipt: PrintReceiptData | null;
  onClose: () => void;
}

export const PrintReceiptModal: React.FC<PrintReceiptModalProps> = ({
  activePrintReceipt,
  onClose,
}) => {
  if (!activePrintReceipt) return null;

  const handleDirectPrint = () => {
    try {
      let container = document.getElementById('printable-receipt-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'printable-receipt-container';
        document.body.appendChild(container);
      }
      container.innerHTML = activePrintReceipt.htmlContent;
      window.print();
    } catch (err) {
      console.error(err);
      toast.error('Erro ao acionar impressora.');
    }
  };

  const handleOpenPdfTab = () => {
    try {
      const fullDoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${activePrintReceipt.title}</title><style>@page{size:80mm auto;margin:2mm;}body{font-family:'Courier New',Courier,monospace,sans-serif;width:74mm;margin:0 auto;padding:2mm 1mm;font-size:12px;color:#000;line-height:1.35;}@media print{body{width:74mm;padding:0;}}</style></head><body>${activePrintReceipt.htmlContent}<script>window.onload=function(){setTimeout(function(){window.print();},300);};</script></body></html>`;
      const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
    } catch (err) {
      console.error(err);
      window.print();
    }
  };

  const handleCopyText = () => {
    if (activePrintReceipt.textVersion) {
      navigator.clipboard.writeText(activePrintReceipt.textVersion);
      toast.success('Texto da comanda copiado!');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-100"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-800 text-white flex items-center justify-center shadow-sm">
              <Printer size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">Comanda Térmica</h3>
              <p className="text-[11px] text-gray-500 font-medium truncate max-w-[220px]">
                {activePrintReceipt.title}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Thermal Receipt Body Preview */}
        <div className="p-4 overflow-y-auto flex-grow bg-neutral-100 flex justify-center">
          <div className="bg-white w-full max-w-[340px] p-4 shadow-md rounded-xl border border-gray-300 font-mono text-xs text-gray-900 leading-snug select-text">
            <div dangerouslySetInnerHTML={{ __html: activePrintReceipt.htmlContent }} />
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-4 border-t border-gray-100 bg-white space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDirectPrint}
              className="flex items-center justify-center gap-2 py-3 px-3 bg-amber-800 text-white rounded-xl font-bold text-xs hover:bg-amber-900 shadow-md transition-all cursor-pointer"
            >
              <Printer size={16} />
              <span>Imprimir Agora</span>
            </button>

            <button
              onClick={handleOpenPdfTab}
              className="flex items-center justify-center gap-1.5 py-3 px-3 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 shadow-md transition-all cursor-pointer"
            >
              <ExternalLink size={16} />
              <span>Nova Aba / PDF</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              <Copy size={16} />
              <span>Copiar Texto</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-3 px-3 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
