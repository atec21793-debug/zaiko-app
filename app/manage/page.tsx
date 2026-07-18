'use client';
import { useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';

export default function ManagePage() {
  const [formData, setFormData] = useState({ 
    barcode: '', 
    name: '', 
    model_number: '' 
  });
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false); // 二重登録防止用フラグ

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  const handlePriceChange = (store: string, value: string) => {
    setPrices({ ...prices, [store]: value });
  };

  // 読み取り成功時の処理
  const onScanSuccess = (text: string) => {
    // 連続で読み取らないようにフラグで制御
    if (scannedRef.current) return;
    scannedRef.current = true;

    setFormData({ ...formData, barcode: text });
    setIsScanning(false);
    alert('バーコードを読み取りました: ' + text);
    
    // 少し待ってからフラグを戻す
    setTimeout(() => {
        scannedRef.current = false;
    }, 1000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error: prodError } = await supabase.from('products').upsert({
      barcode: formData.barcode,
      name: formData.name,
      model_number: formData.model_number
    });

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
      setFormData({ barcode: '', name: '', model_number: '' });
      setPrices({});
    }
  };

  return (
  <main className="p-4">
    <h1 className="text-2xl font-bold mb-4">材料登録</h1>
    <hr className="mb-4" />

    {/* スキャンボタン（押すとカメラエリアを表示） */}
    {!isScanning && (
      <button 
        onClick={() => setIsScanning(true)}
        className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8"
      >
        バーコードを読み取る
      </button>
    )}

    {/* スキャン画面：isScanningがtrueの時だけ表示 */}
    {isScanning && (
      <div className="mb-8 p-4 border rounded-xl bg-gray-100">
        <BarcodeScanner onScan={onScanSuccess} />
        <button 
          onClick={() => setIsScanning(false)} 
          className="w-full mt-4 bg-red-600 text-white p-3 rounded-lg"
        >
          閉じる
        </button>
      </div>
    )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* フォーム部分はそのまま */}
        <input type="text" placeholder="JANコード" className="w-full p-3 border rounded-lg" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} required />
        <input type="text" placeholder="材料名" className="w-full p-3 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <input type="text" placeholder="型番" className="w-full p-3 border rounded-lg" value={formData.model_number} onChange={(e) => setFormData({...formData, model_number: e.target.value})} />
        
        {/* 店舗別単価入力エリア */}
        <div className="space-y-3 mt-6">
          <h2 className="font-bold text-lg border-b pb-2">各店舗の仕入れ単価</h2>
          {stores.map((store) => (
            <div key={store} className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm">
              <span className="w-28 text-sm font-medium text-gray-700">{store}</span>
              <input 
                type="number" 
                inputMode="numeric"
                placeholder="単価を入力" 
                className="flex-1 p-2 border rounded-lg text-right"
                value={prices[store] || ''}
                onChange={(e) => handlePriceChange(store, e.target.value)}
              />
              <span className="text-sm text-gray-500">円</span>
            </div>
          ))}
        </div>

        <button type="submit" className="w-full bg-gray-800 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          一括登録する
        </button>
      </form>
    </main>
  );
}