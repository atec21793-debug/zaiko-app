'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';

export default function OutboundPage() {
  const [selectedUser, setSelectedUser] = useState('天野');
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('カパス');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0); // 履歴に残すための単価
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  const users = ['天野', '佐々木'];
  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  // 商品名と「選択中店舗の単価」を同時に取得する
  const fetchProductAndPrice = async (code: string, store: string) => {
    if (!code) {
      setProductName('');
      setUnitPrice(0);
      return;
    }

    // 1. 商品名を取得
    const { data: prod } = await supabase.from('products').select('*').eq('barcode', code).single();
    if (prod) {
      setProductName(prod.name);
    } else {
      setProductName('（未登録の材料・マスターで登録してください）');
    }

    // 2. 店舗ごとの単価（unit_prices）を取得
    const { data: priceData } = await supabase
      .from('unit_prices')
      .select('price')
      .eq('barcode', code)
      .eq('store_name', store)
      .single();

    if (priceData) {
      setUnitPrice(priceData.price);
    } else {
      // 店舗別単価がない場合はproductsテーブルの価格があればそれをフォールバックとして使う
      const fallbackPrice = prod?.price !== undefined ? prod.price : (prod?.unit_price || 0);
      setUnitPrice(fallbackPrice);
    }
  };

  // 店舗やバーコードが変わった時に単価を再取得
  useEffect(() => {
    if (barcode) {
      fetchProductAndPrice(barcode, storeName);
    }
  }, [storeName, barcode]);

  const onScanSuccess = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setBarcode(text);
    setIsScanning(false);
    fetchProductAndPrice(text, storeName);
    setTimeout(() => { scannedRef.current = false; }, 500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcode || quantity <= 0) {
      alert('バーコードと正しい数量を入力してください');
      return;
    }

    const totalAmount = quantity * unitPrice;

    // 1. 現在の在庫数を取得
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_name', storeName)
      .single();

    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty - quantity;

    // 2. 履歴追加（unit_price と total_amount を確実に保存する）
    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: selectedUser,
      type: '出庫',
      quantity,
      unit_price: unitPrice,
      total_amount: totalAmount,
    });

    if (histErr) {
      alert('エラー: ' + histErr.message);
      return;
    }

    // 3. 在庫数を更新
    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', inv.id);
    } else {
      await supabase.from('inventory').insert({
        barcode,
        store_name: storeName,
        quantity: newQty,
      });
    }

    alert(`出庫完了しました (${productName} -${quantity})\n金額: ¥${totalAmount.toLocaleString()}\n現在の在庫: ${newQty}`);
    setBarcode('');
    setProductName('');
    setQuantity(1);
    setUnitPrice(0);
  };

  return (
    <main className="w-full max-w-full min-h-screen p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">出庫処理</h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>

      <div className="flex bg-gray-200 p-1 rounded-xl mb-4">
        {users.map((user) => (
          <button
            key={user}
            type="button"
            onClick={() => setSelectedUser(user)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition ${
              selectedUser === user ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {user}
          </button>
        ))}
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
            onChange={(e) => setBarcode(e.target.value)}
            required
            className="w-full p-3 border rounded-lg text-sm bg-white"
            placeholder="バーコード入力"
          />
          <p className="text-xs font-bold text-gray-700 mt-1">{productName}</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">出庫数量</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            min="1"
            required
            className="w-full p-3 border rounded-lg text-sm bg-white"
          />
        </div>

        <button type="submit" className="w-full bg-gray-800 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          出庫を確定する ({selectedUser})
        </button>
      </form>
    </main>
  );
}