import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">DSD Invoice Tracker</h1>
          <p className="text-gray-500">Grocery Basket</p>
        </div>
      </header>

      {/* Main navigation */}
      <main className="flex-1 max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="grid gap-4">
          {/* Receiving - Primary action */}
          <Link
            href="/receiving"
            className="bg-green-500 hover:bg-green-600 text-white p-6 rounded-2xl shadow-lg transition-all active:scale-98"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📦</div>
              <div>
                <div className="text-xl font-bold">Receiving</div>
                <div className="text-green-100">Scan & verify deliveries</div>
              </div>
            </div>
          </Link>

          {/* Approvals - Manager view */}
          <Link
            href="/approvals"
            className="bg-white hover:bg-gray-50 p-6 rounded-2xl shadow-sm border transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">✅</div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Approvals</div>
                <div className="text-gray-500">Review & approve for accounting</div>
              </div>
              <div className="ml-auto bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                3 pending
              </div>
            </div>
          </Link>

          {/* Invoice inbox */}
          <Link
            href="/invoices"
            className="bg-white hover:bg-gray-50 p-6 rounded-2xl shadow-sm border transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📄</div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Invoices</div>
                <div className="text-gray-500">Review & process scanned invoices</div>
              </div>
              <div className="ml-auto bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                38 pending
              </div>
            </div>
          </Link>

          {/* Vendors */}
          <Link
            href="/vendors"
            className="bg-white hover:bg-gray-50 p-6 rounded-2xl shadow-sm border transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">🏢</div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Vendors</div>
                <div className="text-gray-500">Cost files, contacts, promo history</div>
              </div>
            </div>
          </Link>

          {/* Reports */}
          <Link
            href="/reports"
            className="bg-white hover:bg-gray-50 p-6 rounded-2xl shadow-sm border transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="text-4xl">📊</div>
              <div>
                <div className="text-xl font-semibold text-gray-900">Reports</div>
                <div className="text-gray-500">Cost trends, discrepancies, allowances</div>
              </div>
            </div>
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-4 text-center text-sm text-gray-500">
        DSD Tracker v0.1 • Built for Grocery Basket
      </footer>
    </div>
  );
}
