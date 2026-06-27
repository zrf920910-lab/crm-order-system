'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import pinyin from 'tiny-pinyin';

interface Customer { id: number; name: string; phone: string; address: string; }
interface Sku { id: number; skuName: string; brand: string; costPrice: string; unit: string; deleted: boolean; params: string; }
interface LineItem { skuName: string; brand: string; unit: string; quantity: string; unitPrice: string; total: string; notes: string; }


function getPinyinInitial(name: string): string {
  if (!name) return '#';
  const ch = name.charAt(0);
  // If starts with A-Z or a-z, return uppercase
  if (/^[A-Za-z]/.test(ch)) return ch.toUpperCase();
  // If starts with digit, return the digit itself
  if (/^[0-9]/.test(ch)) return ch;
  // Try pinyin conversion for Chinese
  try {
    const py = pinyin.convertToPinyin(ch, '', true);
    if (py && py.length > 0 && /^[A-Za-z]/.test(py)) return py.charAt(0).toUpperCase();
  } catch {}
  return '#';
}

const ALPHABET = '#ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUMBERS = '0-9';

function sortByPinyin(skus: Sku[]): Sku[] {
  return [...skus].sort((a, b) => {
    const ia = getPinyinInitial(a.skuName);
    const ib = getPinyinInitial(b.skuName);
    if (ia === ib) return a.skuName.localeCompare(b.skuName, 'zh-CN');
    if (/^[0-9]$/.test(ia) && /^[A-Z]$/.test(ib)) return 1;
    if (/^[A-Z]$/.test(ia) && /^[0-9]$/.test(ib)) return -1;
    if (/^[0-9]$/.test(ia) && /^[0-9]$/.test(ib)) return ia.localeCompare(ib);
    if (ia === '#') return 1;
    if (ib === '#') return -1;
    return ia.localeCompare(ib);
  });
}


