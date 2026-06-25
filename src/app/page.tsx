'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ---- Types ----
interface Customer { id: number; name: string; phone: string; address: string; }
interface Sku { id: number; skuName: string; brand: string; costPrice: string; unit: string; }
interface LineItem { skuName: string; brand: string; unit: string; quantity: string; unitPrice: string; total: string; }

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Home() {
  // --- SKU sidebar state ---
  const [skus, setSkus] = useState<Sku[]>([]);
  const [allSkus, setAllSkus] = useState<Sku[]>([]);
  const [filterLetter, setFilterLetter] = useState('A');
  const [searchText, setSearchText] = useState('');
  const [skuLoading, setSkuLoading] = useState(false);
  const [showAddSku, setShowAddSku] = useState(false);
  const [newSkuName, setNewSkuName] = useState('');
  const [newSkuBrand, setNewSkuBrand] = useState('');
  const [newSkuCost, setNewSkuCost] = useState('');
  const [newSkuUnit, setNewSkuUnit] = useState('');
  const [skuError, setSkuError] = useState('');
  const [customerPrices, setCustomerPrices] = useState<Record<string, string>>({});

  // --- Order state ---
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [stampImage, setStampImage] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const stampRef = useRef<HTMLInputElement>(null);
  const custRef = useRef<HTMLDivElement>(null);

  // --- Load all SKUs ---
  const loadAllSkus = useCallback(async () => {
    try {
      const r = await fetch('/api/skus?limit=500');
      const d = await r.json();
      if (Array.isArray(d)) setAllSkus(d);
    } catch {}
  }, []);

  useEffect(() => { loadAllSkus(); }, [loadAllSkus]);

  // --- Load SKUs by filter ---
  useEffect(() => {
    setSkuLoading(true);
    const params = new URLSearchParams();
    if (searchText) params.set('q', searchText);
    else params.set('letter', filterLetter);
    fetch(`/api/skus?${params}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setSkus(d); })
      .catch(() => {})
      .finally(() => setSkuLoading(false));
  }, [filterLetter, searchText]);

  // --- Load customer prices ---
  useEffect(() => {
    if (!selectedCustomer || allSkus.length === 0) { setCustomerPrices({}); return; }
    const names = allSkus.map(s => encodeURIComponent(s.skuName)).join(',');
    if (!names) return;
    fetch(`/api/prices?customerId=${selectedCustomer.id}`)
      .then(r => r.json())
      .then(d => { if (d.prices) setCustomerPrices(d.prices); })
      .catch(() => {});
  }, [selectedCustomer, allSkus]);

  // --- Customer autocomplete ---
  useEffect(() => {
    if (!customerName.trim() || (selectedCustomer && selectedCustomer.name === customerName)) {
      setSuggestions([]); setShowSuggestions(false); return;
    }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/customers?q=${encodeURIComponent(customerName)}`);
        const d = await r.json();
        if (Array.isArray(d) && d.length > 0) { setSuggestions(d); setShowSuggestions(true); }
      } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [customerName, selectedCustomer]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (custRef.current && !custRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  // --- Select customer from suggestion ---
  const selectCust = (c: Customer) => {
    setCustomerName(c.name); setCustomerPhone(c.phone || ''); setCustomerAddress(c.address || '');
    setSelectedCustomer(c); setShowSuggestions(false);
  };

  // --- Add SKU ---
  const handleAddSku = async () => {
    const name = newSkuName.trim();
    if (!name) { setSkuError('请输入SKU名称'); return; }
    setSkuError('');
    try {
      const r = await fetch('/api/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuName: name, brand: newSkuBrand, costPrice: newSkuCost || '0', unit: newSkuUnit }),
      });
      const d = await r.json();
      if (r.ok) {
        setNewSkuName(''); setNewSkuBrand(''); setNewSkuCost(''); setNewSkuUnit('');
        setShowAddSku(false);
        setSearchText(name); setFilterLetter('');
        loadAllSkus();
      } else {
        setSkuError(d.error || '保存失败');
      }
    } catch { setSkuError('网络错误'); }
  };

  // --- Add item to order ---
  const addToOrder = (sku: Sku) => {
    const price = customerPrices[sku.skuName] || sku.costPrice;
    const item: LineItem = {
      skuName: sku.skuName,
      brand: sku.brand,
      unit: sku.unit,
      quantity: '1',
      unitPrice: parseFloat(price).toFixed(2),
      total: parseFloat(price).toFixed(2),
    };
    setLineItems(prev => [...prev, item]);
  };

  // --- Update line item ---
  const updateItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(prev => {
      const u = [...prev]; u[idx] = { ...u[idx], [field]: val };
      if (field === 'quantity' || field === 'unitPrice') {
        u[idx].total = ((parseFloat(u[idx].quantity) || 0) * (parseFloat(u[idx].unitPrice) || 0)).toFixed(2);
      }
      return u;
    });
  };

  const removeItem = (idx: number) => setLineItems(prev => prev.filter((_, i) => i !== idx));

  // --- New order ---
  const newOrder = () => {
    setLineItems([]);
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderNotes('');
    setStampImage('');
    setSavedMsg('');
  };

  // --- Stamp upload ---
  const handleStamp = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => setStampImage(r.result as string); r.readAsDataURL(f);
  };

  // --- Save order ---
  const handleSave = async () => {
    const name = customerName.trim();
    if (!name || lineItems.length === 0) return;
    setSaving(true); setSavedMsg('');
    try {
      let cid = selectedCustomer?.id;
      if (!cid) {
        const cr = await fetch(`/api/customers?q=${encodeURIComponent(name)}`);
        const cd = await cr.json();
        const ex = Array.isArray(cd) ? cd.find((c: Customer) => c.name === name) : null;
        if (ex) { cid = ex.id; setSelectedCustomer(ex); }
        else {
          const nr = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone: customerPhone, address: customerAddress }) });
          const nc = await nr.json();
          if (!nr.ok) throw new Error(nc.error || '创建客户失败');
          cid = nc.id; setSelectedCustomer(nc);
        }
      }
      const or = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: cid, items: lineItems, notes: orderNotes, stampImage, orderNumber: `ORD-${Date.now()}` }),
      });
      const od = await or.json();
      if (!or.ok) throw new Error(od.error || '保存失败');
      setSavedMsg(`✓ 订单已保存`);
      setTimeout(() => setSavedMsg(''), 3000);
      newOrder();
    } catch (e: any) { setSavedMsg(`✗ ${e.message}`); setTimeout(() => setSavedMsg(''), 4000); }
    setSaving(false);
  };

  // --- Print PDF ---
  const handlePrint = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('p', 'mm', 'a4');
    const W = 210; let y = 15;
    doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('销 售 单', W/2, y, { align: 'center' }); y += 10;
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`日期: ${new Date().toLocaleDateString('zh-CN')}`, W - 15, y, { align: 'right' }); y += 7;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.text(`客户: ${customerName}`, 15, y); y += 6;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`电话: ${customerPhone || '--'}`, 15, y); doc.text(`地址: ${customerAddress || '--'}`, W - 15, y, { align: 'right' }); y += 10;

    const cx = [15, 22, 65, 105, 127, 152, 177];
    const cw = [7, 43, 40, 22, 25, 25, 25];
    const heads = ['#', '产品', '品牌', '单位', '数量', '单价', '金额'];
    doc.setFillColor(240, 240, 240); doc.rect(15, y, W-30, 8, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    heads.forEach((h, i) => doc.text(h, cx[i], y + 5.5));
    y += 9;
    doc.setFont('helvetica', 'normal');
    let total = 0;
    lineItems.forEach((item, i) => {
      if (y > 260) { doc.addPage(); y = 15; }
      doc.setFontSize(8);
      doc.text(String(i+1), cx[0], y+5);
      doc.text(item.skuName, cx[1], y+5);
      doc.text(item.brand, cx[2], y+5);
      doc.text(item.unit, cx[3], y+5);
      doc.text(item.quantity, cx[4], y+5, { align: 'right' });
      doc.text(parseFloat(item.unitPrice).toFixed(2), cx[5], y+5, { align: 'right' });
      doc.text(parseFloat(item.total).toFixed(2), cx[6], y+5, { align: 'right' });
      total += parseFloat(item.total); y += 7;
    });
    y += 3; doc.line(15, y, W-15, y); y += 5;
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`合计: ¥${total.toFixed(2)}`, W-15, y, { align: 'right' }); y += 8;
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`大写: ${numCN(total)}`, 15, y); y += 12;
    if (orderNotes) { doc.text(`备注: ${orderNotes}`, 15, y); y += 8; }
    if (stampImage) { try { doc.addImage(stampImage, 'PNG', W-55, y, 40, 40); } catch {} }
    doc.save(`ORD-${Date.now()}.pdf`);
  };

  const totalAmount = lineItems.reduce((s, i) => s + parseFloat(i.total || '0'), 0);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* ======== LEFT: SKU SIDEBAR ======== */}
      <div className="w-[320px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-3 bg-blue-600 text-white text-sm font-bold">SKU 产品列表</div>

        <div className="p-2 border-b">
          <input type="text" placeholder="搜索产品..." value={searchText}
            onChange={e => { setSearchText(e.target.value); setFilterLetter(''); }}
            className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="px-2 py-2 border-b">
          <button onClick={() => setShowAddSku(!showAddSku)}
            className="w-full py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
            + 新增产品
          </button>
        </div>

        {showAddSku && (
          <div className="p-3 border-b bg-gray-50 space-y-2">
            <input type="text" placeholder="产品名称 *" value={newSkuName}
              onChange={e => setNewSkuName(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm" />
            <input type="text" placeholder="品牌" value={newSkuBrand}
              onChange={e => setNewSkuBrand(e.target.value)}
              className="w-full px-2 py-1.5 border rounded text-sm" />
            <div className="flex gap-2">
              <input type="number" step="0.01" placeholder="成本价" value={newSkuCost}
                onChange={e => setNewSkuCost(e.target.value)}
                className="flex-1 px-2 py-1.5 border rounded text-sm" />
              <input type="text" placeholder="单位" value={newSkuUnit}
                onChange={e => setNewSkuUnit(e.target.value)}
                className="w-24 px-2 py-1.5 border rounded text-sm" />
            </div>
            {skuError && <div className="text-xs text-red-600">{skuError}</div>}
            <div className="flex gap-2">
              <button onClick={handleAddSku} className="flex-1 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700">保存</button>
              <button onClick={() => { setShowAddSku(false); setSkuError(''); }}
                className="flex-1 py-1.5 bg-gray-400 text-white text-sm rounded hover:bg-gray-500">取消</button>
            </div>
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {skuLoading ? <div className="p-4 text-center text-gray-400 text-sm">加载中...</div>
            : skus.length === 0 ? <div className="p-4 text-center text-gray-400 text-sm">暂无产品</div>
            : skus.map(s => (
              <button key={s.id} onClick={() => addToOrder(s)}
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium text-gray-800">{s.skuName}</div>
                    {s.brand && <div className="text-xs text-gray-400">{s.brand}</div>}
                  </div>
                  <div className="text-right">
                    {customerPrices[s.skuName]
                      ? <div className="text-sm font-semibold text-blue-600">¥{parseFloat(customerPrices[s.skuName]).toFixed(2)}</div>
                      : <div className="text-xs text-gray-400">成本 ¥{parseFloat(s.costPrice).toFixed(2)}</div>}
                    {s.unit && <div className="text-xs text-gray-400">{s.unit}</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
          {/* Alphabet */}
          <div className="w-8 flex flex-col justify-center items-center border-l bg-gray-50 py-2">
            {ALPHABET.map(l => (
              <button key={l} onClick={() => { setSearchText(''); setFilterLetter(l); }}
                className={`w-full text-center text-xs py-0.5 hover:text-blue-600 hover:font-bold ${filterLetter === l && !searchText ? 'text-blue-600 font-bold' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ======== RIGHT: ORDER FORM ======== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-3 bg-white border-b flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">开单</h2>
          <button onClick={newOrder}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">
            + 新建订单
          </button>
        </div>

        {/* Customer */}
        <div className="p-4 border-b bg-white space-y-3">
          <div ref={custRef} className="relative">
            <label className="text-xs text-gray-500 mb-1 block">客户名称</label>
            <input type="text" placeholder="输入客户名称..." value={customerName}
              onChange={e => { setCustomerName(e.target.value); if (selectedCustomer && selectedCustomer.name !== e.target.value) setSelectedCustomer(null); }}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map(c => (
                  <button key={c.id} onClick={() => selectCust(c)}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b">{c.name} {c.phone && <span className="text-xs text-gray-400 ml-2">{c.phone}</span>}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">电话</label>
              <input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">地址</label>
              <input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          </div>
        </div>

        {/* Order Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-50">
                <th className="text-left py-2 px-1 w-8">#</th>
                <th className="text-left py-2 px-1">产品</th>
                <th className="text-left py-2 px-1 w-20">品牌</th>
                <th className="text-left py-2 px-1 w-16">单位</th>
                <th className="text-right py-2 px-1 w-18">数量</th>
                <th className="text-right py-2 px-1 w-20">单价</th>
                <th className="text-right py-2 px-1 w-20">总价</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-400">从左侧产品列表点击添加</td></tr>
              ) : lineItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-100 hover:bg-blue-50/30">
                  <td className="py-1 px-1 text-gray-400 text-center">{idx + 1}</td>
                  <td className="py-1 px-1 font-medium">{item.skuName}</td>
                  <td className="py-1 px-1 text-gray-500 text-xs">{item.brand}</td>
                  <td className="py-1 px-1 text-gray-500 text-xs text-center">{item.unit}</td>
                  <td className="py-1 px-1">
                    <input type="number" min="0.01" step="0.01" value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="w-full text-right px-1 py-0.5 border border-gray-200 rounded text-sm" />
                  </td>
                  <td className="py-1 px-1">
                    <input type="number" min="0" step="0.01" value={item.unitPrice}
                      onChange={e => updateItem(idx, 'unitPrice', e.target.value)}
                      className="w-full text-right px-1 py-0.5 border border-gray-200 rounded text-sm" />
                  </td>
                  <td className="py-1 px-1 text-right font-medium">¥{parseFloat(item.total).toFixed(2)}</td>
                  <td className="py-1 px-1 text-center">
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lineItems.length > 0 && (
            <div className="flex justify-end mt-3 pt-3 border-t border-gray-300">
              <span className="text-lg font-bold">合计: ¥{totalAmount.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white space-y-3">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">备注</label>
              <input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="订单备注..."
                className="w-full px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">公章</label>
              <input ref={stampRef} type="file" accept="image/*" onChange={handleStamp} className="hidden" />
              <button onClick={() => stampRef.current?.click()}
                className={`px-3 py-1.5 text-sm rounded-lg border ${stampImage ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                {stampImage ? '✓ 已上传' : '上传公章'}
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || lineItems.length === 0 || !customerName.trim()}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              {saving ? '保存中...' : '保存订单'}
            </button>
            <button onClick={handlePrint} disabled={lineItems.length === 0}
              className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">
              打印PDF
            </button>
          </div>
          {savedMsg && (
            <div className={`text-sm text-center py-1.5 rounded font-medium ${savedMsg.startsWith('✓') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>{savedMsg}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function numCN(n: number): string {
  if (n === 0) return '零元整';
  const d = '零壹贰叁肆伍陆柒捌玖', r = ['','拾','佰','仟'], b = ['','万','亿'];
  const ip = Math.floor(n), dp = Math.round((n - ip) * 100);
  let s = ''; const is = ip.toString();
  let z = 0;
  for (let i = 0; i < is.length; i++) {
    const p = is.length - i - 1, q = Math.floor(p/4), m = p%4;
    if (is[i] === '0') z++;
    else { if (z>0) s += d[0]; z=0; s += d[+is[i]] + r[m]; }
    if (m === 0 && z < 4) s += b[q];
  }
  s += '元';
  if (dp === 0) s += '整';
  else { const j = Math.floor(dp/10), f = dp%10; if (j>0) s += d[j]+'角'; if (f>0) s += d[f]+'分'; }
  return s;
}
