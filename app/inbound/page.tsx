'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';

export default function InboundPage() {
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('カパス');
  const [quantity, setQuantity] = useState(1);
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  const fetchProductInfo = async (code: string) => {
    const { data: prod } = await supabase.from('products').select('*').eq('barcode', code).single();
    if (prod) {
      setProductName(prod.name);
    } else {
      setProductName('（未登録の材料・マスタで登録してください）');
    }
  };

  const onScanSuccess = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setBarcode(text);
    setIsScanning(false);
    fetchProductInfo(text);
    setTimeout(() => { scannedRef.current = false; }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || quantity <= 0) {
      alert('バーコードと正しい数量を入力してください');
      return;
    }

    // 1. 履歴追加（担当者なし・単価0として記録）
    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: '-',
      type: '入庫',
      quantity,
      unit_price: 0,
      total_amount: 0,
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
  };

  return (<main className="min-h-screen p-4 bg-gray-50">
      {/* ヘッダー部分：材料登録画面と同じデザイン（右端に「ホーム」ボタン） */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">入庫処理</h1>
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
          className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8"
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
          <label className="block text-xs font-bold text-gray-600 mb-1">JANコード</label>
          <input
            type="text"
            value={barcode}
            onChange={(e) => {
              setBarcode(e.target.value);
              fetchProductInfo(e.target.value);
            }}
            required
            className="w-full p-3 border rounded-lg text-sm"
            placeholder="バーコード入力"
          />
          <p className="text-xs font-bold text-gray-700 mt-1">{productName}</p>
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

        <button type="submit" className="w-full bg-gray-800 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          入庫を確定する
        </button>
      </form>
    </main>
  );
}