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
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  const users = ['天野', '佐々木'];
  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  // 商品名と単価を安全に自動取得する
  const fetchProductAndPrice = async (code: string, store: string) => {
    if (!code) {
      setProductName('');
      setUnitPrice(0);
      return;
    }

    // 1. 商品名を取得
    const { data: prod } = await supabase
      .from('products')
      .select('*')
      .eq('barcode', code)
      .maybeSingle();

    if (prod) {
      setProductName(prod.name);
    } else {
      setProductName('（未登録の材料・マスターで登録してください）');
    }

    // 2. 店舗別単価（unit_prices）を複数ヒットに対応させて安全に取得 (.limit(1)を使用)
    console.log('🔍 単価検索実行 -> バーコード:', code, '/ 店舗名:', store);
    
    const { data: priceDataList, error: priceErr } = await supabase
      .from('unit_prices')
      .select('price')
      .eq('barcode', code)
      .eq('store_name', store)
      .limit(1);

    if (priceErr) {
      console.error('❌ 単価取得エラー:', priceErr);
    }

    console.log('📦 取得できた単価データ:', priceDataList);

    if (priceDataList && priceDataList.length > 0 && priceDataList[0].price !== null) {
      setUnitPrice(Number(priceDataList[0].price));
    } else {
      console.warn('⚠️ 一致する店舗別単価が見つかりませんでした。');
      setUnitPrice(0);
    }
  };

  useEffect(() => {
    if (barcode) {
      fetchProductAndPrice(barcode, storeName);
    }
  }, [barcode, storeName]);

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

    const currentUnitPrice = Number(unitPrice) || 0;
    const totalAmount = quantity * currentUnitPrice;

    // 1. 現在の在庫数を取得
    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_name', storeName)
      .maybeSingle();

    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty - quantity;

    // 2. 履歴追加
    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: selectedUser,
      type: '出庫',
      quantity,
      unit_price: currentUnitPrice,
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

    alert(`出庫完了しました (${productName} -${quantity})\n単価: ¥${currentUnitPrice.toLocaleString()} / 合計: ¥${totalAmount.toLocaleString()}\n現在の在庫: ${newQty}`);
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
            className="w-full p-3 border rounded-lg bg-white text-base"
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
          <label className="block text-xs font-bold text-gray-600 mb-1">単価 (店舗別単価から自動取得・変更可)</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => setUnitPrice(Number(e.target.value))}
            min="0"
            required
            className="w-full p-3 border rounded-lg text-sm bg-white font-bold text-green-700"
          />
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