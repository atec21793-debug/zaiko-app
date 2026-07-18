'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';

export default function ManagePage() {
  const [formData, setFormData] = useState({ 
    barcode: '', 
    name: '', 
    model_number: '' 
  });
  // 店舗ごとの単価を保持: { 'カパス': '100', '松尾': '', ... }
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [isScanning, setIsScanning] = useState(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  const handlePriceChange = (store: string, value: string) => {
    setPrices({ ...prices, [store]: value });
  };

  const onScanSuccess = (text: string) => {
    setFormData({ ...formData, barcode: text });
    setIsScanning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 商品情報の保存
    const { error: prodError } = await supabase.from('products').upsert({
      barcode: formData.barcode,
      name: formData.name,
      model_number: formData.model_number
    });

    // 2. 金額が入力されている店舗のみ抽出して保存
    const priceRecords = Object.entries(prices)
      .filter(([_, price]) => price !== '' && price !== '0')
      .map(([store, price]) => ({
        barcode: formData.barcode,
        store_name: store,
        price: parseFloat(price)
      }));

    let priceError = null;
    if (priceRecords.length > 0) {
      const { error } = await supabase.from('unit_prices').upsert(priceRecords);
      priceError = error;
    }

    if (prodError || priceError) {
      alert('登録失敗: ' + (prodError?.message || priceError?.message));
    } else {
      alert('登録しました！');
      // フォームをリセット
      setFormData({ barcode: '', name: '', model_number: '' });
      setPrices({});
    }
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">材料登録</h1>
      <hr className="mb-4" />

      {/* バーコード読み取りボタン / スキャナー表示エリア */}
      {isScanning ? (
        <div className="mb-8">
          <BarcodeScanner onScan={onScanSuccess} />
          <button onClick={() => setIsScanning(false)} className="w-full mt-2 bg-red-600 text-white p-2 rounded">キャンセル</button>
        </div>
      ) : (
        // --- 【修正箇所】スキャン中でない場合にボタンを表示する else ブロックを追加 ---
        <button 
          onClick={() => setIsScanning(true)}
          className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8"
        >
          バーコード読み取り
        </button>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="JANコード" className="w-full p-3 border rounded-lg" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} required />
        <input type="text" placeholder="材料名" className="w-full p-3 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <input type="text" placeholder="型番" className="w-full p-3 border rounded-lg" value={formData.model_number} onChange={(e) => setFormData({...formData, model_number: e.target.value})} />
        
        {/* 店舗名と入力欄の横並び一覧 */}
        <div className="space-y-2 mt-6">
          <h2 className="font-bold">各店舗の単価を入力</h2>
          {stores.map((store) => (
            <div key={store} className="flex items-center gap-2">
              <span className="w-24 text-sm">{store}</span>
              <input 
                type="number" 
                placeholder="単価" 
                className="flex-1 p-2 border rounded-lg"
                value={prices[store] || ''}
                onChange={(e) => handlePriceChange(store, e.target.value)}
              />
            </div>
          ))}
        </div>

        <button type="submit" className="w-full bg-gray-800 text-white p-4 rounded-xl font-bold text-lg">
          一括登録する
        </button>
      </form>
    </main>
  );
}