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

  // 登録済み材料のリスト
  const [productsList, setProductsList] = useState<Product[]>([]);

  // 2段階セレクト用のステート
  const [selectedCategory, setSelectedCategory] = useState<string>('');

  const users = ['天野', '佐々木'];
  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', 'コメリ'];
  
  // カテゴリの選択肢
  const categories = [
    { label: '頭', keyword: '頭', excludeKeyword: 'L頭' },
    { label: 'L頭', keyword: 'L頭', excludeKeyword: '' },
    { label: 'ダクト', keyword: 'ダクト', excludeKeyword: '' },
    { label: '90', keyword: '90', excludeKeyword: '' },
    { label: '45', keyword: '45', excludeKeyword: '' },
    { label: 'ジョイント', keyword: 'ジョイント', excludeKeyword: '' },
  ];

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

    const { data: priceDataList } = await supabase
      .from('unit_prices')
      .select('price')
      .eq('barcode', code)
      .eq('store_name', store)
      .limit(1);

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

  // 1段階目で選ばれたカテゴリに応じて、材料リストを絞り込む（スリムダクトは除外）
  const filteredProductsBySubCategory = useMemo(() => {
    return productsList.filter((p) => {
      // 常に「スリムダクト」が含まれるものは省く
      if (p.name.includes('スリムダクト')) return false;

      if (!selectedCategory) return false;

      const catObj = categories.find(c => c.label === selectedCategory);
      if (!catObj) return false;

      // 「頭」の場合は「L頭」を混入させない
      if (catObj.label === '頭') {
        return p.name.includes('頭') && !p.name.includes('L頭');
      }

      return p.name.includes(catObj.keyword);
    });
  }, [productsList, selectedCategory]);

  // 材料が選択されたときの処理
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
    setSelectedCategory('');
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

        {/* 1段階目：カテゴリ選択のドロップダウン */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">1. カテゴリを選択</label>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setBarcode(''); // カテゴリ変更時に選択をリセット
              setProductName('');
            }}
            className="w-full p-3 border rounded-lg bg-white text-base font-bold text-gray-800"
          >
            <option value="">-- まずカテゴリを選択してください --</option>
            {categories.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2段階目：選ばれたカテゴリ内の材料を選ぶドロップダウン */}
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">2. 材料を選択</label>
          <select
            value={barcode}
            onChange={(e) => handleSelectProduct(e.target.value)}
            disabled={!selectedCategory}
            className="w-full p-3 border rounded-lg bg-white text-base font-bold text-gray-800 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">
              {!selectedCategory ? '-- 先に上のカテゴリを選択してください --' : '-- 材料を選択してください --'}
            </option>
            {filteredProductsBySubCategory.map((p) => (
              <option key={p.barcode} value={p.barcode}>
                {p.name} {p.model_number ? `(${p.model_number})` : ''}
              </option>
            ))}
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