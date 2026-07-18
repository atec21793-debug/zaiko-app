'use client';
import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';

export default function ManagePage() {
  const [formData, setFormData] = useState({ 
    barcode: '', 
    name: '', 
    model_number: '',
    store_name: 'カパス',
    price: '' 
  });
  const [isScanning, setIsScanning] = useState(false);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

  const onScanSuccess = (text: string) => {
    setFormData({ ...formData, barcode: text });
    setIsScanning(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // productsテーブルへの処理を .upsert() に変更
    const { error: prodError } = await supabase.from('products').upsert({
      barcode: formData.barcode,
      name: formData.name,
      model_number: formData.model_number
    });

    // unit_pricesテーブルへの処理を .upsert() に変更
    const { error: priceError } = await supabase.from('unit_prices').upsert({
      barcode: formData.barcode,
      store_name: formData.store_name,
      price: parseFloat(formData.price)
    });

    if (prodError || priceError) {
      alert('登録失敗: ' + (prodError?.message || priceError?.message));
    } else {
      alert('登録しました！');
      setFormData({ barcode: '', name: '', model_number: '', store_name: 'カパス', price: '' });
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
        
        <div className="space-y-2">
          <label className="block text-sm font-bold">店舗選択</label>
          <div className="grid grid-cols-2 gap-2">
            {stores.map((store) => (
              <button
                key={store}
                type="button"
                onClick={() => setFormData({...formData, store_name: store})}
                className={`p-2 text-sm border rounded-lg ${formData.store_name === store ? 'bg-gray-800 text-white' : 'bg-white'}`}
              >
                {store}
              </button>
            ))}
          </div>
        </div>

        <input type="number" placeholder="仕入れ単価" className="w-full p-3 border rounded-lg" value={formData.price} onChange={(e) => setFormData({...formData, price: e.target.value})} required />
        
        <button type="submit" className="w-full bg-gray-800 text-white p-4 rounded-xl font-bold text-lg shadow-md">
          登録する
        </button>
      </form>
    </main>
  );
}