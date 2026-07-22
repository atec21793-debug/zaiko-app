'use client';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';

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

  // 初期読み込み：製品一覧を取得
  useEffect(() => {
    const fetchProducts = async () => {
      const { data } = await supabase.from('products').select('*');
      if (data) setProducts(data);
    };
    fetchProducts();
  }, []);

  // JANコード変更時（またはリスト選択時）に、その商品の各店舗の単価を unit_prices から取得してセットする
  const fetchPricesForBarcode = async (code: string) => {
    if (!code) {
      setPrices({});
      return;
    }
    const { data } = await supabase
      .from('unit_prices')
      .select('store_name, price')
      .eq('barcode', code);

    if (data) {
      const priceMap: { [key: string]: string } = {};
      data.forEach((item) => {
        priceMap[item.store_name] = String(item.price);
      });
      setPrices(priceMap);
    } else {
      setPrices({});
    }
  };

  const handlePriceChange = (store: string, value: string) => {
    setPrices({ ...prices, [store]: value });
  };

  const onScanSuccess = (text: string) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    setFormData((prev) => ({ ...prev, barcode: text }));
    setIsScanning(false);
    
    // スキャンしたJANコードに紐づく単価を読み込む
    const matchedProduct = products.find(p => p.barcode === text);
    if (matchedProduct) {
      setFormData({
        barcode: matchedProduct.barcode,
        name: matchedProduct.name,
        model_number: matchedProduct.model_number || ''
      });
    }
    fetchPricesForBarcode(text);

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
    <main className="w-full max-w-full min-h-screen p-4 bg-gray-50">
      {/* ヘッダー部分：タイトルの右端に「ホーム」の文字ボタンを配置 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">材料登録・編集</h1>
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
          <label className="block text-xs font-bold text-gray-600 mb-1">JANコード</label>
          {/* text-base に変更して自動拡大を防止 */}
          <input 
            type="text" 
            placeholder="JANコード" 
            className="w-full p-3 border rounded-lg bg-white text-base" 
            value={formData.barcode} 
            onChange={(e) => {
              const val = e.target.value;
              setFormData({...formData, barcode: val});
              fetchPricesForBarcode(val);
            }} 
            required 
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">材料名</label>
          {/* text-base に変更して自動拡大を防止 */}
          <input 
            type="text" 
            placeholder="材料名" 
            className="w-full p-3 border rounded-lg bg-white text-base" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
            required 
          />
        </div>
        
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">型番</label>
          {/* text-base に変更して自動拡大を防止 */}
          <input 
            type="text" 
            placeholder="型番" 
            className="w-full p-3 border rounded-lg bg-white text-base" 
            value={formData.model_number} 
            onChange={(e) => setFormData({...formData, model_number: e.target.value})} 
          />
        </div>
        
        {/* 登録済みリストから選択 */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">登録済みリストから呼び出し</label>
          {/* text-base に変更して自動拡大を防止 */}
          <select 
            className="w-full p-3 border rounded-lg bg-white text-gray-700 text-base font-bold"
            value={formData.barcode}
            onChange={(e) => {
              const code = e.target.value;
              const p = products.find(prod => prod.barcode === code);
              if (p) {
                setFormData({ barcode: p.barcode, name: p.name, model_number: p.model_number || '' });
                fetchPricesForBarcode(p.barcode);
              } else {
                setFormData({ barcode: '', name: '', model_number: '' });
                setPrices({});
              }
            }}
          >
            <option value="">-- リストから選択して編集 --</option>
            {products.map(p => <option key={p.barcode} value={p.barcode}>{p.name} ({p.model_number || '型番なし'})</option>)}
          </select>
        </div>
        
        <div className="space-y-3 mt-6">
          <h2 className="font-bold text-lg border-b pb-2">各店舗の仕入れ単価</h2>
          {stores.map((store) => (
            <div key={store} className="flex items-center gap-2 bg-white p-3 rounded-lg shadow-sm border">
              <span className="w-28 text-sm font-bold text-gray-700">{store}</span>
              {/* text-base に変更して自動拡大を防止 */}
              <input 
                type="number" 
                inputMode="numeric" 
                placeholder="単価" 
                className="flex-1 p-2 border rounded-lg text-right text-base font-bold" 
                value={prices[store] || ''} 
                onChange={(e) => handlePriceChange(store, e.target.value)} 
              />
              <span className="text-sm text-gray-500 font-bold">円</span>
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