'use client';

import { useState } from 'react';

export interface LineItem {
  upc: string;
  description: string;
  cases: number;
  units: number;
  unitCost: number;
  totalAmount: number;
}

interface LineItemReviewProps {
  items: LineItem[];
  onSave: (items: LineItem[]) => void;
  onCancel: () => void;
}

export default function LineItemReview({ items, onSave, onCancel }: LineItemReviewProps) {
  const [editedItems, setEditedItems] = useState<LineItem[]>(items);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const updateItem = (index: number, field: keyof LineItem, value: string | number) => {
    setEditedItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // Auto-calculate total if cases/units/unitCost change
      if (field === 'cases' || field === 'units' || field === 'unitCost') {
        const units = field === 'units' ? Number(value) : updated.units;
        const unitCost = field === 'unitCost' ? Number(value) : updated.unitCost;
        if (units && unitCost) {
          updated.totalAmount = Number((units * unitCost).toFixed(2));
        }
      }
      
      return updated;
    }));
  };

  const deleteItem = (index: number) => {
    setEditedItems(prev => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setEditedItems(prev => [...prev, {
      upc: '',
      description: 'New Item',
      cases: 0,
      units: 0,
      unitCost: 0,
      totalAmount: 0,
    }]);
    setEditingIndex(editedItems.length);
  };

  const totalAmount = editedItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Review Line Items</h2>
          <p className="text-sm text-gray-500">Tap any field to edit. Verify before submitting.</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-500">{editedItems.length} items</div>
          <div className="font-semibold text-lg">${totalAmount.toFixed(2)}</div>
        </div>
      </div>

      {/* Line items */}
      <div className="divide-y max-h-[60vh] overflow-y-auto">
        {editedItems.map((item, idx) => (
          <div 
            key={idx} 
            className={`p-3 ${editingIndex === idx ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
            onClick={() => setEditingIndex(idx)}
          >
            {editingIndex === idx ? (
              // Edit mode
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">UPC</label>
                    <input
                      type="text"
                      value={item.upc}
                      onChange={(e) => updateItem(idx, 'upc', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm font-mono"
                      placeholder="UPC"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">Description</label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                      placeholder="Description"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-20">
                    <label className="text-xs text-gray-500">Cases</label>
                    <input
                      type="number"
                      value={item.cases || ''}
                      onChange={(e) => updateItem(idx, 'cases', Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </div>
                  <div className="w-20">
                    <label className="text-xs text-gray-500">Units</label>
                    <input
                      type="number"
                      value={item.units || ''}
                      onChange={(e) => updateItem(idx, 'units', Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm text-center"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500">Unit Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.unitCost || ''}
                      onChange={(e) => updateItem(idx, 'unitCost', Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm text-right"
                    />
                  </div>
                  <div className="w-24">
                    <label className="text-xs text-gray-500">Total</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.totalAmount || ''}
                      onChange={(e) => updateItem(idx, 'totalAmount', Number(e.target.value))}
                      className="w-full px-2 py-1 border rounded text-sm text-right font-medium"
                    />
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteItem(idx); }}
                    className="text-red-600 text-sm hover:text-red-700"
                  >
                    Delete item
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingIndex(null); }}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              // View mode
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs text-gray-500">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{item.description || 'No description'}</div>
                  <div className="text-xs text-gray-500 font-mono">{item.upc || 'No UPC'}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="text-gray-500">{item.cases}cs / {item.units}u</div>
                  <div className="font-medium">${item.totalAmount?.toFixed(2) || '0.00'}</div>
                </div>
                <div className="text-gray-400 text-xs">✎</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add item button */}
      <div className="border-t p-3">
        <button
          onClick={addItem}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 text-sm"
        >
          + Add line item
        </button>
      </div>

      {/* Actions */}
      <div className="bg-gray-50 border-t p-4 flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-700 font-medium"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(editedItems)}
          className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold"
        >
          Confirm & Continue
        </button>
      </div>
    </div>
  );
}
