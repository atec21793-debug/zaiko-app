'use client';
import { useState, useRef, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import BarcodeScanner from '../components/BarcodeScanner';
import Link from 'next/link';

type Product = {
  barcode: string;
  name: string;
  model_number: string;
};

export default function InboundPage() {
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('カパス');
  const [quantity, setQuantity] = useState<number | ''>(''); // 初期値を空欄に変更

  // 今日の日付を YYYY-MM-DD 形式で取得
  const todayStr = new Date().toISOString().substring(0, 10);
  const [inboundDate, setInboundDate] = useState(todayStr); // 入庫日用のステート

  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  // 登録済み材料のリストを保持するステート
  const [productsList, setProductsList] = useState<Product[]>([]);

  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', '港屋', 'コメリ'];

  // ページ読み込み時に材料マスタを全件取得
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
    if (!error && data) {
      setProductsList(data);
    }
  };

  const fetchProductInfo = async (code: string) => {
    if (!code) {
      setProductName('');
      return;
    }
    const { data: prod } = await supabase.from('products').select('*').eq('barcode', code).maybeSingle();
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

  // ドロップダウンで材料が選択されたときの処理
  const handleSelectProduct = (selectedBarcode: string) => {
    if (!selectedBarcode) {
      setBarcode('');
      setProductName('');
      return;
    }
    setBarcode(selectedBarcode);
    const found = productsList.find((p) => p.barcode === selectedBarcode);
    if (found) {
      setProductName(found.name);
    }
  };

  // スリムダクトを除外しつつ、各カテゴリに商品を振り分ける
  const categorizedProducts = useMemo(() => {
    const validProducts = productsList.filter(p => !p.name.includes('スリムダクト'));

    const groups = {
      head: [] as Product[],      // 頭（L頭は除く）
      lHead: [] as Product[],     // L頭
      duct: [] as Product[],     // ダクト
      deg90: [] as Product[],    // 90
      deg45: [] as Product[],    // 45
      joint: [] as Product[],    // ジョイント
      others: [] as Product[],   // その他
    };

    validProducts.forEach(p => {
      if (p.name.includes('L頭')) {
        groups.lHead.push(p);
      } else if (p.name.includes('頭')) {
        groups.head.push(p);
      } else if (p.name.includes('ダクト')) {
        groups.duct.push(p);
      } else if (p.name.includes('90')) {
        groups.deg90.push(p);
      } else if (p.name.includes('45')) {
        groups.deg45.push(p);
      } else if (p.name.includes('ジョイント')) {
        groups.joint.push(p);
      } else {
        groups.others.push(p);
      }
    });

    return groups;
  }, [productsList]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtyNum = Number(quantity);
    if (!barcode || quantity === '' || qtyNum <= 0) {
      alert('バーコードと正しい数量を入力してください');
      return;
    }

    // 選択された日付に現在の時間を付与して保存 (YYYY-MM-DDTHH:mm:ss形式など)
    // 既存データの時間に合わせるため、現在の時刻を維持して日付だけを差し替えるか、指定日の現在時刻にする
    const now = new Date();
    const targetDate = new Date(inboundDate);
    targetDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    // 1. 履歴追加（指定された日付を created_at として保存）
    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: '-',
      type: '入庫',
      quantity: qtyNum,
      unit_price: 0,
      total_amount: 0,
      created_at: targetDate.toISOString(),
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
      .maybeSingle();

    if (inv) {
      await supabase
        .from('inventory')
        .update({ quantity: inv.quantity + qtyNum })
        .eq('id', inv.id);
    } else {
      await supabase.from('inventory').insert({
        barcode,
        store_name: storeName,
        quantity: qtyNum,
      });
    }

    alert(`入庫完了しました (${productName} +${qtyNum})`);
    setBarcode('');
    setProductName('');
    setQuantity('');
    setInboundDate(new Date().toISOString().substring(0, 10)); // 日付を今日にリセット
  };

  return (
    <main className="min-h-screen p-4 bg-gray-50">
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
          className="w-full bg-gray-700 text-white p-6 rounded-xl font-bold text-xl shadow-lg mb-6"
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
          <label className="block text-xs font-bold text-gray-600 mb-1">入庫日</label>
          <input
            type="date"
            value={inboundDate}
            onChange={(e) => setInboundDate(e.target.value)}
            required
            className="w-full p-3 border rounded-lg text-base bg-white font-bold"
          />
        </div>

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

        {/* 1つのドロップダウンにカテゴリグループ化を適用 */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">登録済み材料から選択</label>
          <select
            value={barcode}
            onChange={(e) => handleSelectProduct(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white text-base font-bold text-gray-800"
          >
            <option value="">-- リストから選択またはバーコード入力 --</option>
            
            {categorizedProducts.head.length > 0 && (
              <optgroup label="【頭】">
                {categorizedProducts.head.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.lHead.length > 0 && (
              <optgroup label="【L頭】">
                {categorizedProducts.lHead.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.duct.length > 0 && (
              <optgroup label="【ダクト】">
                {categorizedProducts.duct.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.deg90.length > 0 && (
              <optgroup label="【90】">
                {categorizedProducts.deg90.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.deg45.length > 0 && (
              <optgroup label="【45】">
                {categorizedProducts.deg45.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.joint.length > 0 && (
              <optgroup label="【ジョイント】">
                {categorizedProducts.joint.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}

            {categorizedProducts.others.length > 0 && (
              <optgroup label="【その他】">
                {categorizedProducts.others.map((p) => (
                  <option key={p.barcode} value={p.barcode}>
                    {p.name} {p.model_number ? `(${p.model_number})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
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
            className="w-full p-3 border rounded-lg text-base bg-white"
            placeholder="バーコード入力"
          />
          <p className="text-xs font-bold text-gray-700 mt-1">{productName}</p>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">入庫数量</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            min="1"
            required
            placeholder="数量を入力"
            className="w-full p-3 border rounded-lg text-base bg-white"
          />
        </div>

        <button type="submit" className="w-full bg-gray-800 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          入庫を確定する
        </button>
      </form>
    </main>
  );
}