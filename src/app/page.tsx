'use client';

import { useState, useCallback } from 'react';
import Sidebar from '@/components/Sidebar';
import OrderForm from '@/components/OrderForm';
import type { Customer, SkuPrice } from '@/lib/types';

interface LineItem {
  skuCode: string;
  skuName: string;
  quantity: string;
  unitPrice: string;
  total: string;
  unit: string;
}

export default function Home() {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [orderKey, setOrderKey] = useState(0);

  const handleSelectSku = useCallback((sku: SkuPrice, customerPrice?: string) => {
    const price = customerPrice || sku.costPrice;
    const newItem: LineItem = {
      skuCode: sku.skuCode,
      skuName: sku.skuName,
      quantity: '1',
      unitPrice: parseFloat(price).toFixed(2),
      total: parseFloat(price).toFixed(2),
      unit: sku.unit,
    };
    setLineItems(prev => [...prev, newItem]);
  }, []);

  const handleCustomerChange = useCallback((customer: Customer | null) => {
    setSelectedCustomer(customer);
  }, []);

  const handleNewOrder = useCallback(() => {
    setLineItems([]);
    setSelectedCustomer(null);
    setOrderKey(k => k + 1);
  }, []);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div className="w-[320px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 border-b border-gray-200 bg-blue-600 text-white">
          <h1 className="text-sm font-bold">SKU 价格表</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <Sidebar
            selectedCustomer={selectedCustomer}
            onSelectSku={handleSelectSku}
          />
        </div>
      </div>

      {/* Right - Order Form */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-200 bg-white flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">开单</h2>
          <button
            onClick={handleNewOrder}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            + 新建订单
          </button>
        </div>
        <div className="flex-1 overflow-hidden bg-white" key={orderKey}>
          <OrderForm
            selectedCustomer={selectedCustomer}
            lineItems={lineItems}
            onLineItemsChange={setLineItems}
            onCustomerChange={handleCustomerChange}
            onNewOrder={handleNewOrder}
          />
        </div>
      </div>
    </div>
  );
}
