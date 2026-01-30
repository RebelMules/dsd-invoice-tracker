'use client';

import { useState } from 'react';

interface Vendor {
  id: string;
  locId: string;
  name: string;
  contact?: string;
  phone?: string;
  email?: string;
  lastDelivery?: string;
  avgWeeklyVolume: number;
  status: 'active' | 'inactive';
}

const vendors: Vendor[] = [
  { id: '1', locId: '19', name: 'Clark Beverage (Pepsi)', contact: 'John Miller', phone: '(662) 555-1234', lastDelivery: '2026-01-29', avgWeeklyVolume: 4500, status: 'active' },
  { id: '2', locId: 'CC', name: 'CC Clark (Coca-Cola)', contact: 'Mike Johnson', phone: '(662) 555-2345', lastDelivery: '2026-01-28', avgWeeklyVolume: 3800, status: 'active' },
  { id: '3', locId: '371', name: 'Lipari Foods', contact: 'Sarah Davis', phone: '(662) 555-3456', lastDelivery: '2026-01-27', avgWeeklyVolume: 2200, status: 'active' },
  { id: '4', locId: '1', name: 'Prairie Farms Dairy', contact: 'Tom Wilson', phone: '(662) 555-4567', lastDelivery: '2026-01-29', avgWeeklyVolume: 1800, status: 'active' },
  { id: '5', locId: '3', name: 'Frito Lay', contact: 'Lisa Brown', phone: '(662) 555-5678', lastDelivery: '2026-01-28', avgWeeklyVolume: 1500, status: 'active' },
  { id: '6', locId: '10', name: 'Little Debbie', contact: 'Dave Smith', phone: '(662) 555-6789', lastDelivery: '2026-01-26', avgWeeklyVolume: 900, status: 'active' },
  { id: '7', locId: '9', name: 'Blue Bell', contact: 'Amy Jones', phone: '(662) 555-7890', lastDelivery: '2026-01-25', avgWeeklyVolume: 650, status: 'active' },
  { id: '8', locId: 'MITCHELL', name: 'Mitchell Distributing', contact: 'Robert Lee', phone: '(662) 555-8901', lastDelivery: '2026-01-24', avgWeeklyVolume: 1200, status: 'active' },
];

export default function VendorsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.locId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (selectedVendor) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6">
        <button
          onClick={() => setSelectedVendor(null)}
          className="text-gray-600 hover:text-gray-900 mb-4 flex items-center gap-2"
        >
          ← Back to Vendors
        </button>

        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          <div className="p-6 border-b bg-gradient-to-r from-green-500 to-emerald-600 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-3xl">
                🏢
              </div>
              <div>
                <h1 className="text-2xl font-bold">{selectedVendor.name}</h1>
                <p className="text-green-100">LOC ID: {selectedVendor.locId}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Contact Info */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Contact</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Contact Name</div>
                  <div className="font-medium">{selectedVendor.contact || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Phone</div>
                  <div className="font-medium">{selectedVendor.phone || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-medium">{selectedVendor.email || '—'}</div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Performance</h2>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Last Delivery</div>
                  <div className="font-medium">{selectedVendor.lastDelivery || '—'}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Avg Weekly Volume</div>
                  <div className="font-medium">${selectedVendor.avgWeeklyVolume.toLocaleString()}</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-500">Status</div>
                  <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${
                    selectedVendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedVendor.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    {selectedVendor.status === 'active' ? 'Active' : 'Inactive'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Invoices placeholder */}
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Recent Invoices</h2>
              <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                Invoice history will appear here
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-gray-500">Manage your DSD vendor relationships</p>
        </div>
        <button className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium shadow-sm">
          + Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-3 bg-white border rounded-xl shadow-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Vendor Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredVendors.map((vendor) => (
          <button
            key={vendor.id}
            onClick={() => setSelectedVendor(vendor)}
            className="bg-white rounded-2xl shadow-sm border p-5 text-left hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-xl">
                🏢
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{vendor.name}</div>
                <div className="text-sm text-gray-500">LOC ID: {vendor.locId}</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    vendor.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${vendor.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                    Active
                  </span>
                  <span className="text-xs text-gray-400">
                    Last: {vendor.lastDelivery}
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
