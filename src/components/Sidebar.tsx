'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SkuPrice, Customer } from '@/lib/types';

interface SidebarProps {
  selectedCustomer: Customer | null;
  onSelectSku: (sku: SkuPrice, customerPrice?: string) => void;
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Sidebar({ selectedCustomer, onSelectSku }: SidebarProps) {
  const [skus, setSkus] = useState<SkuPrice[]>([]);
  const [allSkus, setAllSkus] = useState<SkuPrice[]>([]);
  const [filterLetter, setFilterLetter] = useState('A');
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSku, setNewSku] = useState({ skuCode: '', skuName: '', costPrice: '', unit: '' });
  const [addError, setAddError] = useState("");
  const [customerPrices, setCustomerPrices] = useState<Record<string, string>>({});

  const fetchAllSkus = useCallback(async () => {
    try {
      const res = await fetch('/api/skus?limit=500');
      const data = await res.json();
      if (Array.isArray(data)) setAllSkus(data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchAllSkus(); }, [fetchAllSkus]);

  const fetchSkus = useCallback(async (letter: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skus?letter=${letter}`);
      const data = await res.json();
      if (Array.isArray(data)) setSkus(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const searchSkus = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skus?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (Array.isArray(data)) setSkus(data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (searchText) {
      const timer = setTimeout(() => searchSkus(searchText), 300);
      return () => clearTimeout(timer);
    } else {
      fetchSkus(filterLetter);
    }
  }, [filterLetter, searchText, fetchSkus, searchSkus]);

  useEffect(() => {
    if (!selectedCustomer || allSkus.length === 0) {
      setCustomerPrices({});
      return;
    }
    const codes = allSkus.map(s => s.skuCode).join(',');
    if (!codes) return;
    fetch(`/api/prices?customerId=${selectedCustomer.id}&skuCodes=${encodeURIComponent(codes)}`)
      .then(r => r.json())
      .then(data => {
        if (data.prices) setCustomerPrices(data.prices);
      })
      .catch(console.error);
  }, [selectedCustomer, allSkus]);

  const handleLetterClick = (letter: string) => {
    setSearchText('');
    setFilterLetter(letter);
  };

  const handleAddSku = async () => {
    setAddError("");
    if (!newSku.skuCode || !newSku.skuName) return;
    try {
      const res = await fetch('/api/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSku),
      });
      if (res.ok) {
        const skuName = newSku.skuName;
        setNewSku({ skuCode: '', skuName: '', costPrice: '', unit: '' });
        setShowAddForm(false);
        // Show the new SKU by searching for its name
        setSearchText(skuName);
        setFilterLetter('');
        fetchAllSkus();
      }
    } catch (e) { console.error(e); }
  };

  const handleSelectSku = (sku: SkuPrice) => {
    const customerPrice = customerPrices[sku.skuCode];
    onSelectSku(sku, customerPrice);
  };

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-200">
          <input
            type="text"
            placeholder="搜索SKU..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="px-3 py-2 border-b border-gray-200">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full py-2 px-3 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            + 新增SKU
          </button>
        </div>

        {showAddForm && (
          <div className="p-3 border-b border-gray-200 bg-gray-50 space-y-2">
            <input type="text" placeholder="SKU编码" value={newSku.skuCode}
              onChange={e => setNewSku({ ...newSku, skuCode: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            <input type="text" placeholder="SKU名称" value={newSku.skuName}
              onChange={e => setNewSku({ ...newSku, skuName: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            <div className="flex gap-2">
              <input type="number" step="0.01" placeholder="成本价" value={newSku.costPrice}
                onChange={e => setNewSku({ ...newSku, costPrice: e.target.value })}
                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm" />
              <input type="text" placeholder="单位" value={newSku.unit}
                onChange={e => setNewSku({ ...newSku, unit: e.target.value })}
                className="w-20 px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleAddSku} className="flex-1 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">保存</button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddError(''); }} className="flex-1 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500">取消</button>
            </div>
            {addError && (
              <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{addError}</div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-400 text-sm">加载中...</div>
          ) : skus.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              {searchText ? '无匹配SKU' : '暂无SKU，点击上方按钮新增'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {skus.map(sku => (
                <button
                  key={sku.id}
                  onClick={() => handleSelectSku(sku)}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{sku.skuName}</div>
                      <div className="text-xs text-gray-400">{sku.skuCode}</div>
                    </div>
                    <div className="text-right">
                      {customerPrices[sku.skuCode] ? (
                        <div className="text-sm font-semibold text-blue-600">
                          ¥{parseFloat(customerPrices[sku.skuCode]).toFixed(2)}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-400">
                          成本: ¥{parseFloat(sku.costPrice).toFixed(2)}
                        </div>
                      )}
                      {sku.unit && <div className="text-xs text-gray-400">{sku.unit}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-8 flex flex-col justify-center items-center border-l border-gray-200 bg-gray-50 py-2">
        {ALPHABET.map(letter => (
          <button
            key={letter}
            onClick={() => handleLetterClick(letter)}
            className={`w-full text-center text-xs py-0.5 hover:text-blue-600 hover:font-bold transition-colors ${
              filterLetter === letter && !searchText ? 'text-blue-600 font-bold' : 'text-gray-500'
            }`}
          >
            {letter}
          </button>
        ))}
      </div>
    </div>
  );
}
