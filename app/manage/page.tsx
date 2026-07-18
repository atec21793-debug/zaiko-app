'use client';
import { useState, useRef, useEffect } from 'react'; // 1. useEffectを追加
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
  const [products, setProducts] = useState<any[]>([]); // 2. リスト保持用state追加
  const scannedRef = useRef(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  // 3. データ読み込み処理を追加
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*');
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  const handlePriceChange = (store: string, value: string) => {
    setPrices({ ...prices, [store]: value });
  };

  const onScanSuccess = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setFormData((prev) => ({ ...prev, barcode: text }));
    setIsScanning(false);
    setTimeout(() => { scannedRef.current = false; }, 500);
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
      // 再読み込みしてリストを最新に
      const { data } = await supabase.from('products').select('*');
      if (data) setProducts(data);
    }
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">材料登録</h1>
      <hr className="mb-4" />

      {/* 4. 編集用ドロップダウンを追加 */}
      <div className="mb-6 p-4 bg-gray-50 rounded-xl border">
        <label className="block text-sm font-bold mb-2 text-gray-700">登録済みから選択して編集</label>
        <select 
          className="w-full p-3 border rounded-lg"
          onChange={(e) => {
            const p = products.find(prod => prod.barcode === e.target.value);
            if (p) setFormData({ barcode: p.barcode, name: p.name, model_number: p.model_number });
          }}
        >
          <option value="">-- 材料を選択 --</option>
          {products.map(p => <option key={p.barcode} value={p.barcode}>{p.name} ({p.model_number})</option>)}
        </select>
        <button onClick={() => setFormData({ barcode: '', name: '', model_number: '' })} className="mt-2 text-sm text-blue-600 underline">新規登録モードへ</button>
      </div>

      {!isScanning && (
        <button onClick={() => setIsScanning(true)} className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8">
          バーコードを読み取る
        </button>
      )}

      {isScanning && (
        <div className="mb-8 p-4 border rounded-xl bg-gray-100">
          <BarcodeScanner onScan={onScanSuccess} />
          <button onClick={() => setIsScanning(false)} className="w-full mt-4 bg-red-600 text-white p-3 rounded-lg">閉じる</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="JANコード" className="w-full p-3 border rounded-lg" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} required />
        <input type="text" placeholder="材料名" className="w-full p-3 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        <input type="text" placeholder="型番" className="w-full p-3 border rounded-lg" value={formData.model_number} onChange={(e) => setFormData({...formData, model_number: e.target.value})} />
        
        <div className="space-y-3 mt-6">
          <h2 className="font-bold text-lg border-b pb-2">各店舗の仕入れ単価</h2>
          {stores.map((store) => (
            <div key={store} className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm">
              <span className="w-28 text-sm font-medium text-gray-700">{store}</span>
              <input type="number" inputMode="numeric" placeholder="単価" className="flex-1 p-2 border rounded-lg text-right" value={prices[store] || ''} onChange={(e) => handlePriceChange(store, e.target.value)} />
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