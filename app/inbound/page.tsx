'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';

export default function InboundPage() {
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('カパス');
  const [userName, setUserName] = useState('天野');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];
  const users = ['天野', '佐々木'];

  const fetchProductInfo = async (code: string, store: string) => {
    const { data: prod } = await supabase.from('products').select('*').eq('barcode', code).single();
    if (prod) {
      setProductName(prod.name);
      const { data: priceData } = await supabase
        .from('unit_prices')
        .select('price')
        .eq('barcode', code)
        .eq('store_name', store)
        .single();
      setUnitPrice(priceData ? priceData.price : 0);
    } else {
      setProductName('（未登録の材料・マスタで登録してください）');
      setUnitPrice(0);
    }
  };

  useEffect(() => {
    if (barcode) {
      fetchProductInfo(barcode, storeName);
    }
  }, [storeName]);

  const onScanSuccess = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setBarcode(text);
    setIsScanning(false);
    fetchProductInfo(text, storeName);
    setTimeout(() => { scannedRef.current = false; }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || quantity <= 0) {
      alert('バーコードと正しい数量を入力してください');
      return;
    }

    const totalAmount = quantity * unitPrice;

    // 1. 履歴追加
    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: userName,
      type: '入庫',
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
    });

    if (histErr) {
      alert('エラー: ' + histErr.message);
      return;
    }

    // 2. 在庫数加算
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_name', storeName)
      .single();

    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: inv.quantity + quantity })
        .eq('id', inv.id);
    } else {
      await supabase.from('inventory').insert({
        barcode,
        store_name: storeName,
        quantity,
      });
    }

    alert(`入庫完了しました (${productName} +${quantity})`);
    setBarcode('');
    setProductName('');
    setQuantity(1);
    setUnitPrice(0);
  };

  return (
    <main className="p-4 max-w-md mx-auto">
      {/* ヘッダー部分：タイトルの右端に「ホーム」ボタンを配置 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-blue-600">入庫処理</h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>
      <hr className="mb-4" />

      {!isScanning && (
        <button 
          type="button"
          onClick={() => setIsScanning(true)} 
          className="w-full bg-blue-600 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8"
        >
          バーコードを読み取る
        </button>
      )}

      {isScanning && (
        <BarcodeScanner 
          onScan={onScanSuccess} 
          onClose={() => setIsScanning(false)} 
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">対象店舗</label>
          <select
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white text-sm"
          >
            {stores.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">担当者</label>
          <select
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white text-sm"
          >
            {users.map((u) => (<option key={u} value={u}>{u}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">JANコード</label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              fetchProductInfo(e.target.value, storeName);
            }}
            required
            className="w-full p-3 border rounded-lg text-sm"
            placeholder="バーコード入力"
          />
          <p className="text-xs font-bold text-blue-700 mt-1">{productName}</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">入庫数量</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min="1"
            required
            className="w-full p-3 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">仕入れ単価 (円)</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
            className="w-full p-3 border rounded-lg text-sm bg-gray-50"
          />
        </div>

        <button type="submit" className="w-full bg-blue-600 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          入庫を確定する
        </button>
      </form>
    </main>
  );
}