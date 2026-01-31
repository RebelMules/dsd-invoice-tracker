'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Good afternoon 👋</h1>
        <p className="text-gray-500 mt-1">Here's what's happening with your DSD invoices</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">📥</span>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">+12%</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">38</div>
          <div className="text-sm text-gray-500">Invoices This Week</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">⏳</span>
            <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">3</div>
          <div className="text-sm text-gray-500">Awaiting Approval</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">✅</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">$24,580</div>
          <div className="text-sm text-gray-500">Processed This Month</div>
        </div>
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-2xl">🏢</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">8</div>
          <div className="text-sm text-gray-500">Active Vendors</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Receiving - Primary */}
          <Link
            href="/receiving"
            className="group bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl shadow-lg shadow-green-500/20 text-white transition-all hover:shadow-xl hover:shadow-green-500/30 hover:scale-[1.02]"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl backdrop-blur-sm">
                📦
              </div>
              <div>
                <div className="text-xl font-bold">Start Receiving</div>
                <div className="text-green-100 text-sm">Scan items & capture invoice</div>
              </div>
              <div className="ml-auto text-white/50 group-hover:text-white group-hover:translate-x-1 transition-all">
                →
              </div>
            </div>
          </Link>

          {/* DSD Invoice Processing */}
          <Link
            href="/dsd/receiving"
            className="group bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md hover:border-green-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-3xl">
                🧾
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">DSD Invoices</div>
                <div className="text-gray-500 text-sm">Upload & verify PDFs</div>
              </div>
              <div className="ml-auto text-gray-300 group-hover:text-green-500 group-hover:translate-x-1 transition-all">
                →
              </div>
            </div>
          </Link>

          {/* Approvals */}
          <Link
            href="/approvals"
            className="group bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md hover:border-gray-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-3xl">
                ✅
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Approvals</div>
                <div className="text-gray-500 text-sm">3 invoices pending</div>
              </div>
              <div className="ml-auto">
                <span className="bg-amber-100 text-amber-700 text-sm font-medium px-3 py-1 rounded-full">
                  3
                </span>
              </div>
            </div>
          </Link>

          {/* DSD Ad Planner */}
          <Link
            href="/dsd/promos"
            className="group bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md hover:border-purple-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center text-3xl">
                📣
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">DSD Ad Planner</div>
                <div className="text-gray-500 text-sm">Add & manage promos</div>
              </div>
              <div className="ml-auto text-gray-300 group-hover:text-purple-500 group-hover:translate-x-1 transition-all">
                →
              </div>
            </div>
          </Link>

          {/* Returned Checks */}
          <Link
            href="/returned-checks"
            className="group bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md hover:border-red-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center text-3xl">
                🔄
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Returned Checks</div>
                <div className="text-gray-500 text-sm">Coming soon</div>
              </div>
              <div className="ml-auto">
                <span className="bg-gray-100 text-gray-500 text-xs font-medium px-2 py-1 rounded-full">
                  Soon
                </span>
              </div>
            </div>
          </Link>

          {/* View All Invoices */}
          <Link
            href="/invoices"
            className="group bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl">
                📄
              </div>
              <div>
                <div className="text-xl font-semibold text-gray-900">All Invoices</div>
                <div className="text-gray-500 text-sm">Browse & search history</div>
              </div>
              <div className="ml-auto text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all">
                →
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Links - External Resources */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📚 Quick Guides & Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <a
            href="#" 
            onClick={(e) => { e.preventDefault(); alert('URL coming from Notion'); }}
            className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-blue-300 transition-all text-center group"
          >
            <div className="text-2xl mb-2">📘</div>
            <div className="font-medium text-gray-900 group-hover:text-blue-600">FMS Guides</div>
            <div className="text-xs text-gray-400">Financial Management</div>
          </a>
          
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert('URL coming from Notion'); }}
            className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-green-300 transition-all text-center group"
          >
            <div className="text-2xl mb-2">🖥️</div>
            <div className="font-medium text-gray-900 group-hover:text-green-600">SMS LOC Guides</div>
            <div className="text-xs text-gray-400">POS System</div>
          </a>
          
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert('URL coming from Notion'); }}
            className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-purple-300 transition-all text-center group"
          >
            <div className="text-2xl mb-2">🤖</div>
            <div className="font-medium text-gray-900 group-hover:text-purple-600">RPA Training</div>
            <div className="text-xs text-gray-400">Automation Reference</div>
          </a>
          
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); alert('URL coming from Notion'); }}
            className="bg-white rounded-xl border p-4 hover:shadow-md hover:border-orange-300 transition-all text-center group"
          >
            <div className="text-2xl mb-2">🎨</div>
            <div className="font-medium text-gray-900 group-hover:text-orange-600">Content Maker</div>
            <div className="text-xs text-gray-400">GB Marketing</div>
          </a>
        </div>
        <p className="text-xs text-gray-400 mt-2 text-center">Links will be pulled from Notion</p>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
          <Link href="/invoices" className="text-sm text-green-600 hover:text-green-700 font-medium">
            View all →
          </Link>
        </div>
        <div className="divide-y">
          {[
            { vendor: 'Clark Beverage (Pepsi)', invoice: '#42682504', amount: '$2,348.80', time: '2 hours ago', status: 'approved' },
            { vendor: 'Prairie Farms Dairy', invoice: '#PF-78234', amount: '$634.20', time: '3 hours ago', status: 'pending' },
            { vendor: 'Lipari Foods', invoice: '#LF-112847', amount: '$2,156.80', time: '5 hours ago', status: 'pending' },
            { vendor: 'Frito Lay', invoice: '#FL-98234', amount: '$1,245.00', time: 'Yesterday', status: 'approved' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-colors">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                item.status === 'approved' ? 'bg-green-100' : 'bg-amber-100'
              }`}>
                {item.status === 'approved' ? '✓' : '⏳'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{item.vendor}</div>
                <div className="text-sm text-gray-500">Invoice {item.invoice}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-gray-900">{item.amount}</div>
                <div className="text-xs text-gray-400">{item.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Note */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🏗️</span>
          <div>
            <h3 className="font-semibold text-blue-900">Unified DSD Database</h3>
            <p className="text-sm text-blue-700 mt-1">
              All DSD data (invoices, promos, prices) flows into a single database. 
              Future: SMS Import Converter will pull from here to generate POS-ready exports.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
