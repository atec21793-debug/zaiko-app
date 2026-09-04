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
  const [currentInventory, setCurrentInventory] = useState<number | null>(null);
  
  // 今日の日付を YYYY-MM-DD 形式で取得（日本時間ベース）
  const todayJSTStr = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Tokyo' }).replace(/\//g, '-');
  const [outboundDate, setOutboundDate] = useState(todayJSTStr);

  const [isScanning, setIsScanning] = useState(false);
  const scannedRef = useRef(false);

  const [productsList, setProductsList] = useState<Product[]>([]);

  // 「在庫調整」という名前のユーザーを追加
  const users = ['天野', '佐々木', '在庫調整'];
  const stores = ['カパス', '松尾', 'ロイヤル', '電材センター', 'プロストック', 'コーナン', '建デポ', 'ビバホーム', '港屋', 'コメリ', 'その他'];

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data, error } = await supabase.from('products').select('*').order('name', { ascending: true });
    if (!error && data) {
      setProductsList(data);
    }
  };

  const fetchProductAndPrice = async (code: string, store: string) => {
    if (!code) {
      setProductName('');
      setUnitPrice(0);
      setCurrentInventory(null);
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
      .order('id', { ascending: false })
      .limit(1);

    if (priceDataList && priceDataList.length > 0 && priceDataList[0].price !== null) {
      setUnitPrice(Number(priceDataList[0].price));
    } else {
      setUnitPrice(0);
    }

    // 現在の在庫数取得
    const { data: inv } = await supabase
      .from('inventory')
      .select('quantity')
      .eq('barcode', code)
      .eq('store_name', store)
      .maybeSingle();

    if (inv) {
      setCurrentInventory(inv.quantity);
    } else {
      setCurrentInventory(0);
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

  const handleSelectProduct = (selectedBarcode: string) => {
    if (!selectedBarcode) {
      setBarcode('');
      setProductName('');
      setUnitPrice(0);
      setCurrentInventory(null);
      return;
    }
    setBarcode(selectedBarcode);
    const found = productsList.find((p) => p.barcode === selectedBarcode);
    if (found) {
      setProductName(found.name);
    }
  };

  const categorizedProducts = useMemo(() => {
    const groups = {
      head: [] as Product[],
      lHead: [] as Product[],
      duct: [] as Product[],
      deg90: [] as Product[],
      deg45: [] as Product[],
      joint: [] as Product[],
      others: [] as Product[],
    };

    productsList.forEach(p => {
      const model = p.model_number || '';
      // 「スリムダクト」などはダクトのグループに混ぜず、モデル番号や名前に応じて適切に振り分ける（または「その他」へ）
      if (p.name.includes('L頭')) {
        groups.lHead.push(p);
      } else if (p.name.includes('頭')) {
        groups.head.push(p);
      } else if (model.startsWith('LD-70') && !p.name.includes('スリムダクト')) {
        groups.duct.push(p);
      } else if (model.startsWith('LDK-70')) {
        groups.deg90.push(p);
      } else if (p.name.includes('45')) {
        groups.deg45.push(p);
      } else if (model.startsWith('LDJ-70')) {
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
    if (!barcode || quantity === '' || qtyNum === 0) {
      alert('バーコードと、0以外の増減数を入力してください');
      return;
    }

    const currentUnitPrice = Number(unitPrice) || 0;
    const customCreatedAt = new Date(`${outboundDate}T00:00:00+09:00`).toISOString();

    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', barcode)
      .eq('store_name', storeName)
      .maybeSingle();

    const currentQty = inv ? inv.quantity : 0;
    let newQty = 0;
    let diffQty = 0;
    let historyType = '出庫';

    if (selectedUser === '在庫調整') {
      newQty = currentQty + qtyNum;
      diffQty = Math.abs(qtyNum);
      historyType = '在庫調整';
    } else {
      newQty = currentQty - qtyNum;
      diffQty = qtyNum;
      historyType = '出庫';
    }

    const totalAmount = diffQty * currentUnitPrice;

    const { error: histErr } = await supabase.from('history').insert({
      barcode,
      store_name: storeName,
      user_name: selectedUser,
      type: historyType,
      quantity: diffQty,
      unit_price: currentUnitPrice,
      total_amount: totalAmount,
      created_at: customCreatedAt,
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

    alert(`${historyType}完了しました (${productName})\n更新後の在庫: ${newQty}`);
    setBarcode('');
    setProductName('');
    setQuantity('');
    setUnitPrice(0);
    setCurrentInventory(null);
  };

  return (
    <main className="w-full max-w-full min-h-screen p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">
          {selectedUser === '在庫調整' ? '在庫調整処理' : '出庫処理'}
        </h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>

      {/* 3つのボタン（天野、佐々木、在庫調整） */}
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
          <label className="block text-xs font-bold text-gray-600 mb-1">処理日</label>
          <input
            type="date"
            value={outboundDate}
            onChange={(e) => setOutboundDate(e.target.value)}
            required
            className="w-full p-3 border rounded-lg text-base bg-white font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">対象店舗</label>
          <select
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            className="w-full p-3 border rounded-lg bg-white text-base font-bold"
          >
            {stores.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>

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
                {categorizedProducts.head.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.lHead.length > 0 && (
              <optgroup label="【L頭】">
                {categorizedProducts.lHead.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.duct.length > 0 && (
              <optgroup label="【ダクト】">
                {categorizedProducts.duct.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.deg90.length > 0 && (
              <optgroup label="【90】">
                {categorizedProducts.deg90.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.deg45.length > 0 && (
              <optgroup label="【45】">
                {categorizedProducts.deg45.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.joint.length > 0 && (
              <optgroup label="【ジョイント】">
                {categorizedProducts.joint.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
              </optgroup>
            )}
            {categorizedProducts.others.length > 0 && (
              <optgroup label="【その他】">
                {categorizedProducts.others.map((p) => (<option key={p.barcode} value={p.barcode}>{p.name} {p.model_number ? `(${p.model_number})` : ''}</option>))}
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
          {currentInventory !== null && (
            <p className="text-xs font-bold text-blue-600 mt-0.5">現在の店舗在庫: {currentInventory} 個</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">単価</label>
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
          <label className="block text-xs font-bold text-gray-600 mb-1">
            {selectedUser === '在庫調整' ? '増減数（例: +2 や -1）' : '出庫数量'}
          </label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
            required
            placeholder={selectedUser === '在庫調整' ? "増やす場合は 2、減らす場合は -1" : "数量を入力"}
            className="w-full p-3 border rounded-lg text-base bg-white font-bold"
          />
        </div>

        <button type="submit" className="w-full bg-gray-800 text-white p-5 rounded-xl font-bold text-lg shadow-lg mt-6">
          {selectedUser === '在庫調整' ? '在庫調整を確定する' : `出庫を確定する (${selectedUser})`}
        </button>
      </form>
    </main>
  );
}