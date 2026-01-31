'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

// ============ TYPES ============
interface Vendor {
  vendor_id: number;
  name: string;
  short_code: string;
}

interface Promo {
  promo_id?: number;
  vendor_id: number | null;
  vendor_name?: string;
  description: string;
  promo_type: 'billback' | 'scan' | 'off-invoice' | 'OI' | 'TPR' | 'EDLP';
  start_date: string;
  end_date: string;
  allowance_amount: number;
  allowance_type: 'per_case' | 'per_lb' | 'flat' | 'percent';
  min_qty: number | null;
  notes: string;
  // SMS Import fields (for column mapping)
  sms_deal_type?: string;
  sms_deal_cost?: number;
  sms_ad_price?: number;
  sms_limit?: number;
  products?: PromoProduct[];
}

interface PromoProduct {
  upc?: string;
  description: string;
  item_code?: string;
}

// ============ COMPONENT ============
export default function DSDAdPlannerPage() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState<Promo>({
    vendor_id: null,
    description: '',
    promo_type: 'off-invoice',
    start_date: '',
    end_date: '',
    allowance_amount: 0,
    allowance_type: 'per_case',
    min_qty: null,
    notes: '',
    sms_deal_type: '',
    sms_deal_cost: undefined,
    sms_ad_price: undefined,
    sms_limit: undefined,
    products: [],
  });

  // Product entry
  const [newProduct, setNewProduct] = useState({ upc: '', description: '', item_code: '' });

  // ============ DATA LOADING ============
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [promosRes, vendorsRes] = await Promise.all([
        fetch('/api/dsd/promos'),
        fetch('/api/dsd/promos?type=vendors'),
      ]);
      
      if (promosRes.ok) {
        const promosData = await promosRes.json();
        setPromos(promosData.promos || []);
      }
      
      if (vendorsRes.ok) {
        const vendorsData = await vendorsRes.json();
        setVendors(vendorsData.vendors || []);
      }
    } catch (err) {
      console.error('Load error:', err);
    }
    setIsLoading(false);
  };

  // ============ FORM HANDLERS ============
  const resetForm = () => {
    setForm({
      vendor_id: null,
      description: '',
      promo_type: 'off-invoice',
      start_date: '',
      end_date: '',
      allowance_amount: 0,
      allowance_type: 'per_case',
      min_qty: null,
      notes: '',
      sms_deal_type: '',
      sms_deal_cost: undefined,
      sms_ad_price: undefined,
      sms_limit: undefined,
      products: [],
    });
    setNewProduct({ upc: '', description: '', item_code: '' });
    setEditingPromo(null);
  };

  const openNewPromo = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditPromo = (promo: Promo) => {
    setForm({
      ...promo,
      start_date: promo.start_date?.split('T')[0] || '',
      end_date: promo.end_date?.split('T')[0] || '',
    });
    setEditingPromo(promo);
    setShowForm(true);
  };

  const addProduct = () => {
    if (!newProduct.description.trim()) return;
    setForm(prev => ({
      ...prev,
      products: [...(prev.products || []), { ...newProduct }],
    }));
    setNewProduct({ upc: '', description: '', item_code: '' });
  };

  const removeProduct = (idx: number) => {
    setForm(prev => ({
      ...prev,
      products: prev.products?.filter((_, i) => i !== idx) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/dsd/promos', {
        method: editingPromo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          promo_id: editingPromo?.promo_id,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save promo');
      }

      setSuccess(editingPromo ? 'Promo updated!' : 'Promo added!');
      setShowForm(false);
      resetForm();
      loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const handleDelete = async (promoId: number) => {
    if (!confirm('Delete this promo?')) return;
    
    try {
      const response = await fetch('/api/dsd/promos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promo_id: promoId }),
      });

      if (response.ok) {
        setSuccess('Promo deleted');
        loadData();
      }
    } catch (err) {
      setError('Failed to delete');
    }
  };

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
                <h1 className="text-xl font-bold text-gray-900">📣 DSD Ad Planner</h1>
                <p className="text-sm text-gray-500">Add & manage vendor promotions</p>
              </div>
            </div>
            
            <button
              onClick={openNewPromo}
              className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium flex items-center gap-2"
            >
              <span>+</span> Add Promo
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Status Messages */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 flex items-center gap-2">
            <span>⚠️</span> {error}
            <button onClick={() => setError(null)} className="ml-auto">✕</button>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 flex items-center gap-2">
            <span>✓</span> {success}
            <button onClick={() => setSuccess(null)} className="ml-auto">✕</button>
          </div>
        )}

        {/* Promo Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {editingPromo ? 'Edit Promo' : 'Add New Promo'}
                </h2>
                <button onClick={() => { setShowForm(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-2xl">
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {/* Vendor */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
                  <select
                    value={form.vendor_id || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, vendor_id: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  >
                    <option value="">Select vendor...</option>
                    {vendors.map(v => (
                      <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Promo Description</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Coca-Cola 2L Buy 2 Get 1 Free"
                    className="w-full px-3 py-2 border rounded-lg"
                    required
                  />
                </div>

                {/* Promo Type & Dates */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Promo Type</label>
                    <select
                      value={form.promo_type}
                      onChange={(e) => setForm(prev => ({ ...prev, promo_type: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="off-invoice">Off-Invoice</option>
                      <option value="OI">OI (Off Invoice)</option>
                      <option value="billback">Billback</option>
                      <option value="scan">Scan Deal</option>
                      <option value="TPR">TPR</option>
                      <option value="EDLP">EDLP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.start_date}
                      onChange={(e) => setForm(prev => ({ ...prev, start_date: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={form.end_date}
                      onChange={(e) => setForm(prev => ({ ...prev, end_date: e.target.value }))}
                      className="w-full px-3 py-2 border rounded-lg"
                      required
                    />
                  </div>
                </div>

                {/* Allowance */}
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allowance Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      value={form.allowance_amount}
                      onChange={(e) => setForm(prev => ({ ...prev, allowance_amount: parseFloat(e.target.value) || 0 }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Allowance Type</label>
                    <select
                      value={form.allowance_type}
                      onChange={(e) => setForm(prev => ({ ...prev, allowance_type: e.target.value as any }))}
                      className="w-full px-3 py-2 border rounded-lg"
                    >
                      <option value="per_case">Per Case</option>
                      <option value="per_lb">Per LB</option>
                      <option value="flat">Flat</option>
                      <option value="percent">Percent</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Qty</label>
                    <input
                      type="number"
                      value={form.min_qty || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, min_qty: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="Optional"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>

                {/* SMS Import Mapping Section */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <span>🔄</span> SMS Import Mapping
                    <span className="text-xs font-normal text-gray-400">(for POS export)</span>
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">SMS Deal Type</label>
                      <input
                        type="text"
                        value={form.sms_deal_type || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, sms_deal_type: e.target.value }))}
                        placeholder="e.g., TPR"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Deal Cost</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.sms_deal_cost || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, sms_deal_cost: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Ad Price</label>
                      <input
                        type="number"
                        step="0.01"
                        value={form.sms_ad_price || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, sms_ad_price: e.target.value ? parseFloat(e.target.value) : undefined }))}
                        placeholder="0.00"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Limit</label>
                      <input
                        type="number"
                        value={form.sms_limit || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, sms_limit: e.target.value ? parseInt(e.target.value) : undefined }))}
                        placeholder="0"
                        className="w-full px-2 py-1.5 border rounded text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Products */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Products on Promo</h3>
                  
                  {/* Product list */}
                  {form.products && form.products.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {form.products.map((p, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                          <span className="text-sm font-mono text-gray-500">{p.upc || '—'}</span>
                          <span className="text-sm flex-1">{p.description}</span>
                          <span className="text-xs text-gray-400">{p.item_code}</span>
                          <button type="button" onClick={() => removeProduct(idx)} className="text-red-500 hover:text-red-700">✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Add product */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newProduct.upc}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, upc: e.target.value }))}
                      placeholder="UPC"
                      className="w-32 px-2 py-1.5 border rounded text-sm font-mono"
                    />
                    <input
                      type="text"
                      value={newProduct.description}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Description"
                      className="flex-1 px-2 py-1.5 border rounded text-sm"
                    />
                    <input
                      type="text"
                      value={newProduct.item_code}
                      onChange={(e) => setNewProduct(prev => ({ ...prev, item_code: e.target.value }))}
                      placeholder="Item Code"
                      className="w-24 px-2 py-1.5 border rounded text-sm"
                    />
                    <button
                      type="button"
                      onClick={addProduct}
                      className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 rounded text-sm font-medium"
                    >
                      + Add
                    </button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional notes..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    rows={2}
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); }}
                    className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg font-medium"
                  >
                    {editingPromo ? 'Update Promo' : 'Save Promo'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Promos List */}
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 mt-3">Loading promos...</p>
          </div>
        ) : promos.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <div className="text-6xl mb-4">📣</div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Promos Yet</h2>
            <p className="text-gray-500 mb-6">Add your first vendor promotion to get started</p>
            <button
              onClick={openNewPromo}
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium"
            >
              + Add First Promo
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Active Promos */}
            <h2 className="text-lg font-semibold text-gray-900">Active & Upcoming Promos</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {promos.map((promo) => (
                <div key={promo.promo_id} className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        promo.promo_type === 'billback' ? 'bg-blue-100 text-blue-700' :
                        promo.promo_type === 'scan' ? 'bg-green-100 text-green-700' :
                        promo.promo_type === 'TPR' ? 'bg-amber-100 text-amber-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {promo.promo_type.toUpperCase()}
                      </span>
                      <h3 className="font-semibold text-gray-900 mt-2">{promo.description}</h3>
                      <p className="text-sm text-gray-500">{promo.vendor_name}</p>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => openEditPromo(promo)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => promo.promo_id && handleDelete(promo.promo_id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Dates:</span>
                      <span className="ml-1 font-medium">
                        {promo.start_date?.split('T')[0]} → {promo.end_date?.split('T')[0]}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Allowance:</span>
                      <span className="ml-1 font-medium text-green-600">
                        ${promo.allowance_amount?.toFixed(2)} / {promo.allowance_type?.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  {promo.products && promo.products.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-500">{promo.products.length} product(s)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Export Section */}
        <div className="mt-8 bg-gray-100 rounded-xl p-6">
          <h3 className="font-semibold text-gray-900 mb-2">🔄 SMS Import Converter</h3>
          <p className="text-sm text-gray-600 mb-4">
            Export promos to SMS-ready format for POS import. Coming soon.
          </p>
          <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed">
            Export to SMS Format
          </button>
        </div>
      </main>
    </div>
  );
}
