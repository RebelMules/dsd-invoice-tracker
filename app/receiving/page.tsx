'use client';

import { useState, useEffect } from 'react';
import BarcodeScanner from '@/components/BarcodeScanner';
import InvoiceCapture from '@/components/InvoiceCapture';

interface InvoiceLineItem {
  id: string;
  upc?: string;
  itemCode?: string;
  description: string;
  expectedQty: number;
  receivedQty: number;
  unitCost: number;
  totalAmount: number;
  status: 'pending' | 'verified' | 'short' | 'over' | 'missing';
}

interface CapturedInvoice {
  blob: Blob;
  preview: string;
  vendor?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  total?: number;
  lineItems: InvoiceLineItem[];
  isProcessing: boolean;
}

interface ScannedItem {
  barcode: string;
  format: string;
  timestamp: Date;
  quantity: number;
  matchedLineId?: string;
  productName?: string;
}

type ReceivingMode = 'select' | 'invoice-first' | 'scan-first';
type ReceivingStep = 'mode' | 'capture' | 'checklist' | 'scanning' | 'review' | 'submitted';

export default function ReceivingPage() {
  const [mode, setMode] = useState<ReceivingMode>('select');
  const [step, setStep] = useState<ReceivingStep>('mode');
  const [invoice, setInvoice] = useState<CapturedInvoice | null>(null);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [notes, setNotes] = useState('');
  const [processingStatus, setProcessingStatus] = useState('');

  // Auto-start scanning when entering checklist mode
  useEffect(() => {
    if (step === 'checklist') {
      setIsScanning(true);
    }
  }, [step]);

  const handleInvoiceCapture = async (blob: Blob, preview: string) => {
    setInvoice({
      blob,
      preview,
      lineItems: [],
      isProcessing: true,
    });
    setStep('checklist');
    setProcessingStatus('Reading invoice...');

    try {
      const formData = new FormData();
      formData.append('invoice', blob, 'invoice.jpg');
      
      const response = await fetch('/api/process-invoice', {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      
      if (data.parsed?.lineItems) {
        setProcessingStatus('Extracting line items...');
        const items: InvoiceLineItem[] = data.parsed.lineItems.map((item: any, idx: number) => ({
          id: `line-${idx}`,
          upc: item.upc || '',
          itemCode: item.itemCode || item.sku || '',
          description: item.description || '',
          expectedQty: item.quantity || item.cases || item.units || 0,
          receivedQty: 0,
          unitCost: item.unitCost || item.unitPrice || 0,
          totalAmount: item.totalAmount || item.total || 0,
          status: 'pending' as const,
        }));
        
        setInvoice(prev => prev ? {
          ...prev,
          vendor: data.parsed.vendor,
          invoiceNumber: data.parsed.invoiceNumber,
          invoiceDate: data.parsed.invoiceDate,
          total: data.parsed.total,
          lineItems: items,
          isProcessing: false,
        } : null);
        setSelectedVendor(data.parsed.vendor || '');
      } else {
        setInvoice(prev => prev ? { ...prev, isProcessing: false } : null);
      }
    } catch (error) {
      console.error('Invoice processing error:', error);
      setInvoice(prev => prev ? { ...prev, isProcessing: false } : null);
    }
    setProcessingStatus('');
  };

  const handleScan = async (barcode: string, format: string) => {
    // Beep
    try {
      const audio = new Audio('/scan-beep.mp3');
      await audio.play();
    } catch {}

    // In invoice-first mode, match against line items
    if (mode === 'invoice-first' && invoice) {
      // Try to match by UPC or item code
      const matchedLine = invoice.lineItems.find(
        line => line.upc === barcode || line.itemCode === barcode
      );

      if (matchedLine) {
        // Update line item
        setInvoice(prev => {
          if (!prev) return null;
          return {
            ...prev,
            lineItems: prev.lineItems.map(line => {
              if (line.id === matchedLine.id) {
                const newQty = line.receivedQty + 1;
                let status: InvoiceLineItem['status'] = 'pending';
                if (newQty === line.expectedQty) status = 'verified';
                else if (newQty < line.expectedQty) status = 'short';
                else if (newQty > line.expectedQty) status = 'over';
                return { ...line, receivedQty: newQty, status };
              }
              return line;
            }),
          };
        });
        
        // Track scan
        setScannedItems(prev => {
          const existing = prev.find(i => i.barcode === barcode);
          if (existing) {
            return prev.map(i => i.barcode === barcode 
              ? { ...i, quantity: i.quantity + 1, timestamp: new Date() }
              : i
            );
          }
          return [{
            barcode,
            format,
            timestamp: new Date(),
            quantity: 1,
            matchedLineId: matchedLine.id,
            productName: matchedLine.description,
          }, ...prev];
        });
      } else {
        // Unknown item - not on invoice!
        setScannedItems(prev => {
          const existing = prev.find(i => i.barcode === barcode);
          if (existing) {
            return prev.map(i => i.barcode === barcode 
              ? { ...i, quantity: i.quantity + 1, timestamp: new Date() }
              : i
            );
          }
          return [{
            barcode,
            format,
            timestamp: new Date(),
            quantity: 1,
            productName: '⚠️ NOT ON INVOICE',
          }, ...prev];
        });
      }
    } else {
      // Scan-first mode - just collect items
      setScannedItems(prev => {
        const existing = prev.find(i => i.barcode === barcode);
        if (existing) {
          return prev.map(i => i.barcode === barcode 
            ? { ...i, quantity: i.quantity + 1, timestamp: new Date() }
            : i
          );
        }
        return [{
          barcode,
          format,
          timestamp: new Date(),
          quantity: 1,
        }, ...prev];
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/receiving/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: invoice?.vendor || selectedVendor,
          invoiceNumber: invoice?.invoiceNumber,
          invoiceDate: invoice?.invoiceDate,
          invoiceTotal: invoice?.total,
          lineItems: invoice?.lineItems || [],
          scannedItems: scannedItems.map(s => ({
            ...s,
            timestamp: s.timestamp.toISOString(),
          })),
          notes,
          mode,
        }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        console.error('Submit error:', data);
      }
    } catch (error) {
      console.error('Submit failed:', error);
    }
    setStep('submitted');
  };

  const resetReceiving = () => {
    setMode('select');
    setStep('mode');
    setInvoice(null);
    setScannedItems([]);
    setIsScanning(false);
    setSelectedVendor('');
    setNotes('');
  };

  // Calculate stats
  const stats = {
    verified: invoice?.lineItems.filter(i => i.status === 'verified').length || 0,
    short: invoice?.lineItems.filter(i => i.status === 'short').length || 0,
    over: invoice?.lineItems.filter(i => i.status === 'over').length || 0,
    pending: invoice?.lineItems.filter(i => i.status === 'pending').length || 0,
    notOnInvoice: scannedItems.filter(i => !i.matchedLineId).length,
    totalLines: invoice?.lineItems.length || 0,
  };

  // Mode selection
  if (step === 'mode') {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <header className="max-w-lg mx-auto pt-8 pb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900">📦 Receiving</h1>
          <p className="text-gray-500 mt-1">Choose receiving mode</p>
        </header>

        <main className="max-w-lg mx-auto space-y-4">
          {/* Invoice First - Recommended */}
          <button
            onClick={() => { setMode('invoice-first'); setStep('capture'); }}
            className="w-full bg-white rounded-2xl shadow-sm border-2 border-green-200 p-6 text-left hover:border-green-400 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">📄</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-gray-900">Invoice First</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Recommended</span>
                </div>
                <p className="text-gray-600 text-sm mt-1">
                  Snap invoice photo → scan items to verify → catch shorts/overs before driver leaves
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">✓ Verify quantities</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">✓ Catch shorts</span>
                </div>
              </div>
            </div>
          </button>

          {/* Scan First */}
          <button
            onClick={() => { setMode('scan-first'); setStep('scanning'); }}
            className="w-full bg-white rounded-2xl shadow-sm border p-6 text-left hover:border-gray-300 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="text-4xl">📱</div>
              <div className="flex-1">
                <span className="font-bold text-lg text-gray-900">Scan First</span>
                <p className="text-gray-600 text-sm mt-1">
                  Scan products as they come off truck → capture invoice after
                </p>
                <div className="flex gap-2 mt-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Quick receiving</span>
                </div>
              </div>
            </div>
          </button>
        </main>
      </div>
    );
  }

  // Capture invoice
  if (step === 'capture') {
    return (
      <InvoiceCapture
        onCapture={handleInvoiceCapture}
        onCancel={() => setStep('mode')}
      />
    );
  }

  // Submitted
  if (step === 'submitted') {
    const hasIssues = stats.short > 0 || stats.over > 0 || stats.notOnInvoice > 0;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">{hasIssues ? '⚠️' : '✅'}</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {hasIssues ? 'Submitted with Issues' : 'Submitted for Approval'}
          </h1>
          <p className="text-gray-500 mb-6">
            {hasIssues 
              ? 'Invoice flagged for review due to discrepancies'
              : 'Invoice and receiving data sent to manager'}
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Vendor</span>
              <span className="font-semibold">{invoice?.vendor || selectedVendor}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice #</span>
              <span className="font-mono">{invoice?.invoiceNumber || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Lines verified</span>
              <span className="font-semibold text-green-600">{stats.verified}/{stats.totalLines}</span>
            </div>
            {stats.short > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Shorts</span>
                <span className="font-semibold">{stats.short}</span>
              </div>
            )}
            {stats.notOnInvoice > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Not on invoice</span>
                <span className="font-semibold">{stats.notOnInvoice}</span>
              </div>
            )}
          </div>
          <button
            onClick={resetReceiving}
            className="w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold"
          >
            Start New Receiving
          </button>
        </div>
      </div>
    );
  }

  // Invoice-first checklist mode
  if (mode === 'invoice-first' && step === 'checklist') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm border-b sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-gray-900">
                  {invoice?.vendor || 'Receiving'}
                </h1>
                <p className="text-sm text-gray-500">
                  Invoice #{invoice?.invoiceNumber || '...'} • {invoice?.invoiceDate || 'Today'}
                </p>
              </div>
              <button
                onClick={() => setIsScanning(!isScanning)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm ${
                  isScanning
                    ? 'bg-red-500 text-white'
                    : 'bg-green-500 text-white'
                }`}
              >
                {isScanning ? '⏹ Stop' : '▶ Scan'}
              </button>
            </div>
          </div>
        </header>

        {/* Progress bar */}
        <div className="bg-white border-b px-4 py-2">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-600">Verification Progress</span>
              <span className="font-semibold">
                {stats.verified}/{stats.totalLines} verified
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${stats.totalLines ? (stats.verified / stats.totalLines) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Scanner */}
        {isScanning && (
          <div className="bg-black">
            <div className="max-w-4xl mx-auto">
              <BarcodeScanner
                onScan={handleScan}
                onError={(err) => console.error('Scanner error:', err)}
                active={isScanning}
              />
            </div>
          </div>
        )}

        {/* Processing status */}
        {invoice?.isProcessing && (
          <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-blue-700">{processingStatus || 'Processing invoice...'}</span>
            </div>
          </div>
        )}

        {/* Stats bar */}
        <div className="bg-white border-b px-4 py-2">
          <div className="max-w-4xl mx-auto flex gap-2 overflow-x-auto">
            <div className="flex-shrink-0 px-3 py-1.5 bg-gray-100 rounded-lg text-sm">
              <span className="text-gray-500">Pending:</span>
              <span className="font-bold ml-1">{stats.pending}</span>
            </div>
            <div className="flex-shrink-0 px-3 py-1.5 bg-green-100 rounded-lg text-sm">
              <span className="text-green-600">Verified:</span>
              <span className="font-bold ml-1 text-green-700">{stats.verified}</span>
            </div>
            {stats.short > 0 && (
              <div className="flex-shrink-0 px-3 py-1.5 bg-red-100 rounded-lg text-sm">
                <span className="text-red-600">Short:</span>
                <span className="font-bold ml-1 text-red-700">{stats.short}</span>
              </div>
            )}
            {stats.over > 0 && (
              <div className="flex-shrink-0 px-3 py-1.5 bg-amber-100 rounded-lg text-sm">
                <span className="text-amber-600">Over:</span>
                <span className="font-bold ml-1 text-amber-700">{stats.over}</span>
              </div>
            )}
            {stats.notOnInvoice > 0 && (
              <div className="flex-shrink-0 px-3 py-1.5 bg-purple-100 rounded-lg text-sm">
                <span className="text-purple-600">Not on invoice:</span>
                <span className="font-bold ml-1 text-purple-700">{stats.notOnInvoice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Line items checklist */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-4 py-4 space-y-2">
            {invoice?.lineItems.length === 0 && !invoice.isProcessing ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                <p>No line items extracted</p>
                <button 
                  onClick={() => setStep('capture')}
                  className="mt-4 text-blue-600 underline"
                >
                  Retake invoice photo
                </button>
              </div>
            ) : (
              invoice?.lineItems.map((line) => (
                <div
                  key={line.id}
                  className={`bg-white rounded-xl border-2 p-4 transition-all ${
                    line.status === 'verified' ? 'border-green-300 bg-green-50' :
                    line.status === 'short' ? 'border-red-300 bg-red-50' :
                    line.status === 'over' ? 'border-amber-300 bg-amber-50' :
                    'border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Status indicator */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                      line.status === 'verified' ? 'bg-green-500 text-white' :
                      line.status === 'short' ? 'bg-red-500 text-white' :
                      line.status === 'over' ? 'bg-amber-500 text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {line.status === 'verified' ? '✓' :
                       line.status === 'short' ? '!' :
                       line.status === 'over' ? '+' :
                       line.receivedQty}
                    </div>
                    
                    {/* Item details */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {line.description}
                      </div>
                      <div className="text-sm text-gray-500 flex items-center gap-2 mt-0.5">
                        {line.upc && <span className="font-mono">{line.upc}</span>}
                        {line.itemCode && <span>#{line.itemCode}</span>}
                      </div>
                      <div className="text-sm mt-1">
                        <span className={
                          line.status === 'verified' ? 'text-green-600 font-semibold' :
                          line.status === 'short' ? 'text-red-600 font-semibold' :
                          line.status === 'over' ? 'text-amber-600 font-semibold' :
                          'text-gray-600'
                        }>
                          {line.receivedQty} / {line.expectedQty}
                        </span>
                        <span className="text-gray-400 ml-2">
                          @ ${line.unitCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Manual adjust */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setInvoice(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              lineItems: prev.lineItems.map(l => {
                                if (l.id === line.id && l.receivedQty > 0) {
                                  const newQty = l.receivedQty - 1;
                                  let status: InvoiceLineItem['status'] = 'pending';
                                  if (newQty === l.expectedQty) status = 'verified';
                                  else if (newQty < l.expectedQty) status = newQty === 0 ? 'pending' : 'short';
                                  else status = 'over';
                                  return { ...l, receivedQty: newQty, status };
                                }
                                return l;
                              }),
                            };
                          });
                        }}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200"
                      >
                        −
                      </button>
                      <button
                        onClick={() => {
                          setInvoice(prev => {
                            if (!prev) return null;
                            return {
                              ...prev,
                              lineItems: prev.lineItems.map(l => {
                                if (l.id === line.id) {
                                  const newQty = l.receivedQty + 1;
                                  let status: InvoiceLineItem['status'] = 'pending';
                                  if (newQty === l.expectedQty) status = 'verified';
                                  else if (newQty < l.expectedQty) status = 'short';
                                  else status = 'over';
                                  return { ...l, receivedQty: newQty, status };
                                }
                                return l;
                              }),
                            };
                          });
                        }}
                        className="w-8 h-8 rounded-lg bg-gray-100 text-gray-600 font-bold hover:bg-gray-200"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Items not on invoice */}
            {stats.notOnInvoice > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-purple-700 mb-2 flex items-center gap-2">
                  <span>⚠️ Scanned but NOT on invoice</span>
                </h3>
                {scannedItems.filter(i => !i.matchedLineId).map((item, idx) => (
                  <div key={idx} className="bg-purple-50 border-2 border-purple-200 rounded-xl p-3 mb-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-mono font-semibold text-purple-900">{item.barcode}</div>
                        <div className="text-sm text-purple-600">Qty: {item.quantity}</div>
                      </div>
                      <div className="text-2xl">❓</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Footer actions */}
        <footer className="bg-white border-t p-4 sticky bottom-0">
          <div className="max-w-4xl mx-auto flex gap-3">
            <button
              onClick={() => setStep('mode')}
              className="px-4 py-3 text-gray-600 hover:text-gray-800"
            >
              ← Back
            </button>
            <button
              onClick={handleSubmit}
              disabled={invoice?.isProcessing}
              className={`flex-1 py-3 rounded-xl font-semibold text-lg ${
                stats.short > 0 || stats.notOnInvoice > 0
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {stats.short > 0 || stats.notOnInvoice > 0
                ? `Submit with ${stats.short + stats.notOnInvoice} issues`
                : stats.verified === stats.totalLines && stats.totalLines > 0
                ? '✓ All Verified — Submit'
                : 'Submit Receiving'}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Scan-first mode (original flow)
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receiving</h1>
            <p className="text-sm text-gray-500">Scan items to record delivery</p>
          </div>
          <button
            onClick={() => setIsScanning(!isScanning)}
            className={`px-5 py-2.5 rounded-xl font-semibold transition-all ${
              isScanning
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isScanning ? 'Stop' : 'Scan'}
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {/* Vendor selector */}
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendor
          </label>
          <select
            value={selectedVendor}
            onChange={(e) => setSelectedVendor(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-base bg-white"
          >
            <option value="">-- Select vendor --</option>
            <option value="Mitchell Distributing">Mitchell Distributing</option>
            <option value="Prairie Farms Dairy">Prairie Farms Dairy</option>
            <option value="Buttermilk Ridge Produce">Buttermilk Ridge Produce</option>
            <option value="Lipari Foods">Lipari Foods</option>
            <option value="Quirch Foods">Quirch Foods</option>
            <option value="Cooper's Country Meat">Cooper's Country Meat</option>
            <option value="Caravan Supply">Caravan Supply</option>
            <option value="MS Fruit & Vegetable">MS Fruit & Vegetable</option>
          </select>
        </div>

        {/* Scanner */}
        {isScanning && (
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <BarcodeScanner
              onScan={handleScan}
              onError={(err) => console.error('Scanner error:', err)}
              active={isScanning}
            />
          </div>
        )}

        {/* Scanned items list */}
        <div className="bg-white rounded-xl shadow-sm border">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Scanned Items ({scannedItems.reduce((sum, i) => sum + i.quantity, 0)})
            </h2>
            {scannedItems.length > 0 && (
              <button
                onClick={() => setScannedItems([])}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>

          {scannedItems.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📦</div>
              <p>No items scanned yet</p>
              <p className="text-sm">Tap Scan to start</p>
            </div>
          ) : (
            <ul className="divide-y max-h-72 overflow-y-auto">
              {scannedItems.map((item, idx) => (
                <li key={idx} className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg font-bold">
                    {item.quantity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-base font-semibold text-gray-900">
                      {item.barcode}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.productName || 'Unknown'} • {item.format}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-4">
          <button
            onClick={() => setStep('capture')}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2"
          >
            📷 Capture Invoice
          </button>
          
          {scannedItems.length > 0 && (
            <button
              onClick={handleSubmit}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-lg"
            >
              Submit Receiving →
            </button>
          )}
          
          <button
            onClick={() => setStep('mode')}
            className="w-full py-3 text-gray-600 hover:text-gray-800"
          >
            ← Change Mode
          </button>
        </div>
      </main>
    </div>
  );
}
