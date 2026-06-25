'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface Customer { id: number; name: string; phone: string; address: string; }
interface Sku { id: number; skuName: string; brand: string; costPrice: string; unit: string; deleted: boolean; }
interface LineItem { skuName: string; brand: string; unit: string; quantity: string; unitPrice: string; total: string; }

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

export default function Home() {
  // SKU state
  const [skus, setSkus] = useState<Sku[]>([]);
  const [allSkus, setAllSkus] = useState<Sku[]>([]);
  const [filterLetter, setFilterLetter] = useState('A');
  const [searchText, setSearchText] = useState('');
  const [skuLoading, setSkuLoading] = useState(false);
  const [showAddSku, setShowAddSku] = useState(false);
  const [nsName, setNsName] = useState(''); const [nsBrand, setNsBrand] = useState('');
  const [nsCost, setNsCost] = useState(''); const [nsUnit, setNsUnit] = useState('');
  const [skuError, setSkuError] = useState('');
  const [customerPrices, setCustomerPrices] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecycleBin, setShowRecycleBin] = useState(false);
  const [recycleSkus, setRecycleSkus] = useState<Sku[]>([]);

  // Order state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [stampImage, setStampImage] = useState('');
  const [stampPos, setStampPos] = useState({ x: 0, y: 0 }); const [draggingStamp, setDraggingStamp] = useState(false);
  const [saving, setSaving] = useState(false); const [savedMsg, setSavedMsg] = useState('');
  const [printing, setPrinting] = useState(false);
  const stampRef = useRef<HTMLInputElement>(null);
  const custRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const loadAllSkus = useCallback(async () => {
    try { const r = await fetch('/api/skus?limit=500'); const d = await r.json(); if (Array.isArray(d)) setAllSkus(d); } catch {}
  }, []);
  useEffect(() => { loadAllSkus(); }, [loadAllSkus]);

  const loadRecycleBin = useCallback(async () => {
    try { const r = await fetch('/api/skus?deleted=1&limit=500'); const d = await r.json(); if (Array.isArray(d)) setRecycleSkus(d); } catch {}
  }, []);

  useEffect(() => {
    if (showRecycleBin) { loadRecycleBin(); return; }
    setSkuLoading(true);
    const p = new URLSearchParams();
    if (searchText) p.set('q', searchText); else p.set('letter', filterLetter);
    fetch('/api/skus?' + p).then(r => r.json()).then(d => { if (Array.isArray(d)) setSkus(d); }).catch(() => {}).finally(() => setSkuLoading(false));
  }, [filterLetter, searchText, showRecycleBin, loadRecycleBin]);

  useEffect(() => {
    if (!selectedCustomer || allSkus.length === 0) { setCustomerPrices({}); return; }
    fetch('/api/prices?customerId=' + selectedCustomer.id).then(r => r.json()).then(d => { if (d.prices) setCustomerPrices(d.prices); }).catch(() => {});
  }, [selectedCustomer, allSkus]);

  useEffect(() => {
    if (!customerName.trim() || (selectedCustomer && selectedCustomer.name === customerName)) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try { const r = await fetch('/api/customers?q=' + encodeURIComponent(customerName)); const d = await r.json(); if (Array.isArray(d) && d.length > 0) { setSuggestions(d); setShowSuggestions(true); } } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [customerName, selectedCustomer]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (custRef.current && !custRef.current.contains(e.target as Node)) setShowSuggestions(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectCust = (c: Customer) => { setCustomerName(c.name); setCustomerPhone(c.phone || ''); setCustomerAddress(c.address || ''); setSelectedCustomer(c); setShowSuggestions(false); };

  const handleAddSku = async () => {
    const name = nsName.trim(); if (!name) { setSkuError('请输入产品名称'); return; }
    setSkuError('');
    try {
      const r = await fetch('/api/skus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ skuName: name, brand: nsBrand, costPrice: nsCost || '0', unit: nsUnit }) });
      const d = await r.json();
      if (r.ok) { setNsName(''); setNsBrand(''); setNsCost(''); setNsUnit(''); setShowAddSku(false); setSearchText(name); setFilterLetter(''); loadAllSkus(); }
      else setSkuError(d.error || '保存失败');
    } catch { setSkuError('网络错误'); }
  };

  const toggleSelect = (id: number) => { setSelectedIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const selectAll = () => { if (selectedIds.size === skus.length) setSelectedIds(new Set()); else setSelectedIds(new Set(skus.map(s => s.id))); };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const isPerm = showRecycleBin;
    await fetch('/api/skus?ids=' + [...selectedIds].join(',') + (isPerm ? '&permanent=1' : ''), { method: 'DELETE' });
    setSelectedIds(new Set()); setShowDeleteConfirm(false); loadAllSkus(); if (showRecycleBin) loadRecycleBin();
  };

  const handleRestore = async () => {
    if (selectedIds.size === 0) return;
    await fetch('/api/skus?ids=' + [...selectedIds].join(',') + '&restore=1', { method: 'DELETE' });
    setSelectedIds(new Set()); loadRecycleBin(); loadAllSkus();
  };

  const addToOrder = (sku: Sku) => {
    const price = customerPrices[sku.skuName] || sku.costPrice;
    setLineItems(p => [...p, { skuName: sku.skuName, brand: sku.brand, unit: sku.unit, quantity: '1', unitPrice: parseFloat(price).toFixed(2), total: parseFloat(price).toFixed(2) }]);
  };

  const updateItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: val }; if (field === 'quantity' || field === 'unitPrice') u[idx].total = ((parseFloat(u[idx].quantity) || 0) * (parseFloat(u[idx].unitPrice) || 0)).toFixed(2); return u; });
  };
  const removeItem = (idx: number) => setLineItems(p => p.filter((_, i) => i !== idx));

  const newOrder = () => { setLineItems([]); setSelectedCustomer(null); setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setOrderNotes(''); setStampImage(''); setStampPos({ x: 0, y: 0 }); setSavedMsg(''); };

  const handleStamp = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setStampImage(r.result as string); r.readAsDataURL(f); };

  const handleSave = async () => {
    const name = customerName.trim(); if (!name || lineItems.length === 0) return;
    setSaving(true); setSavedMsg('');
    try {
      let cid = selectedCustomer?.id;
      if (!cid) {
        const cr = await fetch('/api/customers?q=' + encodeURIComponent(name)); const cd = await cr.json();
        const ex = Array.isArray(cd) ? cd.find((c: Customer) => c.name === name) : null;
        if (ex) { cid = ex.id; setSelectedCustomer(ex); }
        else { const nr = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone: customerPhone, address: customerAddress }) }); const nc = await nr.json(); if (!nr.ok) throw new Error(nc.error || '创建客户失败'); cid = nc.id; setSelectedCustomer(nc); }
      }
      const or = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerId: cid, items: lineItems, notes: orderNotes, stampImage, orderNumber: 'ORD-' + Date.now() }) });
      const od = await or.json(); if (!or.ok) throw new Error(od.error || '保存失败');
      setSavedMsg('订单已保存'); setTimeout(() => setSavedMsg(''), 3000); newOrder();
    } catch (e: any) { setSavedMsg(e.message); setTimeout(() => setSavedMsg(''), 4000); }
    setSaving(false);
  };

  // PDF with Chinese support via html2canvas
  const handlePrint = async () => {
    setPrinting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = previewRef.current; if (!el) { setPrinting(false); return; }
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF('p', 'mm', 'a4');
      const pw = 210, ph = 297, m = 8, iw = pw - m * 2, ih = (canvas.height * iw) / canvas.width;
      let y = m, rh = ih, sy = 0;
      while (rh > 0) {
        const sh = Math.min(rh, ph - m * 2);
        const srcH = Math.round((sh / ih) * canvas.height);
        const sc = document.createElement('canvas'); sc.width = canvas.width; sc.height = srcH;
        sc.getContext('2d')!.drawImage(canvas, 0, sy, canvas.width, srcH, 0, 0, canvas.width, srcH);
        doc.addImage(sc.toDataURL('image/png'), 'PNG', m, y, iw, sh);
        rh -= sh; sy += srcH; if (rh > 0) { doc.addPage(); y = m; }
      }
      doc.save('ORD-' + Date.now() + '.pdf');
    } catch (e) { console.error(e); }
    setPrinting(false);
  };

    const stampDragStart = (e: React.MouseEvent) => { e.preventDefault(); setDraggingStamp(true); };
  const stampDragMove = (e: React.MouseEvent) => { if (!draggingStamp) return; setStampPos(p => ({ x: p.x + e.movementX, y: p.y + e.movementY })); };
  const stampDragEnd = () => { setDraggingStamp(false); };

  const totalAmount = lineItems.reduce((s, i) => s + parseFloat(i.total || '0'), 0);

  return (
    <div className="flex h-screen bg-gray-100">
      {/* LEFT: SKU Panel */}
      <div className="w-[280px] bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-2.5 bg-blue-600 text-white text-sm font-bold flex justify-between items-center">
          <span>SKU 产品列表</span>
          <button onClick={() => { setShowRecycleBin(!showRecycleBin); setSelectedIds(new Set()); }} className="text-xs bg-white/20 px-2 py-0.5 rounded hover:bg-white/30">{showRecycleBin ? '列表' : '回收站'}</button>
        </div>
        {!showRecycleBin && (<>
          <div className="p-2 border-b"><input type="text" placeholder="搜索产品..." value={searchText} onChange={e => { setSearchText(e.target.value); setFilterLetter(''); }} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
          <div className="px-2 py-1.5 border-b flex gap-1">
            <button onClick={() => setShowAddSku(!showAddSku)} className="flex-1 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">+ 新增</button>
            <button onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)} disabled={selectedIds.size === 0} className="py-1.5 px-2 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:bg-gray-300 disabled:cursor-not-allowed">删除({selectedIds.size})</button>
          </div>
          {showAddSku && (
            <div className="p-2 border-b bg-gray-50 space-y-1.5">
              <input type="text" placeholder="产品名称 *" value={nsName} onChange={e => setNsName(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
              <input type="text" placeholder="品牌" value={nsBrand} onChange={e => setNsBrand(e.target.value)} className="w-full px-2 py-1 border rounded text-xs" />
              <div className="flex gap-1"><input type="number" step="0.01" placeholder="成本价" value={nsCost} onChange={e => setNsCost(e.target.value)} className="flex-1 px-2 py-1 border rounded text-xs" /><input type="text" placeholder="单位" value={nsUnit} onChange={e => setNsUnit(e.target.value)} className="w-16 px-2 py-1 border rounded text-xs" /></div>
              {skuError && <div className="text-xs text-red-600">{skuError}</div>}
              <div className="flex gap-1"><button onClick={handleAddSku} className="flex-1 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">保存</button><button onClick={() => { setShowAddSku(false); setSkuError(''); }} className="flex-1 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500">取消</button></div>
            </div>
          )}
        </>)}
        {showDeleteConfirm && (
          <div className="p-2 border-b bg-red-50">
            <div className="text-xs text-red-700 mb-1.5 font-medium">{showRecycleBin ? '永久删除？不可恢复！' : '移入回收站？'}</div>
            <div className="flex gap-1"><button onClick={handleDelete} className="flex-1 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">确认</button><button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500">取消</button></div>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {skuLoading ? <div className="p-3 text-center text-gray-400 text-xs">加载中...</div>
            : showRecycleBin ? (
              recycleSkus.length === 0 ? <div className="p-3 text-center text-gray-400 text-xs">回收站为空</div>
              : <><div className="px-2 py-1 border-b bg-gray-50 flex gap-1"><button onClick={handleRestore} disabled={selectedIds.size === 0} className="flex-1 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300">恢复({selectedIds.size})</button><button onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)} disabled={selectedIds.size === 0} className="flex-1 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:bg-gray-300">永久删除</button></div>
                {recycleSkus.map(s => (<div key={s.id} className="flex items-center px-2 py-1.5 border-b hover:bg-gray-50"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="mr-2" /><div className="flex-1"><div className="text-xs text-gray-500 truncate">{s.skuName}</div></div></div>))}</>
            ) : skus.length === 0 ? <div className="p-3 text-center text-gray-400 text-xs">暂无产品</div>
            : skus.map(s => (
              <div key={s.id} className="flex items-center hover:bg-blue-50 border-b group">
                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="ml-2 shrink-0" />
                <button onClick={() => addToOrder(s)} className="flex-1 text-left px-2 py-2 min-w-0">
                  <div className="flex justify-between items-start"><div className="min-w-0"><div className="text-xs font-medium truncate">{s.skuName}</div>{s.brand && <div className="text-xs text-gray-400">{s.brand}</div>}</div><div className="text-right shrink-0 ml-2">{customerPrices[s.skuName] ? <div className="text-xs font-semibold text-blue-600">¥{parseFloat(customerPrices[s.skuName]).toFixed(2)}</div> : <div className="text-xs text-gray-400">¥{parseFloat(s.costPrice).toFixed(2)}</div>}{s.unit && <div className="text-xs text-gray-400">{s.unit}</div>}</div></div>
                </button>
              </div>
            ))}
          </div>
          {!showRecycleBin && (
            <div className="w-7 flex flex-col justify-center items-center border-l bg-gray-50 py-1">
              {ALPHABET.map(l => (<button key={l} onClick={() => { setSearchText(''); setFilterLetter(l); }} className={"w-full text-center text-xs py-0.5 hover:text-blue-600 " + (filterLetter === l && !searchText ? 'text-blue-600 font-bold' : 'text-gray-500')}>{l}</button>))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Order Form */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="p-2.5 bg-white border-b flex items-center justify-between"><h2 className="text-base font-bold">开单</h2><button onClick={newOrder} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">+ 新建订单</button></div>
        <div className="p-3 border-b bg-white space-y-2">
          <div ref={custRef} className="relative"><label className="text-xs text-gray-500 mb-0.5 block">客户名称</label><input type="text" placeholder="输入客户名称..." value={customerName} onChange={e => { setCustomerName(e.target.value); if (selectedCustomer && selectedCustomer.name !== e.target.value) setSelectedCustomer(null); }} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            {showSuggestions && suggestions.length > 0 && (<div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-36 overflow-y-auto">{suggestions.map(c => (<button key={c.id} onClick={() => selectCust(c)} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs border-b">{c.name}{c.phone && <span className="text-gray-400 ml-1">{c.phone}</span>}</button>))}</div>)}
          </div>
          <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-500 mb-0.5 block">电话</label><input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div><div><label className="text-xs text-gray-500 mb-0.5 block">地址</label><input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <table className="w-full text-xs"><thead><tr className="border-b-2 border-gray-300 bg-gray-50"><th className="text-left py-1.5 px-1 w-6">#</th><th className="text-left py-1.5 px-1">产品</th><th className="text-left py-1.5 px-1 w-16">品牌</th><th className="text-center py-1.5 px-1 w-12">单位</th><th className="text-right py-1.5 px-1 w-16">数量</th><th className="text-right py-1.5 px-1 w-18">单价</th><th className="text-right py-1.5 px-1 w-18">总价</th><th className="w-6"></th></tr></thead>
            <tbody>{lineItems.length === 0 ? <tr><td colSpan={8} className="text-center py-10 text-gray-400">从左侧产品列表点击添加</td></tr>
            : lineItems.map((item, idx) => (<tr key={idx} className="border-b hover:bg-blue-50/30"><td className="py-1 px-1 text-gray-400 text-center">{idx + 1}</td><td className="py-1 px-1 font-medium">{item.skuName}</td><td className="py-1 px-1 text-gray-500">{item.brand}</td><td className="py-1 px-1 text-gray-500 text-center">{item.unit}</td><td className="py-1 px-1"><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full text-right px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="w-full text-right px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 text-right font-medium">¥{parseFloat(item.total).toFixed(2)}</td><td className="py-1 px-1 text-center"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">X</button></td></tr>))}</tbody></table>
          {lineItems.length > 0 && <div className="flex justify-end mt-2 pt-2 border-t border-gray-300"><span className="text-base font-bold">合计: ¥{totalAmount.toFixed(2)}</span></div>}
        </div>
        <div className="p-3 border-t bg-white space-y-2">
          <div className="flex gap-2 items-end"><div className="flex-1"><label className="text-xs text-gray-500 mb-0.5 block">备注</label><input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="订单备注..." className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div><div><label className="text-xs text-gray-500 mb-0.5 block">公章</label><input ref={stampRef} type="file" accept="image/*" onChange={handleStamp} className="hidden" /><button onClick={() => stampRef.current?.click()} className={'px-2 py-1.5 text-xs rounded border ' + (stampImage ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>{stampImage ? '已上传' : '上传公章'}</button></div></div>
          <div className="flex gap-2"><button onClick={handleSave} disabled={saving || lineItems.length === 0 || !customerName.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{saving ? '保存中...' : '保存订单'}</button><button onClick={handlePrint} disabled={printing || lineItems.length === 0} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{printing ? '生成中...' : '打印PDF'}</button></div>
          {savedMsg && <div className={'text-xs text-center py-1 rounded font-medium ' + (savedMsg.startsWith('订单已保存') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>✓ {savedMsg}</div>}
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 bg-gray-50 border-l border-gray-200 flex flex-col min-w-0">
        <div className="p-2.5 bg-white border-b text-sm font-bold text-gray-700">打印预览</div>
        <div className="flex-1 overflow-y-auto p-3">
          <div ref={previewRef} className="bg-white p-4 shadow-md" style={{ fontFamily: 'sans-serif', fontSize: '10px' }}>
            <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>销 售 单</div>
            <div style={{ fontSize: '11px', marginBottom: '8px' }}><div>日期: {new Date().toLocaleDateString('zh-CN')}</div></div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>客户: {customerName || '--'}</div>
            <div style={{ fontSize: '10px', marginBottom: '12px', color: '#555' }}><div>电话: {customerPhone || '--'}</div><div>地址: {customerAddress || '--'}</div></div>
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead><tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc' }}><th style={{ padding: '3px 2px', textAlign: 'left' }}>#</th><th style={{ padding: '3px 2px', textAlign: 'left' }}>产品</th><th style={{ padding: '3px 2px', textAlign: 'left' }}>品牌</th><th style={{ padding: '3px 2px' }}>单位</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>数量</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>单价</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>金额</th></tr></thead>
              <tbody>{lineItems.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无商品</td></tr>
              : lineItems.map((item, idx) => (<tr key={idx} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '2px' }}>{idx + 1}</td><td style={{ padding: '2px' }}>{item.skuName}</td><td style={{ padding: '2px' }}>{item.brand}</td><td style={{ padding: '2px', textAlign: 'center' }}>{item.unit}</td><td style={{ padding: '2px', textAlign: 'right' }}>{item.quantity}</td><td style={{ padding: '2px', textAlign: 'right' }}>¥{parseFloat(item.unitPrice).toFixed(2)}</td><td style={{ padding: '2px', textAlign: 'right', fontWeight: 'bold' }}>¥{parseFloat(item.total).toFixed(2)}</td></tr>))}</tbody>
            </table>
            {lineItems.length > 0 && (<><div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>合计: ¥{totalAmount.toFixed(2)}</div><div style={{ fontSize: '10px', marginBottom: '8px', color: '#555' }}>大写: {numCN(totalAmount)}</div></>)}
            {orderNotes && <div style={{ fontSize: '10px', marginBottom: '8px', color: '#555' }}>备注: {orderNotes}</div>}
            {stampImage && <div style={{ position: 'relative', marginTop: '10px', minHeight: '100px' }}>
                <img src={stampImage} alt="公章" draggable={false}
                  onMouseDown={stampDragStart} onMouseMove={stampDragMove} onMouseUp={stampDragEnd} onMouseLeave={stampDragEnd}
                  style={{ position: 'absolute', right: (80 + stampPos.x) + 'px', top: stampPos.y + 'px', width: '80px', height: '80px', opacity: 0.8, cursor: draggingStamp ? 'grabbing' : 'grab', userSelect: 'none' }} />
                <div style={{ fontSize: '9px', color: '#999', marginTop: '5px' }}>拖拽公章可调整位置</div>
              </div>}
            <div style={{ marginTop: '15px', fontSize: '10px' }}><div style={{ display: 'inline-block', width: '45%', borderTop: '1px solid #999', paddingTop: '2px' }}>制单人:</div><div style={{ display: 'inline-block', width: '45%', borderTop: '1px solid #999', paddingTop: '2px', marginLeft: '10%' }}>签收人:</div></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function numCN(n: number): string {
  if (n === 0) return '零元整';
  const d = '零壹贰叁肆伍陆柒捌玖', r = ['','拾','佰','仟'], b = ['','万','亿'];
  const ip = Math.floor(n), dp = Math.round((n - ip) * 100);
  let s = ''; const is = ip.toString(); let z = 0;
  for (let i = 0; i < is.length; i++) { const p = is.length - i - 1, q = Math.floor(p/4), m = p%4; if (is[i] === '0') z++; else { if (z>0) s += d[0]; z=0; s += d[+is[i]] + r[m]; } if (m === 0 && z < 4) s += b[q]; }
  s += '元';
  if (dp === 0) s += '整';
  else { const j = Math.floor(dp/10), f = dp%10; if (j>0) s += d[j]+'角'; if (f>0) s += d[f]+'分'; }
  return s;
}
