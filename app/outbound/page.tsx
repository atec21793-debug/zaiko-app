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

export default function OutboundPage() {
  const [selectedUser, setSelectedUser] = useState('天野');
  const [barcode, setBarcode] = useState('');
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('カパス');
  const [quantity, setQuantity] = useState<number | ''>(''); 
  const [unitPrice, setUnitPrice] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  // 登録済み材料のリストを保持するステート
  const [productsList, setProductsList] = useState<Product[]>([]);

  const users = ['天野', '佐々木'];
  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];

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

  // 商品名と単価を安全に自動取得する
  const fetchProductAndPrice = async (code: string, store: string) => {
    if (!code) {
      setProductName('');
      setUnitPrice(0);
      return;
    }

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

    const { data: priceDataList, error: priceErr } = await supabase
      .from('unit_prices')
      .select('price')
      .eq('barcode', code)
      .eq('store_name', store)
      .limit(1);

    if (priceErr) {
      console.error('❌ 単価取得エラー:', priceErr);
    }

    if (priceDataList && priceDataList.length > 0 && priceDataList[0].price !== null) {
      setUnitPrice(Number(priceDataList[0].price));
    } else {
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

  // ドロップダウンで材料が選択されたときの処理
  const handleSelectProduct = (selectedBarcode: string) => {
    if (!selectedBarcode) {
      setBarcode('');
      setProductName('');
      setUnitPrice(0);
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

    const currentUnitPrice = Number(unitPrice) || 0;
    const totalAmount = qtyNum * currentUnitPrice;

    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_name', storeName)
      .maybeSingle();

    const currentQty = inv ? inv.quantity : 0;
    const newQty = currentQty - qtyNum;

    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: selectedUser,
      type: '出庫',
      quantity: qtyNum,
      unit_price: currentUnitPrice,
      total_amount: totalAmount,
    });

    if (histErr) {
      alert('エラー: ' + histErr.message);
      return;
    }

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

    alert(`出庫完了しました (${productName} -${qtyNum})\n単価: ¥${currentUnitPrice.toLocaleString()} / 合計: ¥${totalAmount.toLocaleString()}\n現在の在庫: ${newQty}`);
    setBarcode('');
    setProductName('');
    setQuantity('');
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
          <label className="block text-xs font-bold text-gray-600 mb-1">対象店舗</label>
          <select
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white text-base"
          >
            {stores.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>

        {/* 1つのドロップダウンに「頭」「ダクト」「45」「90」「ジョイント」等をグループ化 */}
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
            onChange={(e) => setBarcode(e.target.value)}
            required
            className="w-full p-3 border rounded-lg text-base bg-white"
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
            className="w-full p-3 border rounded-lg text-base bg-white font-bold text-green-700"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">出庫数量</label>
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
          出庫を確定する ({selectedUser})
        </button>
      </form>
    </main>
  );
}