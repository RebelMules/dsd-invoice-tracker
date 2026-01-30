'use client';

import { useState } from 'react';
import Link from 'next/link';

interface PendingApproval {
  id: string;
  vendor: string;
  invoiceNumber: string;
  submittedBy: string;
  submittedAt: Date;
  itemCount: number;
  invoiceTotal: number;
  invoicePreview: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
}

// Mock data - would come from database
const mockApprovals: PendingApproval[] = [
  {
    id: '1',
    vendor: 'Mitchell Distributing',
    invoiceNumber: 'MD-2026-0129-A',
    submittedBy: 'Store #42',
    submittedAt: new Date(Date.now() - 1000 * 60 * 15), // 15 min ago
    itemCount: 24,
    invoiceTotal: 1847.50,
    invoicePreview: '/placeholder-invoice.jpg',
    status: 'pending',
  },
  {
    id: '2',
    vendor: 'Prairie Farms Dairy',
    invoiceNumber: 'PF-78234',
    submittedBy: 'Store #42',
    submittedAt: new Date(Date.now() - 1000 * 60 * 45), // 45 min ago
    itemCount: 18,
    invoiceTotal: 634.20,
    invoicePreview: '/placeholder-invoice.jpg',
    notes: 'Short 2 cases of 2% milk',
    status: 'pending',
  },
  {
    id: '3',
    vendor: 'Lipari Foods',
    invoiceNumber: 'LF-112847',
    submittedBy: 'Store #41',
    submittedAt: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    itemCount: 42,
    invoiceTotal: 2156.80,
    invoicePreview: '/placeholder-invoice.jpg',
    status: 'pending',
  },
];

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState<PendingApproval[]>(mockApprovals);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  const handleApprove = (id: string) => {
    setApprovals(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'approved' as const } : a
    ));
    setSelectedApproval(null);
    // TODO: Send to accounting, update database
  };

  const handleReject = (id: string) => {
    setApprovals(prev => prev.map(a => 
      a.id === id ? { ...a, status: 'rejected' as const } : a
    ));
    setSelectedApproval(null);
    // TODO: Notify submitter, update database
  };

  const filteredApprovals = approvals.filter(a => 
    filter === 'all' ? true : a.status === filter
  );

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  const formatTimeAgo = (date: Date) => {
    const minutes = Math.floor((Date.now() - date.getTime()) / 1000 / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Detail view modal
  if (selectedApproval) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => setSelectedApproval(null)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Back
            </button>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-gray-900">{selectedApproval.vendor}</h1>
              <p className="text-sm text-gray-500">{selectedApproval.invoiceNumber}</p>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
          {/* Invoice image */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold">Invoice Image</h2>
            </div>
            <div className="p-4">
              <div className="bg-gray-100 rounded-lg h-96 flex items-center justify-center text-gray-400">
                Invoice image would display here
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Submitted by</span>
              <span className="font-medium">{selectedApproval.submittedBy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{selectedApproval.submittedAt.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Items scanned</span>
              <span className="font-medium">{selectedApproval.itemCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Invoice total</span>
              <span className="font-medium">${selectedApproval.invoiceTotal.toFixed(2)}</span>
            </div>
            {selectedApproval.notes && (
              <div className="pt-2 border-t">
                <span className="text-gray-500 text-sm">Notes:</span>
                <p className="mt-1 text-amber-700 bg-amber-50 p-2 rounded">{selectedApproval.notes}</p>
              </div>
            )}
          </div>

          {/* OCR extracted line items would go here */}
          <div className="bg-white rounded-xl shadow-sm border">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold">Extracted Line Items</h2>
            </div>
            <div className="p-4 text-center text-gray-500">
              OCR-extracted line items would display here
            </div>
          </div>

          {/* Action buttons */}
          {selectedApproval.status === 'pending' && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleReject(selectedApproval.id)}
                className="flex-1 py-4 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl font-semibold"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedApproval.id)}
                className="flex-1 py-4 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold"
              >
                Approve & Send to Accounting
              </button>
            </div>
          )}

          {selectedApproval.status !== 'pending' && (
            <div className={`p-4 rounded-xl text-center font-semibold ${
              selectedApproval.status === 'approved' 
                ? 'bg-green-100 text-green-700' 
                : 'bg-red-100 text-red-700'
            }`}>
              {selectedApproval.status === 'approved' ? '✓ Approved' : '✗ Rejected'}
            </div>
          )}
        </main>
      </div>
    );
  }

  // List view
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Approvals</h1>
              <p className="text-sm text-gray-500">Review incoming invoices</p>
            </div>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900"
            >
              ← Home
            </Link>
          </div>
          
          {/* Filter tabs */}
          <div className="flex gap-2">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'pending' && pendingCount > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {filteredApprovals.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
            <div className="text-4xl mb-2">✓</div>
            <p>No {filter === 'all' ? '' : filter} invoices</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredApprovals.map(approval => (
              <button
                key={approval.id}
                onClick={() => setSelectedApproval(approval)}
                className="w-full bg-white rounded-xl shadow-sm border p-4 text-left hover:border-gray-300 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
                    PDF
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{approval.vendor}</span>
                      {approval.status === 'pending' && (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                      {approval.status === 'approved' && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          Approved
                        </span>
                      )}
                      {approval.status === 'rejected' && (
                        <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                          Rejected
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {approval.invoiceNumber} • {approval.itemCount} items • ${approval.invoiceTotal.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {approval.submittedBy} • {formatTimeAgo(approval.submittedAt)}
                    </div>
                    {approval.notes && (
                      <div className="text-xs text-amber-600 mt-2 bg-amber-50 px-2 py-1 rounded">
                        ⚠️ {approval.notes}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400">→</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
