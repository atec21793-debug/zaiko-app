'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';
import { Home } from 'lucide-react'; // ホームアイコンをインポート

export default function ManagePage() {
  const [formData, setFormData] = useState({ 
    barcode: '', 
    name: '', 
    model_number: '' 
  });
  const [prices, setPrices] = useState<{ [key: string]: string }>({});
  const [isScanning, setIsScanning] = useState(false);
  const [products, setProducts] = useState<any[]>([]); // 材料リスト用
  const scannedRef = useRef(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

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
    await supabase.from('products').upsert({
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

    if (priceRecords.length > 0) {
      await supabase.from('unit_prices').upsert(priceRecords);
    }
    alert('登録しました！');
  };

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">材料登録</h1>
      <hr className="mb-4" />

      
     {/* 読み取りボタン */}
{!isScanning && (
  <button 
    type="button"
    onClick={() => setIsScanning(true)} 
    className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-8"
  >
    バーコードを読み取る
  </button>
)}

{/* スキャナー表示中 */}
{isScanning && (
  <BarcodeScanner 
    onScan={onScanSuccess} 
    onClose={() => setIsScanning(false)} 
  />
)}

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" placeholder="JANコード" className="w-full p-3 border rounded-lg" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} required />
        <input type="text" placeholder="材料名" className="w-full p-3 border rounded-lg" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
        
        {/* 型番 */}
        <input type="text" placeholder="型番" className="w-full p-3 border rounded-lg" value={formData.model_number} onChange={(e) => setFormData({...formData, model_number: e.target.value})} />
        
        {/* 【配置変更】ドロップダウンを型番の下へ */}
        <select 
          className="w-full p-3 border rounded-lg bg-gray-50 text-gray-600"
          onChange={(e) => {
            const p = products.find(prod => prod.barcode === e.target.value);
            if (p) setFormData({ barcode: p.barcode, name: p.name, model_number: p.model_number });
          }}
        >
          <option value="">-- 登録済みリストから選択 --</option>
          {products.map(p => <option key={p.barcode} value={p.barcode}>{p.name} ({p.model_number})</option>)}
        </select>
        
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