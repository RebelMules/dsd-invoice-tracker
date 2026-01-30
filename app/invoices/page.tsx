'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Invoice {
  id: string;
  vendor: string;
  invoiceNumber: string;
  date: string;
  total: number;
  itemCount: number;
  status: 'pending' | 'approved' | 'rejected' | 'processing';
  submittedBy: string;
}

const mockInvoices: Invoice[] = [
  { id: '1', vendor: 'Clark Beverage (Pepsi)', invoiceNumber: '42682504', date: '2026-01-29', total: 2348.80, itemCount: 10, status: 'approved', submittedBy: 'Store #42' },
  { id: '2', vendor: 'Prairie Farms Dairy', invoiceNumber: 'PF-78234', date: '2026-01-29', total: 634.20, itemCount: 18, status: 'pending', submittedBy: 'Store #42' },
  { id: '3', vendor: 'Lipari Foods', invoiceNumber: 'LF-112847', date: '2026-01-28', total: 2156.80, itemCount: 42, status: 'pending', submittedBy: 'Store #41' },
  { id: '4', vendor: 'Frito Lay', invoiceNumber: 'FL-98234', date: '2026-01-28', total: 1245.00, itemCount: 28, status: 'approved', submittedBy: 'Store #42' },
  { id: '5', vendor: 'CC Clark (Coca-Cola)', invoiceNumber: 'CC-445521', date: '2026-01-27', total: 1876.50, itemCount: 22, status: 'approved', submittedBy: 'Store #42' },
  { id: '6', vendor: 'Little Debbie', invoiceNumber: 'LD-90122', date: '2026-01-27', total: 567.30, itemCount: 15, status: 'approved', submittedBy: 'Store #41' },
  { id: '7', vendor: 'Blue Bell', invoiceNumber: 'BB-33421', date: '2026-01-26', total: 892.00, itemCount: 8, status: 'approved', submittedBy: 'Store #42' },
  { id: '8', vendor: 'Mitchell Distributing', invoiceNumber: 'MD-2026-0126', date: '2026-01-26', total: 1456.75, itemCount: 35, status: 'approved', submittedBy: 'Store #42' },
];

export default function InvoicesPage() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInvoices = mockInvoices.filter(inv => {
    const matchesFilter = filter === 'all' || inv.status === filter;
    const matchesSearch = inv.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getStatusBadge = (status: Invoice['status']) => {
    switch (status) {
      case 'approved':
        return <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">Approved</span>;
      case 'pending':
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">Pending</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">Rejected</span>;
      case 'processing':
        return <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">Processing</span>;
    }
  };

  const totalPending = mockInvoices.filter(i => i.status === 'pending').length;
  const totalApproved = mockInvoices.filter(i => i.status === 'approved').length;
  const totalValue = mockInvoices.reduce((sum, i) => sum + i.total, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500">View and manage all DSD invoices</p>
        </div>
        <Link
          href="/receiving"
          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium shadow-sm"
        >
          + New Invoice
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-bold text-gray-900">{mockInvoices.length}</div>
          <div className="text-sm text-gray-500">Total Invoices</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-bold text-amber-600">{totalPending}</div>
          <div className="text-sm text-gray-500">Pending Approval</div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border">
          <div className="text-2xl font-bold text-green-600">${totalValue.toLocaleString()}</div>
          <div className="text-sm text-gray-500">Total Value</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search invoices..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 bg-white border rounded-xl shadow-sm"
        />
        <div className="flex gap-2">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border hover:bg-gray-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Invoice List */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Invoice</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendor</th>
                <th className="text-left px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="text-right px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="text-center px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-mono text-sm font-medium text-gray-900">{invoice.invoiceNumber}</div>
                    <div className="text-xs text-gray-500">{invoice.submittedBy}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{invoice.vendor}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{invoice.date}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 text-right">{invoice.itemCount}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-semibold text-gray-900">${invoice.total.toLocaleString()}</div>
                  </td>
                  <td className="px-6 py-4 text-center">{getStatusBadge(invoice.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No invoices found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}
