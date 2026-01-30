'use client';

import { useState } from 'react';

interface LineItem {
  upc: string;
  description: string;
  cases: number;
  units: number;
  totalAmount: number;
}

interface ParsedInvoice {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  total: number;
  lineItems: LineItem[];
}

interface InvoiceProcessorProps {
  imageBlob: Blob;
  imagePreview: string;
  onProcessed: (data: ParsedInvoice) => void;
  onError: (error: string) => void;
}

export default function InvoiceProcessor({ imageBlob, imagePreview, onProcessed, onError }: InvoiceProcessorProps) {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'ocr' | 'parsing' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ParsedInvoice | null>(null);

  const processInvoice = async () => {
    setStatus('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('invoice', imageBlob, 'invoice.jpg');

      setStatus('ocr');
      setProgress(30);

      const response = await fetch('/api/process-invoice', {
        method: 'POST',
        body: formData,
      });

      setProgress(70);
      setStatus('parsing');

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      setProgress(100);
      setStatus('done');

      if (data.parsed) {
        setResult(data.parsed);
        onProcessed(data.parsed);
      } else {
        throw new Error('Could not parse invoice data');
      }
    } catch (err) {
      setStatus('error');
      onError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const statusMessages = {
    idle: 'Ready to process',
    uploading: 'Uploading image...',
    ocr: 'Reading invoice (OCR)...',
    parsing: 'Extracting line items...',
    done: 'Complete!',
    error: 'Processing failed',
  };

  return (
    <div className="space-y-4">
      {/* Invoice preview */}
      <div className="flex gap-4 items-start">
        <img
          src={imagePreview}
          alt="Invoice"
          className="w-24 h-32 object-cover rounded-lg border"
        />
        <div className="flex-1">
          <div className="text-sm text-gray-500 mb-2">{statusMessages[status]}</div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${
                status === 'error' ? 'bg-red-500' : 
                status === 'done' ? 'bg-green-500' : 'bg-blue-500'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>

          {status === 'idle' && (
            <button
              onClick={processInvoice}
              className="mt-3 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              Process Invoice
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-green-600 text-lg">✓</span>
            <span className="font-semibold text-green-800">Invoice Parsed Successfully</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div>
              <span className="text-gray-500">Vendor:</span>
              <span className="ml-2 font-medium">{result.vendor}</span>
            </div>
            <div>
              <span className="text-gray-500">Invoice #:</span>
              <span className="ml-2 font-mono">{result.invoiceNumber}</span>
            </div>
            <div>
              <span className="text-gray-500">Date:</span>
              <span className="ml-2">{result.invoiceDate}</span>
            </div>
            <div>
              <span className="text-gray-500">Total:</span>
              <span className="ml-2 font-semibold">${result.total?.toFixed(2)}</span>
            </div>
          </div>

          {/* Line items */}
          <div className="border-t border-green-200 pt-3">
            <div className="text-sm font-medium text-green-800 mb-2">
              {result.lineItems?.length || 0} Line Items
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {result.lineItems?.map((item, idx) => (
                <div key={idx} className="flex items-center text-xs bg-white rounded px-2 py-1">
                  <span className="font-mono text-gray-500 w-28 truncate">{item.upc}</span>
                  <span className="flex-1 truncate">{item.description}</span>
                  <span className="text-gray-500 w-16 text-right">{item.cases}cs / {item.units}u</span>
                  <span className="font-medium w-16 text-right">${item.totalAmount?.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
