'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [phone, setPhone] = useState('');
  const [action, setAction] = useState<'login' | 'register'>('login');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async () => {
    if (!/^\d{11}$/.test(phone)) { setError('请输入11位手机号'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, action }) });
      const d = await r.json();
      if (r.ok) {
        localStorage.setItem('token', d.token);
        localStorage.setItem('userId', String(d.userId));
        router.push('/');
      } else setError(d.error || '操作失败');
    } catch { setError('网络错误'); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-[380px]">
        <h1 className="text-xl font-bold text-center mb-6">客户订单管理系统</h1>
        <div className="flex mb-4 border rounded-lg overflow-hidden">
          <button onClick={() => setAction('login')} className={`flex-1 py-2 text-sm font-medium ${action === 'login' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>登录</button>
          <button onClick={() => setAction('register')} className={`flex-1 py-2 text-sm font-medium ${action === 'register' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>注册</button>
        </div>
        <input type="tel" placeholder="请输入手机号" value={phone} maxLength={11}
          onChange={e => setPhone(e.target.value.replace(/\D/g, ''))}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3" />
        {error && <div className="text-red-500 text-xs mb-3">{error}</div>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300">
          {loading ? '处理中...' : action === 'login' ? '登录' : '注册'}
        </button>
        <div className="text-xs text-gray-400 text-center mt-4">{action === 'login' ? '首次使用请先注册' : '已有账号请登录'}</div>
      </div>
    </div>
  );
}
