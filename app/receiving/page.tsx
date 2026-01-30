'use client';

import { useState } from 'react';
import BarcodeScanner from '@/components/BarcodeScanner';
import InvoiceCapture from '@/components/InvoiceCapture';

interface ScannedItem {
  barcode: string;
  format: string;
  timestamp: Date;
  status: 'pending' | 'matched' | 'discrepancy' | 'unknown';
  productName?: string;
  expectedCost?: number;
  invoiceCost?: number;
  quantity: number;
}

interface CapturedInvoice {
  blob: Blob;
  preview: string;
  extractedData?: {
    vendor?: string;
    invoiceNumber?: string;
    date?: string;
    total?: number;
    lineItems?: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
  };
  isProcessing: boolean;
}

type ReceivingStep = 'scanning' | 'capture' | 'review' | 'submitted';

export default function ReceivingPage() {
  const [step, setStep] = useState<ReceivingStep>('scanning');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<string>('');
  const [capturedInvoice, setCapturedInvoice] = useState<CapturedInvoice | null>(null);
  const [notes, setNotes] = useState('');
  const [showCapture, setShowCapture] = useState(false);

  const handleScan = async (barcode: string, format: string) => {
    // Play success sound
    try {
      const audio = new Audio('/scan-beep.mp3');
      await audio.play();
    } catch {}

    // Check if already scanned - increment quantity
    const existingIndex = scannedItems.findIndex(i => i.barcode === barcode);
    if (existingIndex >= 0) {
      setScannedItems(prev => prev.map((item, idx) => 
        idx === existingIndex 
          ? { ...item, quantity: item.quantity + 1, timestamp: new Date() }
          : item
      ));
      return;
    }

    // Add new item
    const newItem: ScannedItem = {
      barcode,
      format,
      timestamp: new Date(),
      status: 'pending',
      quantity: 1,
    };

    // TODO: Look up product in database
    // TODO: Compare against master cost file

    setScannedItems(prev => [newItem, ...prev]);
  };

  const handleInvoiceCapture = async (blob: Blob, preview: string) => {
    setShowCapture(false);
    setCapturedInvoice({
      blob,
      preview,
      isProcessing: true,
    });
    setStep('review');

    // TODO: Send to Azure Form Recognizer
    // For now, simulate processing
    setTimeout(() => {
      setCapturedInvoice(prev => prev ? {
        ...prev,
        isProcessing: false,
        extractedData: {
          vendor: selectedVendor || 'Unknown Vendor',
          invoiceNumber: 'INV-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
          date: new Date().toLocaleDateString(),
          total: 0,
          lineItems: [],
        },
      } : null);
    }, 2000);
  };

  const handleSubmit = async () => {
    // TODO: Upload to Vercel Blob
    // TODO: Save to database with status='pending_approval'
    // TODO: Notify manager
    
    setStep('submitted');
  };

  const resetReceiving = () => {
    setStep('scanning');
    setIsScanning(false);
    setScannedItems([]);
    setSelectedVendor('');
    setCapturedInvoice(null);
    setNotes('');
  };

  const getStatusColor = (status: ScannedItem['status']) => {
    switch (status) {
      case 'matched': return 'bg-green-100 text-green-800 border-green-200';
      case 'discrepancy': return 'bg-red-100 text-red-800 border-red-200';
      case 'unknown': return 'bg-amber-100 text-amber-800 border-amber-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Invoice capture overlay
  if (showCapture) {
    return (
      <InvoiceCapture
        onCapture={handleInvoiceCapture}
        onCancel={() => setShowCapture(false)}
      />
    );
  }

  // Submitted confirmation
  if (step === 'submitted') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Submitted for Approval</h1>
          <p className="text-gray-500 mb-6">
            Invoice and receiving data sent to manager for review.
          </p>
          <div className="bg-gray-50 rounded-xl p-4 mb-6 text-left">
            <div className="text-sm text-gray-500">Summary</div>
            <div className="font-semibold">{selectedVendor || 'Unknown Vendor'}</div>
            <div className="text-sm text-gray-600">{scannedItems.length} items scanned</div>
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

  // Review step
  if (step === 'review') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Review & Submit</h1>
              <p className="text-sm text-gray-500">Verify details before sending to approval</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Invoice preview */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">📄 Captured Invoice</h2>
            </div>
            {capturedInvoice && (
              <div className="p-4">
                <div className="flex gap-4">
                  <img
                    src={capturedInvoice.preview}
                    alt="Invoice"
                    className="w-32 h-40 object-cover rounded-lg border"
                  />
                  <div className="flex-1">
                    {capturedInvoice.isProcessing ? (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        Processing with OCR...
                      </div>
                    ) : capturedInvoice.extractedData ? (
                      <div className="space-y-2">
                        <div>
                          <span className="text-sm text-gray-500">Vendor:</span>
                          <span className="ml-2 font-semibold">{capturedInvoice.extractedData.vendor}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Invoice #:</span>
                          <span className="ml-2 font-mono">{capturedInvoice.extractedData.invoiceNumber}</span>
                        </div>
                        <div>
                          <span className="text-sm text-gray-500">Date:</span>
                          <span className="ml-2">{capturedInvoice.extractedData.date}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
                <button
                  onClick={() => setShowCapture(true)}
                  className="mt-4 text-sm text-blue-600 hover:text-blue-700"
                >
                  Retake photo
                </button>
              </div>
            )}
          </div>

          {/* Scanned items summary */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">📦 Scanned Items ({scannedItems.length})</h2>
              <button
                onClick={() => setStep('scanning')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Add more
              </button>
            </div>
            {scannedItems.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No items scanned
              </div>
            ) : (
              <ul className="divide-y max-h-64 overflow-y-auto">
                {scannedItems.map((item, idx) => (
                  <li key={idx} className="p-3 flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${getStatusColor(item.status)}`}>
                      {item.quantity}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm">{item.barcode}</div>
                      <div className="text-xs text-gray-500">{item.productName || 'Unknown product'}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Notes */}
          <div className="bg-white rounded-xl shadow-sm border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any issues or notes about this delivery..."
              className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
              rows={3}
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={capturedInvoice?.isProcessing}
            className="w-full py-4 bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white rounded-xl font-semibold text-lg transition-all"
          >
            Submit for Approval
          </button>

          <button
            onClick={() => setStep('scanning')}
            className="w-full py-3 text-gray-600 hover:text-gray-800"
          >
            ← Back to scanning
          </button>
        </main>
      </div>
    );
  }

  // Scanning step (default)
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Receiving</h1>
            <p className="text-sm text-gray-500">Scan items to verify delivery</p>
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
              <p className="text-sm">Tap Scan to start verifying delivery</p>
            </div>
          ) : (
            <ul className="divide-y max-h-72 overflow-y-auto">
              {scannedItems.map((item, idx) => (
                <li key={idx} className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold border-2 ${getStatusColor(item.status)}`}>
                    {item.quantity}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-base font-semibold text-gray-900">
                      {item.barcode}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.productName || 'Looking up...'} • {item.format}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3 pt-4">
          <button
            onClick={() => setShowCapture(true)}
            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-semibold text-lg flex items-center justify-center gap-2"
          >
            📷 Capture Invoice
          </button>
          
          {scannedItems.length > 0 && capturedInvoice && (
            <button
              onClick={() => setStep('review')}
              className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold text-lg"
            >
              Review & Submit →
            </button>
          )}
        </div>

        {/* Quick stats */}
        {scannedItems.length > 0 && (
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="bg-green-50 rounded-xl p-3 text-center border border-green-200">
              <div className="text-xl font-bold text-green-700">
                {scannedItems.filter(i => i.status === 'matched').length}
              </div>
              <div className="text-xs text-green-600">Matched</div>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center border border-red-200">
              <div className="text-xl font-bold text-red-700">
                {scannedItems.filter(i => i.status === 'discrepancy').length}
              </div>
              <div className="text-xs text-red-600">Issues</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-200">
              <div className="text-xl font-bold text-amber-700">
                {scannedItems.filter(i => i.status === 'unknown').length}
              </div>
              <div className="text-xs text-amber-600">Unknown</div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
