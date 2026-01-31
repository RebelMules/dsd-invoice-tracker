'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // DSD Management
  const dsdItems = [
    { href: '/', label: 'Dashboard', icon: '🏠' },
    { href: '/receiving', label: 'Receiving', icon: '📦' },
    { href: '/dsd/receiving', label: 'DSD Invoices', icon: '🧾' },
    { href: '/dsd/promos', label: 'Ad Planner', icon: '📣' },
    { href: '/approvals', label: 'Approvals', icon: '✅' },
    { href: '/invoices', label: 'Invoices', icon: '📄' },
    { href: '/vendors', label: 'Vendors', icon: '🏢' },
  ];

  // Operations
  const opsItems = [
    { href: '/returned-checks', label: 'Returned Checks', icon: '🔄' },
  ];

  const navItems = [...dsdItems, ...opsItems];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-green-500/20">
                D
              </div>
              <div className="hidden sm:block">
                <div className="font-bold text-gray-900">DSD Tracker</div>
                <div className="text-xs text-gray-500">Grocery Basket</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right side - User/Actions */}
            <div className="flex items-center gap-3">
              {/* Notification bell */}
              <button className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>

              {/* Mobile menu button */}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="md:hidden p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                {menuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Dropdown */}
        {menuOpen && (
          <div className="md:hidden border-t bg-white">
            <nav className="px-4 py-3 space-y-1">
              {/* DSD Section */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-2 pb-1">DSD Management</div>
              {dsdItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-green-50 text-green-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                  {item.href === '/approvals' && (
                    <span className="ml-auto bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                      3
                    </span>
                  )}
                </Link>
              ))}
              
              {/* Operations Section */}
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-4 pt-4 pb-1 border-t mt-2">Operations</div>
              {opsItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all ${
                    isActive(item.href)
                      ? 'bg-red-50 text-red-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <div className="flex justify-around items-center h-16 px-2">
          {[
            { href: '/', label: 'Home', icon: '🏠' },
            { href: '/receiving', label: 'Receiving', icon: '📦' },
            { href: '/dsd/receiving', label: 'Invoices', icon: '🧾' },
            { href: '/returned-checks', label: 'Checks', icon: '🔄' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-2 ${
                isActive(item.href) 
                  ? item.href === '/returned-checks' ? 'text-red-600' : 'text-green-600' 
                  : 'text-gray-500'
              }`}
            >
              <span className="text-xl mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
              {isActive(item.href) && (
                <div className={`absolute bottom-0 w-12 h-1 rounded-t-full ${
                  item.href === '/returned-checks' ? 'bg-red-500' : 'bg-green-500'
                }`}></div>
              )}
            </Link>
          ))}
        </div>
      </nav>

      {/* Spacer for bottom nav on mobile */}
      <div className="md:hidden h-16"></div>
    </div>
  );
}
