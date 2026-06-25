'use client';

import { useState, useEffect, useRef } from 'react';
import type { Customer } from '@/lib/types';

interface LineItem {
  skuCode: string;
  skuName: string;
  quantity: string;
  unitPrice: string;
  total: string;
  unit: string;
}

interface Props {
  selectedCustomer: Customer | null;
  lineItems: LineItem[];
  onLineItemsChange: (items: LineItem[]) => void;
  onCustomerChange: (customer: Customer | null) => void;
}

export default function OrderForm({ selectedCustomer, lineItems, onLineItemsChange, onCustomerChange }: Props) {
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '', notes: '' });
  const [stampImage, setStampImage] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const stampInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(customerSearch)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomerResults(data);
          setShowCustomerDropdown(true);
        }
      } catch (e) { console.error(e); }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const updateLineItem = (index: number, field: keyof LineItem, value: string) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };
    if (field === 'quantity' || field === 'unitPrice') {
      const qty = parseFloat(updated[index].quantity) || 0;
      const price = parseFloat(updated[index].unitPrice) || 0;
      updated[index].total = (qty * price).toFixed(2);
    }
    onLineItemsChange(updated);
  };

  const removeLineItem = (index: number) => {
    onLineItemsChange(lineItems.filter((_, i) => i !== index));
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.name) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCustomer),
      });
      const data = await res.json();
      if (res.ok) {
        onCustomerChange(data);
        setShowNewCustomerForm(false);
        setNewCustomer({ name: '', phone: '', address: '', notes: '' });
        setCustomerSearch('');
      }
    } catch (e) { console.error(e); }
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setStampImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const totalAmount = lineItems.reduce((sum, item) => sum + parseFloat(item.total || '0'), 0);

  const handleSave = async () => {
    if (!selectedCustomer || lineItems.length === 0) return;
    setSaving(true);
    try {
      const orderNumber = `ORD-${Date.now()}`;
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          items: lineItems.map(item => ({
            skuCode: item.skuCode,
            skuName: item.skuName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
          notes: orderNotes,
          stampImage,
          orderNumber,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSavedMessage(`✓ 订单 ${orderNumber} 已保存到云端`);
        setTimeout(() => setSavedMessage(''), 3000);
        // Clear form for new order
        onLineItemsChange([]);
        setOrderNotes('');
        setStampImage('');
      } else {
        setSavedMessage(`✗ 保存失败: ${data.error}`);
        setTimeout(() => setSavedMessage(''), 4000);
      }
    } catch (e: any) {
      setSavedMessage('✗ 网络错误，保存失败');
      setTimeout(() => setSavedMessage(''), 4000);
    }
    setSaving(false);
  };

  const handlePrintPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    let y = 15;

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('销 售 单', pageW / 2, y, { align: 'center' });
    y += 10;

    // Order info
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const orderNum = `ORD-${Date.now()}`;
    doc.text(`单号: ${orderNum}`, 15, y);
    doc.text(`日期: ${new Date().toLocaleDateString('zh-CN')}`, pageW - 15, y, { align: 'right' });
    y += 7;

    // Customer info
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`客户: ${selectedCustomer?.name || '--'}`, 15, y);
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`电话: ${selectedCustomer?.phone || '--'}`, 15, y);
    doc.text(`地址: ${selectedCustomer?.address || '--'}`, pageW - 15, y, { align: 'right' });
    y += 10;

    // Table
    const colX = [15, 25, 82, 115, 140, 165];
    doc.setFillColor(240, 240, 240);
    doc.rect(15, y, pageW - 30, 8, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    ['#', '商品名称', 'SKU编码', '数量', '单价(¥)', '金额(¥)'].forEach((h, i) => {
      doc.text(h, colX[i], y + 5.5);
    });
    y += 9;

    doc.setFont('helvetica', 'normal');
    lineItems.forEach((item, idx) => {
      if (y > 250) { doc.addPage(); y = 15; }
      doc.setFontSize(9);
      doc.text(String(idx + 1), colX[0], y + 5);
      doc.text(item.skuName, colX[1], y + 5);
      doc.text(item.skuCode, colX[2], y + 5);
      doc.text(item.quantity, colX[3], y + 5, { align: 'right' });
      doc.text(parseFloat(item.unitPrice).toFixed(2), colX[4], y + 5, { align: 'right' });
      doc.text(parseFloat(item.total).toFixed(2), colX[5], y + 5, { align: 'right' });
      y += 7;
    });

    y += 3;
    doc.line(15, y, pageW - 15, y);
    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`合计: ¥${totalAmount.toFixed(2)}`, pageW - 15, y, { align: 'right' });
    y += 8;

    const cnNum = numberToChinese(totalAmount);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`大写: ${cnNum}`, 15, y);
    y += 12;

    if (orderNotes) {
      doc.setFontSize(9);
      doc.text(`备注: ${orderNotes}`, 15, y);
      y += 8;
    }

    if (stampImage) {
      try { doc.addImage(stampImage, 'PNG', pageW - 55, y, 40, 40); } catch {}
      y += 45;
    }

    y += 5;
    doc.line(15, y, 70, y);
    doc.line(pageW - 70, y, pageW - 15, y);
    doc.setFontSize(9);
    doc.text('制单人:', 15, y + 5);
    doc.text('签收人:', pageW - 70, y + 5);

    doc.save(`${orderNum}.pdf`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Customer selection */}
      <div className="p-4 border-b border-gray-200 space-y-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 whitespace-nowrap">客户:</label>
          <div ref={customerDropdownRef} className="relative flex-1">
            <input
              type="text"
              placeholder="搜索已有客户..."
              value={selectedCustomer ? selectedCustomer.name : customerSearch}
              onChange={e => {
                setCustomerSearch(e.target.value);
                if (selectedCustomer) onCustomerChange(null);
              }}
              onFocus={() => customerSearch && setShowCustomerDropdown(true)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showCustomerDropdown && customerResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {customerResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onCustomerChange(c);
                      setCustomerSearch('');
                      setShowCustomerDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100"
                  >
                    <div className="font-medium">{c.name}</div>
                    {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setShowNewCustomerForm(true);
                    setShowCustomerDropdown(false);
                    setNewCustomer(prev => ({ ...prev, name: customerSearch }));
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-600 font-medium"
                >
                  + 新增客户 &quot;{customerSearch}&quot;
                </button>
              </div>
            )}
          </div>
          {selectedCustomer && (
            <button onClick={() => onCustomerChange(null)} className="text-xs text-red-500 hover:text-red-700">清除</button>
          )}
        </div>

        {showNewCustomerForm && (
          <div className="bg-gray-50 p-3 rounded-lg space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input type="text" placeholder="客户名称 *" value={newCustomer.name}
                onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded text-sm" />
              <input type="text" placeholder="电话" value={newCustomer.phone}
                onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="px-2 py-1 border border-gray-300 rounded text-sm" />
            </div>
            <input type="text" placeholder="地址" value={newCustomer.address}
              onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
              className="w-full px-2 py-1 border border-gray-300 rounded text-sm" />
            <div className="flex gap-2">
              <button onClick={handleCreateCustomer} className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">确认创建</button>
              <button onClick={() => setShowNewCustomerForm(false)} className="px-3 py-1 bg-gray-400 text-white text-sm rounded hover:bg-gray-500">取消</button>
            </div>
          </div>
        )}
      </div>

      {/* Line items table */}
      <div className="flex-1 overflow-y-auto p-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 bg-gray-50">
              <th className="text-left py-2 px-2 w-10">#</th>
              <th className="text-left py-2 px-2">商品名称</th>
              <th className="text-left py-2 px-2 w-24">SKU编码</th>
              <th className="text-right py-2 px-2 w-20">数量</th>
              <th className="text-right py-2 px-2 w-24">单价(¥)</th>
              <th className="text-right py-2 px-2 w-24">金额(¥)</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  从左侧SKU列表点击添加商品到订单
                </td>
              </tr>
            ) : (
              lineItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30">
                  <td className="py-1.5 px-2 text-gray-400">{idx + 1}</td>
                  <td className="py-1.5 px-2 font-medium">{item.skuName}</td>
                  <td className="py-1.5 px-2 text-gray-500 text-xs">{item.skuCode}</td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                      className="w-full text-right px-1 py-0.5 border border-gray-200 rounded text-sm" />
                  </td>
                  <td className="py-1.5 px-2">
                    <input type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={e => updateLineItem(idx, 'unitPrice', e.target.value)}
                      className="w-full text-right px-1 py-0.5 border border-gray-200 rounded text-sm" />
                  </td>
                  <td className="py-1.5 px-2 text-right font-medium">¥{parseFloat(item.total).toFixed(2)}</td>
                  <td className="py-1.5 px-2">
                    <button onClick={() => removeLineItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {lineItems.length > 0 && (
          <div className="flex justify-end mt-4 pt-3 border-t border-gray-300">
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800">合计: ¥{totalAmount.toFixed(2)}</div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 space-y-3">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">备注</label>
            <input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)}
              placeholder="订单备注..." className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">公章</label>
            <input ref={stampInputRef} type="file" accept="image/*" onChange={handleStampUpload} className="hidden" />
            <button onClick={() => stampInputRef.current?.click()}
              className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                stampImage ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}>
              {stampImage ? '✓ 已上传' : '上传公章'}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={handleSave} disabled={saving || !selectedCustomer || lineItems.length === 0}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
            {saving ? '保存中...' : '保存订单到云端'}
          </button>
          <button onClick={handlePrintPDF} disabled={lineItems.length === 0}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors">
            输出PDF打印
          </button>
        </div>
        {savedMessage && (
          <div className={`text-sm text-center py-1.5 rounded ${
            savedMessage.startsWith('✓') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
          }`}>{savedMessage}</div>
        )}
      </div>
    </div>
  );
}

function numberToChinese(num: number): string {
  if (num === 0) return '零元整';
  const digits = '零壹贰叁肆伍陆柒捌玖';
  const radices = ['', '拾', '佰', '仟'];
  const bigRadices = ['', '万', '亿'];
  const intPart = Math.floor(num);
  const decPart = Math.round((num - intPart) * 100);
  let str = '';
  if (intPart === 0) {
    str = '零';
  } else {
    const intStr = intPart.toString();
    let zeroCount = 0;
    for (let i = 0; i < intStr.length; i++) {
      const p = intStr.length - i - 1;
      const d = intStr[i];
      const quotient = Math.floor(p / 4);
      const modulus = p % 4;
      if (d === '0') { zeroCount++; }
      else {
        if (zeroCount > 0) str += digits[0];
        zeroCount = 0;
        str += digits[parseInt(d)] + radices[modulus];
      }
      if (modulus === 0 && zeroCount < 4) str += bigRadices[quotient];
    }
  }
  str += '元';
  if (decPart === 0) { str += '整'; }
  else {
    const jiao = Math.floor(decPart / 10);
    const fen = decPart % 10;
    if (jiao > 0) str += digits[jiao] + '角';
    if (fen > 0) str += digits[fen] + '分';
  }
  return str;
}
