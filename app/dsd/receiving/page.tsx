'use client';

import { useState, useCallback, useRef } from 'react';
import Link from 'next/link';

// ============ TYPES ============
interface ExtractedLineItem {
  lineNumber: number;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  amount: number;
  productCode?: string;
}

interface ExtractedInvoice {
  vendorName: string | null;
  vendorAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  subtotal: number | null;
  totalTax: number | null;
  invoiceTotal: number | null;
  lineItems: ExtractedLineItem[];
  rawContent: string;
  confidence: number | null;
  blobUrl: string | null;
  filename: string;
}

interface VerifiedLineItem extends ExtractedLineItem {
  verified: boolean;
  hasDiscrepancy: boolean;
  discrepancyType: 'price_increase' | 'price_decrease' | 'unmatched' | null;
  discrepancy: {
    expected: number;
    actual: number;
    difference: number;
    percentChange: number;
  } | null;
  matchedProduct: {
    productId: number;
    upc: string;
    description: string;
    expectedCost: number;
  } | null;
  notes: string;
}

type ProcessingStep = 'upload' | 'processing' | 'verification' | 'review' | 'submitted';

// ============ COMPONENT ============
export default function DSDReceivingPage() {
  const [step, setStep] = useState<ProcessingStep>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const [invoice, setInvoice] = useState<ExtractedInvoice | null>(null);
  const [lineItems, setLineItems] = useState<VerifiedLineItem[]>([]);
  const [submissionNotes, setSubmissionNotes] = useState('');
  const [submissionResult, setSubmissionResult] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ FILE HANDLING ============
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleFile = async (file: File) => {
    // Validate file type
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a PDF or image file.');
      return;
    }

    setSelectedFile(file);
    setError(null);
    setStep('processing');
    setProcessingStatus('Uploading invoice...');
    setProcessingProgress(10);

    try {
      // Step 1: OCR Processing
      setProcessingStatus('Running OCR analysis...');
      setProcessingProgress(20);
      
      const formData = new FormData();
      formData.append('file', file);

      const ocrResponse = await fetch('/api/dsd/ocr', {
        method: 'POST',
        body: formData,
      });

      if (!ocrResponse.ok) {
        const errorData = await ocrResponse.json();
        throw new Error(errorData.error || 'OCR processing failed');
      }

      const ocrData = await ocrResponse.json();
      setProcessingProgress(60);
      setProcessingStatus('Extracting invoice data...');
      
      setInvoice(ocrData.invoice);

      // Step 2: Price verification
      setProcessingStatus('Checking prices against catalog...');
      setProcessingProgress(80);

      const priceCheckResponse = await fetch('/api/dsd/price-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: ocrData.invoice.vendorName,
          lineItems: ocrData.invoice.lineItems,
        }),
      });

      const priceCheckData = await priceCheckResponse.json();
      setProcessingProgress(100);

      // Merge price check results with line items
      const verifiedItems: VerifiedLineItem[] = ocrData.invoice.lineItems.map((item: ExtractedLineItem, idx: number) => {
        const priceCheck = priceCheckData.lineItems?.[idx];
        return {
          ...item,
          verified: false,
          hasDiscrepancy: priceCheck?.hasDiscrepancy || !priceCheck?.matched,
          discrepancyType: priceCheck?.discrepancyType || (priceCheck?.matched ? null : 'unmatched'),
          discrepancy: priceCheck?.discrepancy || null,
          matchedProduct: priceCheck?.matchedProduct || null,
          notes: '',
        };
      });

      setLineItems(verifiedItems);
      setStep('verification');

    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process invoice');
      setStep('upload');
    }
  };

  // ============ VERIFICATION ACTIONS ============
  const toggleVerified = (idx: number) => {
    setLineItems(prev => prev.map((item, i) => 
      i === idx ? { ...item, verified: !item.verified } : item
    ));
  };

  const verifyAll = () => {
    setLineItems(prev => prev.map(item => ({ ...item, verified: true })));
  };

  const updateLineNote = (idx: number, note: string) => {
    setLineItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, notes: note } : item
    ));
  };

  // ============ SUBMISSION ============
  const handleSubmit = async (status: 'verified' | 'flagged' | 'rejected') => {
    if (!invoice) return;

    setStep('processing');
    setProcessingStatus('Submitting invoice...');

    try {
      const response = await fetch('/api/dsd/receiving', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorName: invoice.vendorName,
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate,
          invoiceTotal: invoice.invoiceTotal,
          subtotal: invoice.subtotal,
          tax: invoice.totalTax,
          lineItems: lineItems.map(item => ({
            ...item,
            discrepancy: item.discrepancy,
            matchedProduct: item.matchedProduct,
          })),
          status,
          notes: submissionNotes,
          blobUrl: invoice.blobUrl,
          filename: invoice.filename,
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Submission failed');
      }

      setSubmissionResult({ ...result, status });
      setStep('submitted');

    } catch (err) {
      console.error('Submission error:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit invoice');
      setStep('verification');
    }
  };

  const resetForm = () => {
    setStep('upload');
    setSelectedFile(null);
    setInvoice(null);
    setLineItems([]);
    setSubmissionNotes('');
    setSubmissionResult(null);
    setError(null);
  };

  // ============ STATS ============
  const stats = {
    total: lineItems.length,
    verified: lineItems.filter(i => i.verified).length,
    priceIssues: lineItems.filter(i => i.discrepancyType === 'price_increase' || i.discrepancyType === 'price_decrease').length,
    unmatched: lineItems.filter(i => i.discrepancyType === 'unmatched').length,
  };

  const allVerified = stats.verified === stats.total && stats.total > 0;
  const hasIssues = stats.priceIssues > 0 || stats.unmatched > 0;

  // ============ RENDER ============
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/" className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">DSD Invoice Receiving</h1>
                <p className="text-sm text-gray-500">Upload, verify, and approve invoices</p>
              </div>
            </div>
            
            {step !== 'upload' && step !== 'submitted' && (
              <button
                onClick={resetForm}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 text-sm"
              >
                Start Over
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-red-500 text-xl">⚠️</span>
            <div className="flex-1">
              <p className="font-medium text-red-800">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              ✕
            </button>
          </div>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-6">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
                ${isDragging 
                  ? 'border-green-500 bg-green-50' 
                  : 'border-gray-300 hover:border-green-400 hover:bg-gray-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="text-6xl mb-4">📄</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Drop Invoice PDF Here
              </h2>
              <p className="text-gray-500 mb-4">
                or click to browse files
              </p>
              <p className="text-sm text-gray-400">
                Supports PDF, JPEG, PNG, TIFF
              </p>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-xl border p-6">
              <h3 className="font-semibold text-gray-900 mb-4">📋 Recent Uploads</h3>
              <p className="text-gray-500 text-sm">No recent uploads</p>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 rounded-xl border border-blue-200 p-6">
              <h3 className="font-semibold text-blue-900 mb-3">How It Works</h3>
              <ol className="space-y-2 text-blue-800 text-sm">
                <li className="flex items-start gap-2">
                  <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Upload a scanned invoice PDF from the back office scanner</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Azure AI extracts vendor, invoice number, dates, and line items</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>System compares prices against your DSD price list</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="bg-blue-200 text-blue-800 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Review discrepancies, verify items, and approve or flag for review</span>
                </li>
              </ol>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 'processing' && (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">{processingStatus}</h2>
            <div className="w-full max-w-md mx-auto bg-gray-200 rounded-full h-2 mt-4">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${processingProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-4">
              {selectedFile?.name}
            </p>
          </div>
        )}

        {/* Step 3: Verification */}
        {step === 'verification' && invoice && (
          <div className="space-y-6">
            {/* Invoice Header */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex flex-wrap gap-6">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm text-gray-500">Vendor</label>
                  <p className="font-semibold text-lg">{invoice.vendorName || 'Unknown'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Invoice #</label>
                  <p className="font-mono font-semibold">{invoice.invoiceNumber || '—'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Date</label>
                  <p className="font-semibold">{invoice.invoiceDate || '—'}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-500">Total</label>
                  <p className="font-semibold text-lg text-green-600">
                    ${invoice.invoiceTotal?.toFixed(2) || '0.00'}
                  </p>
                </div>
                {invoice.blobUrl && (
                  <div>
                    <a 
                      href={invoice.blobUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm underline"
                    >
                      View Original PDF →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Bar */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-white rounded-lg border px-4 py-2">
                <span className="text-gray-500 text-sm">Lines:</span>
                <span className="font-bold ml-2">{stats.total}</span>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2">
                <span className="text-green-600 text-sm">Verified:</span>
                <span className="font-bold text-green-700 ml-2">{stats.verified}/{stats.total}</span>
              </div>
              {stats.priceIssues > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  <span className="text-amber-600 text-sm">Price Issues:</span>
                  <span className="font-bold text-amber-700 ml-2">{stats.priceIssues}</span>
                </div>
              )}
              {stats.unmatched > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-2">
                  <span className="text-purple-600 text-sm">New Items:</span>
                  <span className="font-bold text-purple-700 ml-2">{stats.unmatched}</span>
                </div>
              )}
              <button
                onClick={verifyAll}
                className="ml-auto px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
              >
                ✓ Verify All
              </button>
            </div>

            {/* Line Items Table */}
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-12">✓</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Unit Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Expected</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lineItems.map((item, idx) => (
                      <tr 
                        key={idx}
                        className={`
                          ${item.verified ? 'bg-green-50' : ''}
                          ${item.discrepancyType === 'price_increase' ? 'bg-red-50' : ''}
                          ${item.discrepancyType === 'price_decrease' ? 'bg-amber-50' : ''}
                          ${item.discrepancyType === 'unmatched' ? 'bg-purple-50' : ''}
                          hover:bg-gray-50 transition-colors
                        `}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={item.verified}
                            onChange={() => toggleVerified(idx)}
                            className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.lineNumber}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900 text-sm">{item.description}</div>
                          {item.productCode && (
                            <div className="text-xs text-gray-500 font-mono">{item.productCode}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm">{item.quantity}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-mono text-sm ${
                            item.discrepancyType === 'price_increase' ? 'text-red-600 font-semibold' :
                            item.discrepancyType === 'price_decrease' ? 'text-amber-600 font-semibold' :
                            'text-gray-900'
                          }`}>
                            ${item.unitPrice.toFixed(2)}
                          </span>
                          {item.discrepancy && (
                            <div className={`text-xs ${
                              item.discrepancy.percentChange > 0 ? 'text-red-500' : 'text-green-500'
                            }`}>
                              {item.discrepancy.percentChange > 0 ? '↑' : '↓'} 
                              {Math.abs(item.discrepancy.percentChange).toFixed(1)}%
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-mono text-gray-500">
                          {item.matchedProduct?.expectedCost 
                            ? `$${item.matchedProduct.expectedCost.toFixed(2)}`
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-sm font-semibold">
                          ${item.amount.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.verified ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              ✓ Verified
                            </span>
                          ) : item.discrepancyType === 'price_increase' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              ↑ Price Up
                            </span>
                          ) : item.discrepancyType === 'price_decrease' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              ↓ Price Down
                            </span>
                          ) : item.discrepancyType === 'unmatched' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                              New Item
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                              Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 border-t-2">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 text-right font-semibold text-gray-700">
                        Invoice Total:
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-lg text-green-600">
                        ${invoice.invoiceTotal?.toFixed(2) || '0.00'}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Notes */}
            <div className="bg-white rounded-xl border p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={submissionNotes}
                onChange={(e) => setSubmissionNotes(e.target.value)}
                placeholder="Add any notes about discrepancies, issues, or special instructions..."
                className="w-full px-4 py-3 border rounded-lg text-sm resize-none"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-xl border p-6">
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => handleSubmit('rejected')}
                  className="px-6 py-3 border-2 border-red-300 text-red-700 rounded-xl font-semibold hover:bg-red-50 transition-all"
                >
                  ✕ Reject Invoice
                </button>
                
                <button
                  onClick={() => handleSubmit('flagged')}
                  className="px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 transition-all"
                >
                  ⚠️ Flag for Review ({stats.priceIssues + stats.unmatched} issues)
                </button>
                
                <button
                  onClick={() => handleSubmit('verified')}
                  disabled={!allVerified}
                  className={`ml-auto px-8 py-3 rounded-xl font-semibold transition-all ${
                    allVerified
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  ✓ Approve & Save ({stats.verified}/{stats.total} verified)
                </button>
              </div>
              
              {!allVerified && (
                <p className="text-sm text-gray-500 mt-3">
                  💡 Verify all {stats.total - stats.verified} remaining items to enable approval
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Submitted */}
        {step === 'submitted' && submissionResult && (
          <div className="bg-white rounded-2xl border p-12 text-center max-w-lg mx-auto">
            <div className="text-6xl mb-4">
              {submissionResult.status === 'verified' ? '✅' : 
               submissionResult.status === 'flagged' ? '⚠️' : '❌'}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {submissionResult.status === 'verified' ? 'Invoice Approved' :
               submissionResult.status === 'flagged' ? 'Invoice Flagged for Review' :
               'Invoice Rejected'}
            </h2>
            <p className="text-gray-500 mb-6">{submissionResult.message}</p>
            
            <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice ID</span>
                <span className="font-mono font-semibold">#{submissionResult.invoiceId}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Invoice #</span>
                <span className="font-mono">{submissionResult.summary?.invoiceNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Lines Processed</span>
                <span className="font-semibold">{submissionResult.summary?.totalLines}</span>
              </div>
              {submissionResult.summary?.discrepancies > 0 && (
                <div className="flex justify-between text-sm text-amber-600">
                  <span>Discrepancies</span>
                  <span className="font-semibold">{submissionResult.summary?.discrepancies}</span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={resetForm}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold"
              >
                Process Another Invoice
              </button>
              <Link 
                href="/invoices"
                className="flex-1 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 text-center"
              >
                View All Invoices
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
