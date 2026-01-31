'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

// ============ TYPES ============
interface ReturnedCheck {
  check_id: number;
  maker_name: string | null;
  check_number: string | null;
  check_amount: number;
  check_date: string | null;
  return_date: string;
  return_reason: string | null;
  status: 'uncollected' | 'collected';
  maker_phone: string | null;
  maker_address: string | null;
  notes: string | null;
  blob_url: string | null;
  days_outstanding: number;
}

interface CheckStats {
  uncollected_count: number;
  uncollected_amount: number;
  collected_count: number;
  collected_amount: number;
  total_count: number;
  total_amount: number;
}

interface ExtractedData {
  maker_name?: string;
  check_number?: string;
  check_amount?: number;
  check_date?: string;
  bank_name?: string;
  maker_phone?: string;
  maker_address?: string;
  blob_url?: string;
  scan_filename?: string;
}

type ViewMode = 'dashboard' | 'upload' | 'review' | 'detail';

// ============ COMPONENT ============
export default function ReturnedChecksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [checks, setChecks] = useState<ReturnedCheck[]>([]);
  const [stats, setStats] = useState<CheckStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('uncollected');
  
  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ExtractedData & { return_date?: string; return_reason?: string; notes?: string }>({});
  
  // Detail view
  const [selectedCheck, setSelectedCheck] = useState<ReturnedCheck | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ============ DATA LOADING ============
  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [checksRes, statsRes] = await Promise.all([
        fetch(`/api/returned-checks?status=${statusFilter}`),
        fetch('/api/returned-checks?type=stats'),
      ]);

      if (checksRes.ok) {
        const checksData = await checksRes.json();
        setChecks(checksData.checks || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats || null);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setIsLoading(false);
  };

  // ============ FILE UPLOAD ============
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
    if (files.length > 0) handleFile(files[0]);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) handleFile(files[0]);
  };

  const handleFile = async (file: File) => {
    setError(null);
    setIsProcessing(true);
    setViewMode('upload');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/returned-checks', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OCR processing failed');
      }

      setExtractedData(data.data);
      setFormData({
        ...data.data,
        return_date: new Date().toISOString().split('T')[0],
        return_reason: 'NSF',
      });
      setViewMode('review');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process check');
      setViewMode('dashboard');
    }
    setIsProcessing(false);
  };

  // ============ SAVE CHECK ============
  const handleSaveCheck = async () => {
    setError(null);
    try {
      const response = await fetch('/api/returned-checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setSuccess('Returned check saved!');
      setExtractedData(null);
      setFormData({});
      setViewMode('dashboard');
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  // ============ MARK COLLECTED ============
  const markCollected = async (checkId: number) => {
    try {
      const response = await fetch('/api/returned-checks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ check_id: checkId, status: 'collected' }),
      });

      if (response.ok) {
        setSuccess('Marked as collected!');
        setSelectedCheck(null);
        setViewMode('dashboard');
        loadData();
      }
    } catch (err) {
      setError('Failed to update');
    }
  };

  // ============ FORMAT HELPERS ============
  const formatCurrency = (amount: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

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
                <h1 className="text-xl font-bold text-gray-900">🔄 Returned Checks</h1>
                <p className="text-sm text-gray-500">Track & collect</p>
              </div>
            </div>
            
            <button
              onClick={() => { setViewMode('upload'); setExtractedData(null); setFormData({}); }}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <span>+</span> Add Check
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-center gap-2">
            ⚠️ {error}
            <button onClick={() => setError(null)} className="ml-auto">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 flex items-center gap-2">
            ✓ {success}
            <button onClick={() => setSuccess(null)} className="ml-auto">✕</button>
          </div>
        )}

        {/* Upload View */}
        {viewMode === 'upload' && !isProcessing && (
          <div className="max-w-xl mx-auto">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                isDragging ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-red-400 hover:bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="text-6xl mb-4">📸</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Drop Check Image Here</h2>
              <p className="text-gray-500 mb-4">or click to browse</p>
              <p className="text-sm text-gray-400">Supports JPEG, PNG, WebP</p>
            </div>
            
            <button
              onClick={() => setViewMode('dashboard')}
              className="mt-4 w-full py-2 text-gray-500 hover:text-gray-700"
            >
              ← Back to Dashboard
            </button>
          </div>
        )}

        {/* Processing */}
        {isProcessing && (
          <div className="max-w-xl mx-auto bg-white rounded-2xl border p-12 text-center">
            <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
            <h2 className="text-xl font-semibold text-gray-900">Reading check...</h2>
            <p className="text-gray-500 mt-2">Extracting details via AI</p>
          </div>
        )}

        {/* Review Extracted Data */}
        {viewMode === 'review' && extractedData && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Review Extracted Data</h2>
            
            {extractedData.blob_url && (
              <div className="mb-6">
                <img src={extractedData.blob_url} alt="Check" className="max-h-48 rounded-lg border mx-auto" />
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Maker Name</label>
                <input
                  type="text"
                  value={formData.maker_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maker_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Number</label>
                <input
                  type="text"
                  value={formData.check_number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_number: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.check_amount || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_amount: parseFloat(e.target.value) }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Check Date</label>
                <input
                  type="date"
                  value={formData.check_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, check_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Date</label>
                <input
                  type="date"
                  value={formData.return_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, return_date: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Return Reason</label>
                <select
                  value={formData.return_reason || 'NSF'}
                  onChange={(e) => setFormData(prev => ({ ...prev, return_reason: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="NSF">NSF</option>
                  <option value="Account Closed">Account Closed</option>
                  <option value="Stop Payment">Stop Payment</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.maker_phone || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, maker_phone: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank</label>
                <input
                  type="text"
                  value={formData.bank_name || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                  rows={2}
                  placeholder="Any notes about this check..."
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t">
              <button
                onClick={() => { setViewMode('dashboard'); setExtractedData(null); }}
                className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCheck}
                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                Save Returned Check
              </button>
            </div>
          </div>
        )}

        {/* Dashboard View */}
        {viewMode === 'dashboard' && (
          <>
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-red-600">Uncollected</span>
                    <span className="text-red-500 text-xl">💸</span>
                  </div>
                  <div className="text-3xl font-bold text-red-600">{formatCurrency(Number(stats.uncollected_amount))}</div>
                  <div className="text-sm text-gray-500 mt-1">{stats.uncollected_count} checks</div>
                </div>
                <div className="bg-white rounded-xl border p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-600">Collected</span>
                    <span className="text-green-500 text-xl">✓</span>
                  </div>
                  <div className="text-3xl font-bold text-green-600">{formatCurrency(Number(stats.collected_amount))}</div>
                  <div className="text-sm text-gray-500 mt-1">{stats.collected_count} checks</div>
                </div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setStatusFilter('uncollected')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  statusFilter === 'uncollected'
                    ? 'bg-red-500 text-white'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                Uncollected
              </button>
              <button
                onClick={() => setStatusFilter('collected')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  statusFilter === 'collected'
                    ? 'bg-green-500 text-white'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                Collected
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium ${
                  statusFilter === 'all'
                    ? 'bg-gray-700 text-white'
                    : 'bg-white border text-gray-600 hover:bg-gray-50'
                }`}
              >
                All
              </button>
            </div>

            {/* Checks List */}
            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : checks.length === 0 ? (
              <div className="bg-white rounded-xl border p-12 text-center">
                <div className="text-6xl mb-4">{statusFilter === 'uncollected' ? '🎉' : '📋'}</div>
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {statusFilter === 'uncollected' ? 'All Caught Up!' : 'No Checks Found'}
                </h2>
                <p className="text-gray-500">
                  {statusFilter === 'uncollected' 
                    ? 'No uncollected checks right now' 
                    : 'No checks in this category'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {checks.map((check) => (
                  <div 
                    key={check.check_id} 
                    className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow ${
                      check.status === 'collected' ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* Status indicator */}
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl ${
                        check.status === 'uncollected' ? 'bg-red-100' : 'bg-green-100'
                      }`}>
                        {check.status === 'uncollected' ? '💸' : '✓'}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-900">{check.maker_name || 'Unknown'}</div>
                        <div className="text-sm text-gray-500">
                          Check #{check.check_number || '—'} • {check.return_reason}
                          {check.status === 'uncollected' && (
                            <span className="ml-2 text-red-500 font-medium">{check.days_outstanding}d ago</span>
                          )}
                        </div>
                      </div>
                      
                      {/* Amount */}
                      <div className="text-right">
                        <div className={`text-xl font-bold ${
                          check.status === 'uncollected' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(check.check_amount)}
                        </div>
                        {check.maker_phone && (
                          <a href={`tel:${check.maker_phone}`} className="text-sm text-blue-500 hover:underline">
                            {check.maker_phone}
                          </a>
                        )}
                      </div>
                      
                      {/* Action */}
                      {check.status === 'uncollected' && (
                        <button
                          onClick={() => markCollected(check.check_id)}
                          className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm"
                        >
                          Collected
                        </button>
                      )}
                    </div>
                    
                    {check.notes && (
                      <div className="mt-3 pt-3 border-t text-sm text-gray-500">
                        {check.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