export default function Home() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);

  // Auth helper
  const token = useCallback(() => localStorage.getItem('token') || '', []);
  const headers = useCallback(() => ({ 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() }), [token]);

  // Auth check on mount
  useEffect(() => {
    const t = token();
    if (!t) { router.push('/login'); return; }
    fetch('/api/auth', { headers: { 'Authorization': 'Bearer ' + t } })
      .then(r => r.json())
      .then(d => { if (d.valid) { setAuthReady(true); } else { localStorage.removeItem('token'); router.push('/login'); } })
      .catch(() => { router.push('/login'); });
  }, [router]);

  // SKU state
  const [skus, setSkus] = useState<Sku[]>([]);
  const [allSkus, setAllSkus] = useState<Sku[]>([]);
  const [filterLetter, setFilterLetter] = useState('');
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
  const [editingSku, setEditingSku] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCost, setEditCost] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editParams, setEditParams] = useState('');
  const [recycleSkus, setRecycleSkus] = useState<Sku[]>([]);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importResult, setImportResult] = useState("");

  // Order state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const loadRecycleCusts = async () => { try { const r = await fetch('/api/customers?limit=200&deleted=1', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setRecycleCusts(d); } catch {} };
  const loadCustList = async () => {
    try { const r = await fetch('/api/customers?limit=200', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setCustList(d); } catch {}
  };
  const openCustMgmt = () => { setShowCustMgmt(true); loadCustList(); setEditCust(null); setNewCustName(''); setNewCustPhone(''); setNewCustAddr(''); setCustSaveMsg(''); };
  const addCustomer = async () => {
    if (!newCustName.trim()) { setCustSaveMsg('请输入客户名称'); return; }
    try {
      const r = await fetch('/api/customers', { method: 'POST', headers: headers(), body: JSON.stringify({ name: newCustName.trim(), phone: newCustPhone, address: newCustAddr }) });
      if (r.ok) { setNewCustName(''); setNewCustPhone(''); setNewCustAddr(''); setCustSaveMsg('添加成功'); loadCustList(); loadAllCustomers(); setTimeout(() => setCustSaveMsg(''), 2000); }
      else { const d = await r.json(); setCustSaveMsg(d.error || '添加失败'); }
    } catch { setCustSaveMsg('网络错误'); }
  };
  const updateCustomer = async () => {
    if (!editCust || !editCust.name.trim()) return;
    try {
      await fetch('/api/customers/' + editCust.id, { method: 'PUT', headers: headers(), body: JSON.stringify({ name: editCust.name, phone: editCust.phone, address: editCust.address }) });
      setEditCust(null); setCustSaveMsg('修改成功'); loadCustList(); loadAllCustomers(); setTimeout(() => setCustSaveMsg(''), 2000);
    } catch { setCustSaveMsg('网络错误'); }
  };
  const toggleSelCust = (id: number) => { setSelCustIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; }); };
  const deleteCustomer = (c: Customer) => { setDelCustTarget(c); };
  const confirmDeleteCust = async () => {
    if (!delCustTarget) return;
    try {
      const r = await fetch('/api/customers/' + delCustTarget.id, { method: 'DELETE', headers: headers() });
      loadCustList(); loadAllCustomers(); loadRecycleCusts();
    } catch {}
    setDelCustTarget(null);
  };
  const bulkRestoreCusts = async () => {
    if (selCustIds.size === 0) return;
    await fetch('/api/customers?ids=' + [...selCustIds].join(',') + '&restore=1', { method: 'DELETE', headers: headers() });
    setSelCustIds(new Set()); loadRecycleCusts(); loadCustList(); loadAllCustomers();
  };
  const bulkPermDeleteCusts = async () => {
    if (selCustIds.size === 0 || !confirm('确定永久删除选中的客户？此操作不可恢复！')) return;
    await fetch('/api/customers?ids=' + [...selCustIds].join(',') + '&permanent=1', { method: 'DELETE', headers: headers() });
    setSelCustIds(new Set()); loadRecycleCusts();
  };
  const openHistory = () => { setShowHistory(true); loadOrders(); };
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState('');
  const [stampImage, setStampImage] = useState('');
  const [stampPos, setStampPos] = useState({ x: 0, y: 0 }); const [draggingStamp, setDraggingStamp] = useState(false);
  const [saving, setSaving] = useState(false); const [savedMsg, setSavedMsg] = useState('');
  const [printing, setPrinting] = useState(false);
  const [savingImg, setSavingImg] = useState(false);
  const [newRowName, setNewRowName] = useState('');
  const [newRowSuggestions, setNewRowSuggestions] = useState<Sku[]>([]);
  const [showNewRowDropdown, setShowNewRowDropdown] = useState(false);
  const newRowRef = useRef<HTMLDivElement>(null);
  const [companyName, setCompanyName] = useState('佛山市南海区朔安消防器材商行');
  const [preparerName, setPreparerName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showCustMgmt, setShowCustMgmt] = useState(false);
  const [custList, setCustList] = useState<Customer[]>([]);
  const [editCust, setEditCust] = useState<Customer | null>(null);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddr, setNewCustAddr] = useState('');
  const [custSaveMsg, setCustSaveMsg] = useState('');
  const [delCustTarget, setDelCustTarget] = useState<Customer | null>(null);
  const [showCustRecycle, setShowCustRecycle] = useState(false);
  const [recycleCusts, setRecycleCusts] = useState<Customer[]>([]);
  const [selCustIds, setSelCustIds] = useState<Set<number>>(new Set());
  const skuListRef = useRef<HTMLDivElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const custRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

    const loadOrders = useCallback(async () => {
    setOrderLoading(true);
    try { const r = await fetch('/api/orders?limit=100', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setOrders(d); } catch {}
    setOrderLoading(false);
  }, [headers]);

  const loadAllCustomers = useCallback(async () => {
    try { const r = await fetch('/api/customers?limit=100', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setAllCustomers(d); } catch {}
  }, [headers]);

  const loadAllSkus = useCallback(async () => {
    try { const r = await fetch('/api/skus?limit=500', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setAllSkus(d); } catch {}
  }, [headers]);
  useEffect(() => { loadAllSkus(); loadAllCustomers(); }, [loadAllSkus, loadAllCustomers]);

  // New row product search
  useEffect(() => {
    if (!newRowName.trim()) { setNewRowSuggestions([]); return; }
    const t = setTimeout(() => {
      const q = newRowName.toLowerCase();
      const matches = allSkus.filter(s => s.skuName.toLowerCase().includes(q) || (s.brand && s.brand.toLowerCase().includes(q))).slice(0, 8);
      setNewRowSuggestions(matches);
      setShowNewRowDropdown(matches.length > 0);
    }, 200);
    return () => clearTimeout(t);
  }, [newRowName, allSkus]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (newRowRef.current && !newRowRef.current.contains(e.target as Node)) setShowNewRowDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadRecycleBin = useCallback(async () => {
    try { const r = await fetch('/api/skus?deleted=1&limit=500', { headers: headers() }); const d = await r.json(); if (Array.isArray(d)) setRecycleSkus(d); } catch {}
  }, [headers]);



  useEffect(() => {
    if (showRecycleBin) { loadRecycleBin(); return; }
    // Always load all SKUs from API (text search still uses API)
    if (searchText && searchText.length > 0) {
      setSkuLoading(true);
      const p = new URLSearchParams(); p.set('q', searchText);
      fetch('/api/skus?' + p, { headers: headers() }).then(r => r.json()).then(d => { if (Array.isArray(d)) setSkus(d); }).catch(() => {}).finally(() => setSkuLoading(false));
    } else {
      setSkuLoading(true);
      // Load all (no filter) then apply client-side pinyin filter
      fetch('/api/skus?limit=500', { headers: headers() }).then(r => r.json()).then(d => {
        if (Array.isArray(d)) {
          setAllSkus(d);
          let filtered = d;
          if (filterLetter) filtered = d.filter((s: any) => getPinyinInitial(s.skuName) === filterLetter);
          setSkus(sortByPinyin(filtered));
        }
      }).catch(() => {}).finally(() => setSkuLoading(false));
    }
  }, [filterLetter, searchText, showRecycleBin, loadRecycleBin, headers]);

  useEffect(() => {
    if (!selectedCustomer || allSkus.length === 0) { setCustomerPrices({}); return; }
    fetch('/api/prices?customerId=' + selectedCustomer.id, { headers: headers() }).then(r => r.json()).then(d => { if (d.prices) setCustomerPrices(d.prices); }).catch(() => {});
  }, [selectedCustomer, allSkus]);

  useEffect(() => {
    if (!customerName.trim() || (selectedCustomer && selectedCustomer.name === customerName)) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try { const r = await fetch('/api/customers?q=' + encodeURIComponent(customerName), { headers: headers() }); const d = await r.json(); if (Array.isArray(d) && d.length > 0) { setSuggestions(d); setShowSuggestions(true); } } catch {}
    }, 300);
    return () => clearTimeout(t);
  }, [customerName, selectedCustomer]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (custRef.current && !custRef.current.contains(e.target as Node)) { setShowSuggestions(false); setDropdownOpen(false); } };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectCust = (c: Customer) => { setCustomerName(c.name); setCustomerPhone(c.phone || ''); setCustomerAddress(c.address || ''); setSelectedCustomer(c); setShowSuggestions(false); };

    const startEditSku = (sku: Sku) => {
    setEditingSku(sku.id); setEditName(sku.skuName); setEditBrand(sku.brand);
    setEditCost(sku.costPrice); setEditUnit(sku.unit); setEditParams(sku.params || '');
  };

  const saveEditSku = async () => {
    if (!editName.trim()) return;
    try {
      await fetch('/api/skus/' + editingSku, { method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skuName: editName, brand: editBrand, costPrice: editCost, unit: editUnit, params: editParams }) });
      setEditingSku(null); loadAllSkus();
    } catch {}
  };

  const cancelEditSku = () => { setEditingSku(null); };

  const handleAddSku = async () => {
    const name = nsName.trim(); if (!name) { setSkuError('请输入产品名称'); return; }
    setSkuError('');
    try {
      const r = await fetch('/api/skus', { method: 'POST', headers: headers(), body: JSON.stringify({ skuName: name, brand: nsBrand, costPrice: nsCost || '0', unit: nsUnit }) });
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
    await fetch('/api/skus?ids=' + [...selectedIds].join(',') + (isPerm ? '&permanent=1' : ''), { method: 'DELETE', headers: headers() });
    setSelectedIds(new Set()); setShowDeleteConfirm(false); loadAllSkus(); if (showRecycleBin) loadRecycleBin();
  };

  const exportSkus = () => {
    const source = selectedIds.size > 0 ? skus.filter(s => selectedIds.has(s.id)) : skus;
    if (source.length === 0) return;
    const sorted = sortByPinyin(source);
    const csvEscape = (v: string) => { v = String(v); return v.includes(',') || v.includes('"') ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const header = '商品名称,品牌,成本价,单位,参数';
    const lines = sorted.map(s => csvEscape(s.skuName) + ',' + csvEscape(s.brand || '') + ',' + csvEscape(s.costPrice) + ',' + csvEscape(s.unit || '') + ',' + csvEscape(s.params || ''));
    const text = '\uFEFF' + header + '\n' + lines.join('\n');
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'SKU列表_' + new Date().toLocaleDateString('zh-CN') + '.csv'; a.click();
  };
  const handleImport = async () => {
    const raw = importText.replace(/\r/g, '').trim();
    const lines = raw.split('\n').filter(function(l) { return l.trim(); });
    if (lines.length < 2) { setImportResult('请粘贴表头和至少一行数据'); return; }
    
    // Auto-detect separator
    var sample = lines.slice(0, Math.min(3, lines.length)).join('\n');
    var tabN = (sample.match(/\t/g) || []).length;
    var comN = (sample.match(/,/g) || []).length;
    var semN = (sample.match(/;/g) || []).length;
    var sep = '\t';
    if (comN > tabN && comN > semN) sep = ',';
    else if (semN > tabN && semN > comN) sep = ';';
    
    var header = lines[0].split(sep).map(function(h) { return h.replace(/^["']|["']$/g, '').trim(); });
    
    // Find column indexes
    var nameIdx = -1, priceIdx = -1, brandIdx = -1, unitIdx = -1;
    for (var j = 0; j < header.length; j++) {
      var h = header[j];
      if (nameIdx < 0 && (h.indexOf('名称') >= 0 || h.indexOf('产品') >= 0 || h.indexOf('商品') >= 0 || h.indexOf('货品') >= 0 || h === 'skuName' || h === 'name')) nameIdx = j;
      if (priceIdx < 0 && (h.indexOf('价格') >= 0 || h.indexOf('价') >= 0 || h === 'costPrice' || h === 'price')) priceIdx = j;
      if (brandIdx < 0 && (h.indexOf('品牌') >= 0 || h.indexOf('牌子') >= 0 || h === 'brand')) brandIdx = j;
      if (unitIdx < 0 && (h.indexOf('单位') >= 0 || h === 'unit')) unitIdx = j;
    }
    
    // Fallback: if no name column found, use first column
    if (nameIdx < 0) nameIdx = 0;
    // Fallback: if no price column, try second column
    if (priceIdx < 0 && header.length >= 2) priceIdx = 1;
    
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(sep).map(function(c) { return c.replace(/^["']|["']$/g, '').trim(); });
      var name = cols[nameIdx] || '';
      if (!name || name === header[nameIdx] || name === '商品名称' || name === '产品名称') continue;
      var rawPrice = priceIdx >= 0 ? (cols[priceIdx] || '0') : '0';
      var price = rawPrice.replace(/[^0-9.]/g, '');
      if (!price || isNaN(Number(price))) price = '0';
      rows.push({
        skuName: name,
        brand: brandIdx >= 0 ? (cols[brandIdx] || '') : '',
        costPrice: price,
        unit: unitIdx >= 0 ? (cols[unitIdx] || '') : '',
      });
    }
    
    if (rows.length === 0) { setImportResult('未找到有效数据（分隔符: ' + (sep === '\t' ? 'Tab' : sep) + '）'); return; }
    try {
      var r = await fetch('/api/skus/import', { method: 'POST', headers: headers(), body: JSON.stringify({ rows: rows }) });
      var d = await r.json();
      if (r.ok) { setImportResult('导入 ' + d.imported + ' 条' + (d.skipped > 0 ? '，跳过 ' + d.skipped + ' 条' : '')); loadAllSkus(); setTimeout(function() { setShowImport(false); }, 1500); }
      else setImportResult(d.error || '导入失败');
    } catch(e) { setImportResult('网络错误'); }
  };
  const scrollToLetter = (l: string) => {
    setFilterLetter(l);
    const el = skuListRef.current;
    if (!el) return;
    const children = el.children;
    for (let i = 0; i < children.length; i++) {
      const text = (children[i].textContent || '').trim();
      if (text && getPinyinInitial(text) === l) {
        children[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };
  const scrollToTop = () => { setFilterLetter(''); const el = skuListRef.current; if (el) el.scrollTop = 0; };

  const handleRestore = async () => {
    if (selectedIds.size === 0) return;
    await fetch('/api/skus?ids=' + [...selectedIds].join(',') + '&restore=1', { method: 'DELETE', headers: headers() });
    setSelectedIds(new Set()); loadRecycleBin(); loadAllSkus();
  };

    const addNewRowItem = (sku?: Sku, customName?: string, customPrice?: string, customQty?: string) => {
    const name = sku ? sku.skuName : (customName || newRowName.trim());
    if (!name) return;
    const brand = sku ? sku.brand : '';
    const unit = sku ? sku.unit : '';
    const qty = customQty || '1';
    const price = customPrice || (sku ? (customerPrices[sku.skuName] || '0') : '0');
    setLineItems(p => [...p, {
      skuName: name, brand, unit,
      quantity: qty, unitPrice: parseFloat(price).toFixed(2),
      total: (parseFloat(price) * parseFloat(qty)).toFixed(2), notes: '',
    }]);
    setNewRowName('');
    setShowNewRowDropdown(false);
    // If it's a new product (not existing SKU), auto-save as SKU and customer price
    if (!sku && customName) {
      // Check if SKU already exists (case-insensitive)
      const existing = allSkus.find(s => s.skuName.toLowerCase() === customName.toLowerCase());
      if (!existing) {
        // Only create SKU if it doesn't exist - cost price set only first time
        fetch('/api/skus', { method: 'POST', headers: headers(),
          body: JSON.stringify({ skuName: customName, brand: '', costPrice: customPrice || '0', unit: '' }) })
          .then(() => loadAllSkus()).catch(() => {});
      }
      // Always update customer price for this customer
      if (selectedCustomer && customPrice) {
        fetch('/api/prices', { method: 'POST', headers: headers(),
          body: JSON.stringify({ customerId: selectedCustomer.id, skuName: customName, price: customPrice }) })
          .catch(() => {});
      }
    }
  };

  const addToOrder = (sku: Sku) => {
    const price = customerPrices[sku.skuName] || '0';
    setLineItems(p => [...p, { skuName: sku.skuName, brand: sku.brand, unit: sku.unit, quantity: '1', unitPrice: parseFloat(price).toFixed(2), total: parseFloat(price).toFixed(2), notes: '' }]);
  };

  const updateItem = (idx: number, field: keyof LineItem, val: string) => {
    setLineItems(p => { const u = [...p]; u[idx] = { ...u[idx], [field]: val }; if (field === 'quantity' || field === 'unitPrice') u[idx].total = ((parseFloat(u[idx].quantity) || 0) * (parseFloat(u[idx].unitPrice) || 0)).toFixed(2); return u; });
    // Sync brand/unit changes back to SKU table
    if (field === 'brand' || field === 'unit') {
      const item = lineItems[idx];
      const targetSku = allSkus.find(s => s.skuName === item.skuName);
      if (targetSku) {
        const body: any = { skuName: targetSku.skuName, brand: targetSku.brand, costPrice: targetSku.costPrice, unit: targetSku.unit };
        if (field === 'brand') body.brand = val;
        if (field === 'unit') body.unit = val;
        fetch('/api/skus/' + targetSku.id, { method: 'PUT', headers: headers(), body: JSON.stringify(body) })
          .then(() => loadAllSkus()).catch(() => {});
      }
    }
  };
  const removeItem = (idx: number) => setLineItems(p => p.filter((_, i) => i !== idx));

  const newOrder = () => { setLineItems([]); setSelectedCustomer(null); setCustomerName(''); setCustomerPhone(''); setCustomerAddress(''); setOrderNotes(''); setStampImage(''); setStampPos({ x: 0, y: 0 }); setPreparerName(''); setSavedMsg(''); };

  const handleStamp = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setStampImage(r.result as string); r.readAsDataURL(f); };

  const doSave = async (silent?: boolean): Promise<boolean> => {
    const name = customerName.trim();
    if (!name || lineItems.length === 0) return false;
    let lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let cid = selectedCustomer?.id;
        if (!cid) {
          const cr = await fetch('/api/customers?q=' + encodeURIComponent(name), { headers: headers() }); const cd = await cr.json();
          const ex = Array.isArray(cd) ? cd.find((c: any) => c.name === name) : null;
          if (ex) { cid = ex.id; setSelectedCustomer(ex); }
          else { const nr = await fetch('/api/customers', { method: 'POST', headers: headers(), body: JSON.stringify({ name, phone: customerPhone, address: customerAddress }) }); const nc = await nr.json(); if (!nr.ok) throw new Error(nc.error); cid = nc.id; setSelectedCustomer(nc); }
        }
        const or = await fetch('/api/orders', { method: 'POST', headers: headers(), body: JSON.stringify({ customerId: cid, items: lineItems, notes: orderNotes, stampImage: stampImage ? '[stamp]' : '', orderNumber: 'ORD-' + Date.now() }) });
        const od = or.headers.get('content-type')?.includes('json') ? await or.json() : { error: '服务器错误，请重试' };
        if (!or.ok) throw new Error(od.error || '保存失败');
        if (!silent) { setSavedMsg('订单已保存'); setTimeout(() => setSavedMsg(''), 3000); }
        return true;
      } catch (e: any) {
        lastError = e.message || '网络错误';
        if (attempt === 0) await new Promise(r => setTimeout(r, 1000));
      }
    }
    if (!silent) { setSavedMsg(lastError); setTimeout(() => setSavedMsg(''), 4000); }
    return false;
  };

  const handleSave = async () => {
    setSaving(true); setSavedMsg('');
    try { const ok = await doSave(false); if (ok) newOrder(); }
    catch (e: any) { setSavedMsg(e.message || '保存失败'); setTimeout(() => setSavedMsg(''), 3000); }
    finally { setSaving(false); }
  };

    // Save preview as image
  const handleSaveImage = async () => {
    setSavingImg(true);
    setSavedMsg('正在保存...');
    const saved = await doSave(true);
    setSavedMsg(saved ? '已保存，正在导出图片...' : '保存失败，仍将导出图片');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const el = previewRef.current; if (!el) { setSavingImg(false); return; }
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const a = document.createElement('a'); a.download = 'ORD-' + Date.now() + '.png'; a.href = canvas.toDataURL('image/png'); a.click();
    } catch (e) { console.error(e); }
    setSavedMsg('图片已导出'); setTimeout(() => setSavedMsg(''), 3000);
    setSavingImg(false);
  };

  // PDF with Chinese support via html2canvas
  const handlePrint = async () => {
    setPrinting(true);
    setSavedMsg('正在保存...');
    const saved = await doSave(true);
    setSavedMsg(saved ? '已保存，正在生成PDF...' : '保存失败，仍将生成PDF');
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
    setSavedMsg('PDF已导出'); setTimeout(() => setSavedMsg(''), 3000);
    setPrinting(false);
  };

    const reopenOrder = (orderData: any) => {
    if (orderData.customer) {
      setCustomerName(orderData.customer.name || '');
      setCustomerPhone(orderData.customer.phone || '');
      setCustomerAddress(orderData.customer.address || '');
      setSelectedCustomer(orderData.customer);
    }
    if (orderData.items) {
      setLineItems(orderData.items.map((item: any) => ({
        skuName: item.skuName, brand: item.brand || '', unit: item.unit || '',
        quantity: item.quantity, unitPrice: item.unitPrice, total: item.total, notes: item.notes || '',
      })));
    }
    if (orderData.notes) setOrderNotes(orderData.notes);
    setStampImage(orderData.stampImage || '');
    setShowHistory(false);
    setSelectedOrder(null);
  };

  const viewOrderDetail = async (orderId: number) => {
    try { const r = await fetch('/api/orders/' + orderId, { headers: headers() }); const d = await r.json(); setSelectedOrder(d); } catch {}
  };

  const stampDragStart = (e: React.MouseEvent) => { e.preventDefault(); setDraggingStamp(true); };
  const stampDragMove = (e: React.MouseEvent) => { if (!draggingStamp) return; setStampPos(p => ({ x: p.x - e.movementX, y: p.y + e.movementY })); };
  const stampDragEnd = () => { setDraggingStamp(false); };

  const totalAmount = lineItems.reduce((s, i) => s + parseFloat(i.total || '0'), 0);


  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('phone');
    router.push('/login');
  };

  // Show loading spinner while checking auth
  if (!authReady) {
    return <div className="flex h-screen items-center justify-center bg-gray-100"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div><div className="text-gray-500 text-sm">验证登录状态...</div></div></div>;
  }

  return (
    <>
          {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-30 bg-blue-600 text-white px-4 py-1.5 flex items-center justify-between shadow-md">
        <span className="text-sm font-bold">客户订单管理系统</span>
        <div className="flex items-center gap-3">
          <span className="text-xs opacity-80">{typeof window !== 'undefined' ? localStorage.getItem('phone') || '' : ''}</span>
          <button onClick={handleLogout} className="text-xs bg-white/20 px-2 py-0.5 rounded hover:bg-white/30">退出</button>
        </div>
      </div>
      <div className="flex h-screen bg-gray-100 pt-8">
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
            <button onClick={() => { setShowImport(true); setImportText(""); setImportResult(""); }} className="py-1.5 px-2 bg-green-600 text-white text-xs rounded hover:bg-green-700">导入</button>
            <button onClick={exportSkus} className="py-1.5 px-2 bg-gray-600 text-white text-xs rounded hover:bg-gray-700">导出{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</button>
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
          <div className="flex-1 overflow-y-auto" ref={skuListRef}>
            {skuLoading ? <div className="p-3 text-center text-gray-400 text-xs">加载中...</div>
            : showRecycleBin ? (
              recycleSkus.length === 0 ? <div className="p-3 text-center text-gray-400 text-xs">回收站为空</div>
              : <><div className="px-2 py-1 border-b bg-gray-50 flex gap-1"><button onClick={handleRestore} disabled={selectedIds.size === 0} className="flex-1 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300">恢复({selectedIds.size})</button><button onClick={() => selectedIds.size > 0 && setShowDeleteConfirm(true)} disabled={selectedIds.size === 0} className="flex-1 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 disabled:bg-gray-300">永久删除</button></div>
                {recycleSkus.map(s => (<div key={s.id} className="flex items-center px-2 py-1.5 border-b hover:bg-gray-50"><input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="mr-2" /><div className="flex-1"><div className="text-xs text-gray-500 truncate">{s.skuName}</div></div></div>))}</>
            ) : skus.length === 0 ? <div className="p-3 text-center text-gray-400 text-xs">暂无产品</div>
            : skus.map(s => (
              <div key={s.id} className="flex items-center hover:bg-blue-50 border-b group">
                <input type="checkbox" checked={selectedIds.has(s.id)} onChange={() => toggleSelect(s.id)} className="ml-2 shrink-0" />
                {editingSku === s.id ? (
                  <div className="flex-1 px-2 py-1.5 space-y-1">
                    <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs" placeholder="名称" />
                    <input type="text" value={editBrand} onChange={e => setEditBrand(e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs" placeholder="品牌" />
                    <div className="flex gap-1">
                      <input type="number" step="0.01" value={editCost} onChange={e => setEditCost(e.target.value)} className="flex-1 px-1 py-0.5 border rounded text-xs" placeholder="成本价" />
                      <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} className="w-16 px-1 py-0.5 border rounded text-xs" placeholder="单位" />
                    <input type="text" value={editParams} onChange={e => setEditParams(e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs" placeholder="参数/规格" />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={saveEditSku} className="flex-1 py-0.5 bg-green-600 text-white text-xs rounded">保存</button>
                      <button onClick={cancelEditSku} className="flex-1 py-0.5 bg-gray-400 text-white text-xs rounded">取消</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => addToOrder(s)} className="flex-1 text-left px-2 py-2 min-w-0">
                    <div className="flex justify-between items-start"><div className="min-w-0"><div className="text-xs font-medium truncate">{s.skuName}</div>{s.brand && <div className="text-xs text-gray-400">{s.brand}</div>}</div><div className="text-right shrink-0 ml-2">{customerPrices[s.skuName] ? <div className="text-xs font-semibold text-blue-600">¥{parseFloat(customerPrices[s.skuName]).toFixed(2)}</div> : <div className="text-xs text-gray-400">¥{parseFloat(s.costPrice).toFixed(2)}</div>}{s.unit && <div className="text-xs text-gray-400">{s.unit}</div>}</div></div>
                  </button>
                )}
                <button onClick={(e) => { e.stopPropagation(); startEditSku(s); }} className="shrink-0 px-1 py-2 text-gray-300 hover:text-blue-500 text-xs" title="编辑">✎</button>
              </div>
            ))}
          </div>
          {!showRecycleBin && (
            <div className="w-7 flex flex-col justify-center items-center border-l bg-gray-50 py-1">
              
              <button onClick={() => { setSearchText(''); scrollToTop(); }} className={"w-full text-center text-xs py-0 font-medium " + (!filterLetter ? 'text-blue-600 font-bold bg-blue-50 rounded' : 'text-gray-400 hover:text-blue-600')}>全部</button>
              {ALPHABET.map(l => (<button key={l} onClick={() => { setSearchText(''); scrollToLetter(l); }} className={"w-full text-center text-xs py-0 hover:text-blue-600 " + (filterLetter === l ? 'text-blue-600 font-bold' : 'text-gray-500')}>{l}</button>))}
            {[..."0123456789"].map(d => (<button key={d} onClick={() => { setSearchText(''); scrollToLetter(d); }} className={"w-full text-center text-xs py-0 hover:text-blue-600 " + (filterLetter === d ? 'text-blue-600 font-bold' : 'text-gray-500')}>{d}</button>))}
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Order Form */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="p-2.5 bg-white border-b flex items-center justify-between"><div className="flex items-center gap-2"><h2 className="text-base font-bold">开单</h2><button onClick={openHistory} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600">历史订单</button><button onClick={openCustMgmt} className="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100 text-gray-600">客户管理</button></div><button onClick={newOrder} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 font-medium">+ 新建订单</button></div>
        <div className="p-3 border-b bg-white space-y-2">
          <div ref={custRef} className="relative"><label className="text-xs text-gray-500 mb-0.5 block">客户名称</label>
            <div className="flex gap-1">
              <input type="text" placeholder="输入或搜索客户..." value={customerName}
                onChange={e => { setCustomerName(e.target.value); if (selectedCustomer && selectedCustomer.name !== e.target.value) setSelectedCustomer(null); }}
                onFocus={() => { if (!customerName.trim()) { loadAllCustomers(); setDropdownOpen(true); } }}
                className="flex-1 px-2 py-1.5 border rounded-l text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={() => { loadAllCustomers(); setDropdownOpen(!dropdownOpen); }}
                className="px-2 py-1.5 border border-l-0 rounded-r bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm">
                {dropdownOpen ? '▲' : '▼'}
              </button>
            </div>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                {suggestions.map(c => (<button key={c.id} onClick={() => { selectCust(c); setDropdownOpen(false); }} className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs border-b">{c.name}{c.phone && <span className="text-gray-400 ml-1">{c.phone}</span>}</button>))}
              </div>
            )}
            {dropdownOpen && suggestions.length === 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                <div className="px-2 py-1 text-xs text-gray-400 bg-gray-50 border-b">全部客户 (点击选择)</div>
                {allCustomers.length === 0 ? <div className="px-2 py-3 text-xs text-gray-400 text-center">暂无客户</div>
                : allCustomers.map(c => (<button key={c.id} onClick={() => { selectCust(c); setDropdownOpen(false); }}
                    className="w-full text-left px-2 py-1.5 hover:bg-blue-50 text-xs border-b">{c.name}{c.phone && <span className="text-gray-400 ml-1">{c.phone}</span>}</button>))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2"><div><label className="text-xs text-gray-500 mb-0.5 block">电话</label><input type="text" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div><div><label className="text-xs text-gray-500 mb-0.5 block">地址</label><input type="text" value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <table className="w-full text-xs border-l border-r border-gray-200"><thead><tr className="border-b-2 border-gray-300 bg-gray-50"><th className="text-left py-1.5 px-1 w-6 border-r border-gray-200">#</th><th className="text-left py-1.5 px-1 border-r border-gray-200">产品</th><th className="text-left py-1.5 px-1 w-16 border-r border-gray-200">品牌</th><th className="text-center py-1.5 px-1 w-12 border-r border-gray-200">单位</th><th className="text-right py-1.5 px-1 w-16 border-r border-gray-200">数量</th><th className="text-right py-1.5 px-1 w-18 border-r border-gray-200">单价</th><th className="text-right py-1.5 px-1 w-18 border-r border-gray-200">总价</th><th className="text-center py-1.5 px-1 w-16 border-r border-gray-200">备注</th><th className="w-6"></th></tr></thead>
            <tbody>
              {/* New item input row */}
              <tr className="border-b-2 border-blue-200 bg-blue-50/40">
                <td className="py-1.5 px-1 text-center text-blue-400 text-lg">+</td>
                <td className="py-1.5 px-1" colSpan={2}>
                  <div ref={newRowRef} className="relative">
                    <input type="text" placeholder="输入产品名称搜索或新增..." value={newRowName}
                      onChange={e => setNewRowName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { const pi = document.getElementById("newRowPrice") as HTMLInputElement; const qi = document.getElementById("newRowQty") as HTMLInputElement; addNewRowItem(void 0, newRowName.trim(), pi?.value || void 0, qi?.value || "1"); } }}
                      className="w-full px-2 py-1.5 border-2 border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                    {showNewRowDropdown && (
                      <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-44 overflow-y-auto">
                        {newRowSuggestions.map(s => (
                          <button key={s.id} onClick={() => addNewRowItem(s)}
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b flex justify-between items-center">
                            <span>{s.skuName}{s.brand ? <span className="text-gray-400 ml-2 text-xs">({s.brand})</span> : ""}</span>
                            <span className="text-blue-600 font-semibold text-sm">¥{parseFloat(customerPrices[s.skuName] || s.costPrice).toFixed(2)}{s.unit ? <span className="text-gray-400 font-normal ml-1 text-xs">/{s.unit}</span> : ""}</span>
                          </button>
                        ))}
                        <button onClick={() => (() => { const pi = document.getElementById("newRowPrice") as HTMLInputElement; const qi = document.getElementById("newRowQty") as HTMLInputElement; addNewRowItem(void 0, newRowName.trim(), pi?.value || void 0, qi?.value || "1"); })()}
                          className="w-full text-left px-3 py-2 hover:bg-green-50 text-sm text-green-600 font-medium border-t bg-green-50/30">
                          + 新增产品 &quot;{newRowName.trim()}&quot;
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                <td className="py-1.5 px-1 text-center text-gray-400 text-xs">—</td>
                <td className="py-1.5 px-1">
                  <input type="number" min="0.01" step="0.01" defaultValue="1" id="newRowQty"
                    onKeyDown={e => { if (e.key === "Enter") { const pi = document.getElementById("newRowPrice") as HTMLInputElement; addNewRowItem(void 0, newRowName.trim(), pi?.value || void 0, (e.target as HTMLInputElement).value || "1"); } }}
                    className="w-full text-right px-2 py-1.5 border-2 border-blue-200 rounded text-sm bg-white" />
                </td>
                <td className="py-1.5 px-1">
                  <input type="number" min="0" step="0.01" placeholder="单价" id="newRowPrice"
                    onKeyDown={e => { if (e.key === "Enter") { const inp = document.getElementById("newRowPrice") as HTMLInputElement; const qi = document.getElementById("newRowQty") as HTMLInputElement; addNewRowItem(void 0, newRowName.trim(), inp?.value, qi?.value || "1"); } }}
                    className="w-full text-right px-2 py-1.5 border-2 border-blue-200 rounded text-sm bg-white" />
                </td>
                <td className="py-1.5 px-1 text-right text-gray-300 text-sm">—</td>
                <td className="py-1.5 px-1"></td>
              </tr>{lineItems.length === 0 ? <tr><td colSpan={9} className="text-center py-10 text-gray-400">从左侧产品列表点击添加</td></tr>
            : lineItems.map((item, idx) => (<tr key={idx} className="border-b hover:bg-blue-50/30"><td className="py-1 px-1 text-gray-400 text-center border-r border-gray-100">{idx + 1}</td><td className="py-1 px-1 font-medium border-r border-gray-100">{item.skuName}</td><td className="py-1 px-1 border-r border-gray-100"><input type="text" value={item.brand} onChange={e => updateItem(idx, "brand", e.target.value)} className="w-full px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 border-r border-gray-100"><input type="text" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full text-center px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 border-r border-gray-100"><input type="number" min="0.01" step="0.01" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full text-right px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 border-r border-gray-100"><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="w-full text-right px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 text-right font-medium border-r border-gray-100">¥{parseFloat(item.total).toFixed(2)}</td><td className="py-1 px-1 border-r border-gray-100"><input type="text" value={item.notes || ''} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder="备注" className="w-16 px-1 py-0.5 border rounded text-xs" /></td><td className="py-1 px-1 text-center"><button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600">X</button></td></tr>))}</tbody></table>
          {lineItems.length > 0 && <div className="flex justify-end mt-2 pt-2 border-t border-gray-300"><span className="text-base font-bold">合计: ¥{totalAmount.toFixed(2)}</span></div>}
        </div>
        <div className="p-3 border-t bg-white space-y-2">
          <div className="space-y-2">
            <div className="flex gap-2 items-end">
              <div className="flex-1"><label className="text-xs text-gray-500 mb-0.5 block">公司名称</label><input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
              <div className="w-24"><label className="text-xs text-gray-500 mb-0.5 block">制单人</label><input type="text" value={preparerName} onChange={e => setPreparerName(e.target.value)} placeholder="姓名" className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><label className="text-xs text-gray-500 mb-0.5 block">备注</label><input type="text" value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="订单备注..." className="w-full px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" /></div>
              <div><label className="text-xs text-gray-500 mb-0.5 block">公章</label><input ref={stampRef} type="file" accept="image/*" onChange={handleStamp} className="hidden" /><button onClick={() => stampRef.current?.click()} className={'px-2 py-1.5 text-xs rounded border ' + (stampImage ? 'bg-green-50 border-green-300 text-green-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50')}>{stampImage ? '已上传' : '上传公章'}</button></div>
            </div>
          </div>
          <div className="flex gap-2"><button onClick={handleSave} disabled={saving || lineItems.length === 0 || !customerName.trim()} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{saving ? '保存中...' : '保存订单'}</button><button onClick={handleSaveImage} disabled={savingImg || lineItems.length === 0} className="flex-1 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{savingImg ? '导出中...' : '保存图片'}</button>
            <button onClick={handlePrint} disabled={printing || lineItems.length === 0} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed">{printing ? '生成中...' : '打印PDF'}</button></div>
          {savedMsg && <div className={'text-xs text-center py-1 rounded font-medium ' + (savedMsg.startsWith('订单已保存') ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50')}>✓ {savedMsg}</div>}
        </div>
      </div>

      {/* RIGHT: Preview */}
      <div className="flex-1 bg-gray-50 border-l border-gray-200 flex flex-col min-w-0">
        <div className="p-2.5 bg-white border-b text-sm font-bold text-gray-700">打印预览</div>
        <div className="flex-1 overflow-y-auto p-3">
          <div ref={previewRef} className="bg-white p-4 shadow-md" style={{ fontFamily: 'sans-serif', fontSize: '10px' }}>
            <div style={{ textAlign: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '16px' }}>{companyName}</div><div style={{ fontSize: '18px', fontWeight: 'bold' }}>销 售 单</div>
            </div>
            <div style={{ fontSize: '11px', marginBottom: '8px' }}><div>日期: {new Date().toLocaleDateString('zh-CN')}</div></div>
            <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>客户: {customerName || '--'}</div>
            <div style={{ fontSize: '10px', marginBottom: '12px', color: '#555' }}><div>电话: {customerPhone || '--'}</div><div>地址: {customerAddress || '--'}</div></div>
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse', marginBottom: '10px' }}>
              <thead><tr style={{ background: '#f0f0f0', borderBottom: '2px solid #ccc' }}><th style={{ padding: '3px 2px', textAlign: 'left' }}>#</th><th style={{ padding: '3px 2px', textAlign: 'left' }}>产品</th><th style={{ padding: '3px 2px', textAlign: 'left' }}>品牌</th><th style={{ padding: '3px 2px' }}>单位</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>数量</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>单价</th><th style={{ padding: '3px 2px', textAlign: 'right' }}>金额</th></tr></thead>
              <tbody>{lineItems.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>暂无商品</td></tr>
              : lineItems.map((item, idx) => (<tr key={idx} style={{ borderBottom: '1px solid #eee' }}><td style={{ padding: '2px' }}>{idx + 1}</td><td style={{ padding: '2px' }}>{item.skuName}</td><td style={{ padding: '2px' }}>{item.brand}</td><td style={{ padding: '2px', textAlign: 'center' }}>{item.unit}</td><td style={{ padding: '2px', textAlign: 'right' }}>{item.quantity}</td><td style={{ padding: '2px', textAlign: 'right' }}>¥{parseFloat(item.unitPrice).toFixed(2)}</td><td style={{ padding: '2px', textAlign: 'right', fontWeight: 'bold' }}>¥{parseFloat(item.total).toFixed(2)}</td><td style={{ padding: '2px', fontSize: '8px', color: '#888' }}>{item.notes || ''}</td></tr>))}</tbody>
            </table>
            {lineItems.length > 0 && (<><div style={{ borderTop: '1px solid #ccc', paddingTop: '6px', textAlign: 'right', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px' }}>合计: ¥{totalAmount.toFixed(2)}</div><div style={{ fontSize: '10px', marginBottom: '8px', color: '#555' }}>大写: {numCN(totalAmount)}</div></>)}
            {orderNotes && <div style={{ fontSize: '10px', marginBottom: '8px', color: '#555' }}>备注: {orderNotes}</div>}
            {stampImage && <div style={{ position: 'relative', marginTop: '8px', height: '90px', overflow: 'visible' }}>
                <img src={stampImage} alt="公章" draggable={false}
                  onMouseDown={stampDragStart} onMouseMove={stampDragMove} onMouseUp={stampDragEnd} onMouseLeave={stampDragEnd}
                  style={{ position: 'absolute', right: (80 + stampPos.x) + 'px', top: stampPos.y + 'px', width: '80px', height: '80px', opacity: 0.8, cursor: draggingStamp ? 'grabbing' : 'grab', userSelect: 'none' }} />
                <div style={{ position: 'absolute', bottom: 0, right: 0, fontSize: '9px', color: '#999' }}>拖拽公章可调整位置</div>
              </div>}
            <div style={{ marginTop: '15px', fontSize: '10px', clear: 'both', display: 'flex' }}>
              <div style={{ flex: 1, paddingTop: '4px', marginRight: '5%' }}>
                制单人: {preparerName || '________'}
              </div>
              <div style={{ flex: 1, borderBottom: '1px solid #999', paddingBottom: '2px' }}>
                签收人:
              </div>
            </div>
          </div>
        </div>
      </div>
    
    </div>

    {/* Import Modal */}
    {showImport && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowImport(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-bold">导入SKU数据</h3>
            <button onClick={() => setShowImport(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div className="p-4 space-y-3">
            <div className="text-xs text-gray-500">从Excel/Google表格/WPS复制数据粘贴到下方（自动识别Tab/逗号/分号分隔）：</div>
            <div className="text-xs text-gray-400 bg-gray-50 p-2 rounded">第一行为表头（程序会自动识别名称和价格列），之后每行一条SKU</div>
            <textarea value={importText} onChange={e => setImportText(e.target.value)}
              placeholder={"商品名称\t进货价(元)\n超细悬挂干粉4kg\t100\n呼救器\t45"}
              className="w-full h-48 px-3 py-2 border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            {importResult && <div className={"text-xs " + (importResult.includes("失败") || importResult.includes("错误") ? "text-red-600" : "text-green-600")}>{importResult}</div>}
            <button onClick={handleImport} className="w-full py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 text-sm">开始导入</button>
          </div>
        </div>
      </div>
    )}


    {/* Delete Confirm Modal */}
    {delCustTarget && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40" onClick={() => setDelCustTarget(null)}>
        <div className="bg-white rounded-xl shadow-2xl p-6 w-[360px]" onClick={e => e.stopPropagation()}>
          <h3 className="text-lg font-bold mb-2">确认删除</h3>
          <p className="text-sm text-gray-600 mb-4">确定要删除客户「{delCustTarget.name}」吗？此操作不可撤销。</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setDelCustTarget(null)} className="px-4 py-2 text-sm border rounded hover:bg-gray-100">取消</button>
            <button onClick={confirmDeleteCust} className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700">确认删除</button>
          </div>
        </div>
      </div>
    )}
    {/* Customer Management Modal */}
    {showCustMgmt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowCustMgmt(false)}>
        <div className="bg-white rounded-xl shadow-2xl w-[650px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-bold">{showCustRecycle ? '客户回收站' : '客户管理'}</h3>
            <div className="flex items-center gap-2">
              <button onClick={() => { setShowCustRecycle(!showCustRecycle); setSelCustIds(new Set()); if (!showCustRecycle) loadRecycleCusts(); else loadCustList(); }} className="text-xs bg-gray-100 px-2 py-1 rounded hover:bg-gray-200">{showCustRecycle ? '返回列表' : '回收站'}</button>
              <button onClick={() => setShowCustMgmt(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
          </div>
          <div className="p-4 border-b bg-gray-50 space-y-2">
            <div className="text-xs text-gray-500 font-medium">新增客户</div>
            <div className="flex gap-2">
              <input type="text" placeholder="客户名称 *" value={newCustName} onChange={e => setNewCustName(e.target.value)} className="flex-1 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="text" placeholder="电话" value={newCustPhone} onChange={e => setNewCustPhone(e.target.value)} className="w-32 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <input type="text" placeholder="地址" value={newCustAddr} onChange={e => setNewCustAddr(e.target.value)} className="w-40 px-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              <button onClick={addCustomer} className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 shrink-0">添加</button>
            </div>
            {custSaveMsg && <div className={custSaveMsg.includes("成功") ? "text-green-600 text-xs" : "text-red-600 text-xs"}>{custSaveMsg}</div>}
          </div>
          {showCustRecycle && recycleCusts.length > 0 && (
            <div className="px-4 py-2 border-b bg-gray-50 flex gap-2">
              <button onClick={bulkRestoreCusts} disabled={selCustIds.size === 0} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:bg-gray-300">恢复({selCustIds.size})</button>
              <button onClick={bulkPermDeleteCusts} disabled={selCustIds.size === 0} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:bg-gray-300">永久删除({selCustIds.size})</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-2">
            {showCustRecycle ? (recycleCusts.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">回收站为空</div> :
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100 border-b"><th className="p-2 w-8"></th><th className="p-2 text-left">客户名称</th><th className="p-2 text-left">电话</th><th className="p-2 text-center w-16">操作</th></tr></thead>
              <tbody>
                {recycleCusts.map(c => (
                  <tr key={c.id} className="border-b hover:bg-gray-50">
                    <td className="p-2"><input type="checkbox" checked={selCustIds.has(c.id)} onChange={() => toggleSelCust(c.id)} /></td>
                    <td className="p-2">{c.name}</td>
                    <td className="p-2 text-gray-500">{c.phone}</td>
                    <td className="p-2 text-center"><button onClick={() => setDelCustTarget(c)} className="text-xs text-red-500 hover:underline">删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>)
            : (custList.length === 0 ? <div className="text-center py-8 text-gray-400 text-sm">暂无客户</div> :
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-100 border-b"><th className="p-2 text-left">客户名称</th><th className="p-2 text-left w-32">电话</th><th className="p-2 text-left w-48">地址</th><th className="p-2 text-center w-20">操作</th></tr></thead>
              <tbody>
                {custList.map(c => (
                  editCust?.id === c.id ? (
                    <tr key={c.id} className="border-b bg-blue-50">
                      <td className="p-1"><input type="text" value={editCust.name} onChange={e => setEditCust({...editCust, name: e.target.value})} className="w-full px-1 py-0.5 border rounded text-sm" /></td>
                      <td className="p-1"><input type="text" value={editCust.phone} onChange={e => setEditCust({...editCust, phone: e.target.value})} className="w-full px-1 py-0.5 border rounded text-sm" /></td>
                      <td className="p-1"><input type="text" value={editCust.address} onChange={e => setEditCust({...editCust, address: e.target.value})} className="w-full px-1 py-0.5 border rounded text-sm" /></td>
                      <td className="p-1 text-center"><button onClick={updateCustomer} className="text-xs text-green-600 hover:underline mr-2">保存</button><button onClick={() => setEditCust(null)} className="text-xs text-gray-400 hover:underline">取消</button></td>
                    </tr>
                  ) : (
                    <tr key={c.id} className="border-b hover:bg-gray-50">
                      <td className="p-2">{c.name}</td>
                      <td className="p-2 text-gray-500">{c.phone}</td>
                      <td className="p-2 text-gray-500 truncate max-w-[200px]">{c.address}</td>
                      <td className="p-2 text-center">
                        <button onClick={() => setEditCust({...c})} className="text-xs text-blue-600 hover:underline mr-2">编辑</button>
                        <button onClick={() => showCustRecycle ? setDelCustTarget(c) : deleteCustomer(c)} className="text-xs text-red-500 hover:underline">删除</button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>)}
          </div>
        </div>
      </div>
    )}
    {/* History Modal */}
    {showHistory && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setShowHistory(false); setSelectedOrder(null); }}>
        <div className="bg-white rounded-xl shadow-2xl w-[800px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="text-lg font-bold">{selectedOrder ? '订单详情' : '历史订单'}</h3>
            <button onClick={() => { setShowHistory(false); setSelectedOrder(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {selectedOrder ? (
              <div>
                <div className="flex gap-3 mb-3"><button onClick={() => setSelectedOrder(null)} className="text-sm text-blue-600 hover:underline">&larr; 返回列表</button><button onClick={() => reopenOrder(selectedOrder)} className="text-sm text-green-600 hover:underline">重新开单</button></div>
                <div className="bg-gray-50 p-3 rounded-lg mb-3 text-sm space-y-1">
                  <div><strong>单号:</strong> {selectedOrder.orderNumber}</div>
                  <div><strong>日期:</strong> {new Date(selectedOrder.createdAt).toLocaleString('zh-CN')}</div>
                  <div><strong>客户:</strong> {selectedOrder.customer?.name || '--'}</div>
                  <div><strong>电话:</strong> {selectedOrder.customer?.phone || '--'}</div>
                  <div><strong>备注:</strong> {selectedOrder.notes || '--'}</div>
                </div>
                <table className="w-full text-xs border-collapse">
                  <thead><tr className="bg-gray-100 border-b"><th className="p-1.5 text-left">#</th><th className="p-1.5 text-left">产品</th><th className="p-1.5 text-left">品牌</th><th className="p-1.5 text-center">单位</th><th className="p-1.5 text-right">数量</th><th className="p-1.5 text-right">单价</th><th className="p-1.5 text-right">金额</th></tr></thead>
                  <tbody>{selectedOrder.items?.map((item: any, i: number) => (
                    <tr key={i} className="border-b"><td className="p-1.5">{i+1}</td><td className="p-1.5">{item.skuName}</td><td className="p-1.5">{item.brand}</td><td className="p-1.5 text-center">{item.unit}</td><td className="p-1.5 text-right">{item.quantity}</td><td className="p-1.5 text-right">¥{parseFloat(item.unitPrice).toFixed(2)}</td><td className="p-1.5 text-right font-medium">¥{parseFloat(item.total).toFixed(2)}</td></tr>
                  ))}</tbody>
                </table>
                <div className="text-right mt-3 text-base font-bold">合计: ¥{parseFloat(selectedOrder.totalAmount).toFixed(2)}</div>
              </div>
            ) : orderLoading ? (
              <div className="text-center py-8 text-gray-400">加载中...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">暂无历史订单</div>
            ) : (
              <table className="w-full text-sm">
                <thead><tr className="bg-gray-100 border-b"><th className="p-2 text-left">单号</th><th className="p-2 text-left">日期</th><th className="p-2 text-left">客户</th><th className="p-2 text-right">金额</th><th className="p-2 text-center">操作</th></tr></thead>
                <tbody>{orders.map((row: any) => (
                  <tr key={row.order.id} className="border-b hover:bg-gray-50">
                    <td className="p-2 text-xs font-mono">{row.order.orderNumber}</td>
                    <td className="p-2 text-xs">{new Date(row.order.createdAt).toLocaleDateString('zh-CN')}</td>
                    <td className="p-2 text-xs">{row.customer?.name || '--'}</td>
                    <td className="p-2 text-xs text-right font-medium">¥{parseFloat(row.order.totalAmount).toFixed(2)}</td>
                    <td className="p-2 text-center"><button onClick={() => viewOrderDetail(row.order.id)} className="text-xs text-blue-600 hover:underline">查看</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    )}
    </>
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
