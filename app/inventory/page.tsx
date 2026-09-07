'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const STORES = [
  'カパス',
  '松尾',
  'ロイヤル',
  '電材センター',
  'プロストック',
  'コーナン',
  '建デポ',
  'ビバホーム',
  'コメリ',
  '港屋',
  'その他',
];

type InventoryItem = {
  barcode: string;
  name: string;
  model_number: string;
  total_quantity: number;
  store_quantities: { [key: string]: number };
  category: string;
  color: string;
};

const CATEGORIES = [
  { key: 'ダクト', label: 'ダクト類', matchName: 'ダクト' },
  { key: 'ジョイント', label: 'ジョイント', matchName: 'ジョイント' },
  { key: 'L頭', label: 'L頭', matchName: 'L頭' },
  { key: '頭', label: '頭', matchName: '頭' },
  { key: '90', label: '90', matchName: '90' },
  { key: '45', label: '45', matchName: '45' },
];

export default function InventoryPage() {
  const [categorizedInventory, setCategorizedInventory] = useState<Record<string, InventoryItem[]>>({});
  const [ungroupedItems, setUngroupedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});

  // 在庫調整用モーダル・入力の状態
  const [adjustTarget, setAdjustTarget] = useState<{ barcode: string; storeName: string; currentQty: number; itemName: string } | null>(null);
  const [newQuantityInput, setNewQuantityInput] = useState<string>('');

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'history' },
        () => {
          fetchInventory();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          fetchInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data: products, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;

      let allHistory: any[] = [];
      let page = 0;
      const pageSize = 1000;
      let fetchMore = true;

      while (fetchMore) {
        const { data: histData, error } = await supabase
          .from('history')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (error || !histData || histData.length === 0) {
          fetchMore = false;
        } else {
          allHistory = [...allHistory, ...histData];
          if (histData.length < pageSize) fetchMore = false;
          else page++;
        }
      }

      const map: { [barcode: string]: InventoryItem } = {};

      products?.forEach((prod) => {
        let assignedCategory = 'その他';
        let color = '';

        for (const cat of CATEGORIES) {
          if (prod.name.includes(cat.matchName)) {
            assignedCategory = cat.key;
            break;
          }
        }

        if (assignedCategory !== 'その他') {
          const parts = prod.model_number.split('-');
          color = parts[parts.length - 1];
        }

        map[prod.barcode] = {
          barcode: prod.barcode,
          name: prod.name,
          model_number: prod.model_number,
          total_quantity: 0,
          store_quantities: STORES.reduce((acc, store) => ({ ...acc, [store]: 0 }), {}),
          category: assignedCategory,
          color,
        };
      });

      const sortedHistory = [...allHistory].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      sortedHistory.forEach((item) => {
        const barcode = item.barcode;
        const store = item.store_name;
        const quantity = Number(item.quantity) || 0;
        const type = item.type;

        if (map[barcode] && store && STORES.includes(store)) {
          if (type === '入庫') {
            map[barcode].store_quantities[store] += quantity;
          } else if (type === '出庫') {
            map[barcode].store_quantities[store] -= quantity;
          } else if (type === '在庫調整') {
            map[barcode].store_quantities[store] = quantity;
          }
        }
      });

      Object.values(map).forEach((item) => {
        let total = 0;
        STORES.forEach((store) => { total += item.store_quantities[store] || 0; });
        item.total_quantity = total;
      });

      const categorized: Record<string, InventoryItem[]> = {};
      const ungrouped: InventoryItem[] = [];

      CATEGORIES.forEach(cat => {
        categorized[cat.key] = [];
      });

      Object.values(map).forEach(item => {
        if (categorized[item.category]) {
          categorized[item.category].push(item);
        } else {
          ungrouped.push(item);
        }
      });

      const colorOrder = ['W', 'I', 'B', 'G', 'K'];
      Object.keys(categorized).forEach(key => {
        categorized[key].sort((a, b) => colorOrder.indexOf(a.color) - colorOrder.indexOf(b.color));
      });

      setCategorizedInventory(categorized);
      setUngroupedItems(ungrouped);

    } catch (error) {
      console.error('エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const searchItems = (items: InventoryItem[]) => 
    items.filter(item => 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      item.model_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

  // 在庫調整の実行
  const handleExecuteAdjustment = async () => {
    if (!adjustTarget) return;
    const qtyNum = Number(newQuantityInput);
    if (isNaN(qtyNum) || qtyNum < 0) {
      alert('有効な数値を入力してください。');
      return;
    }

    try {
      // 単価の取得（必要に応じてproductsマスタやunit_pricesから取得可能ですが、ここではシンプルに履歴を登録）
      const { data: prodData } = await supabase
        .from('products')
        .select('unit_price')
        .eq('barcode', adjustTarget.barcode)
        .single();

      let unitPrice = prodData?.unit_price || 0;
      
      // unit_pricesテーブルがあればそちらを優先チェック
      const { data: priceData } = await supabase
        .from('unit_prices')
        .select('price')
        .eq('barcode', adjustTarget.barcode)
        .eq('store_name', adjustTarget.storeName)
        .maybeSingle();

      if (priceData && priceData.price !== null) {
        unitPrice = priceData.price;
      }

      const totalAmount = unitPrice * qtyNum;

      // historyテーブルに「在庫調整」として新しいレコードを追加
      const { error } = await supabase.from('history').insert([
        {
          barcode: adjustTarget.barcode,
          store_name: adjustTarget.storeName,
          type: '在庫調整',
          quantity: qtyNum,
          unit_price: unitPrice,
          total_amount: totalAmount,
          user_name: '管理者', // 必要に応じてユーザー名変更
        },
      ]);

      if (error) throw error;

      alert(`${adjustTarget.storeName} の在庫数を ${qtyNum} に調整しました。`);
      setAdjustTarget(null);
      setNewQuantityInput('');
      fetchInventory();
    } catch (error: any) {
      alert('在庫調整エラー: ' + error.message);
    }
  };

  const StoreQuantities = ({ item }: { item: InventoryItem }) => (
    <div className="bg-gray-50 px-4 py-4 sm:px-5 border-t border-gray-100 mt-[-1px]">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">店舗別在庫内訳（クリックして調整）</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {STORES.map((store) => {
          const qty = item.store_quantities[store] || 0;
          return (
            <div 
              key={store} 
              onClick={() => {
                setAdjustTarget({ barcode: item.barcode, storeName: store, currentQty: qty, itemName: item.name });
                setNewQuantityInput(String(qty));
              }}
              className="bg-white rounded-lg p-2.5 text-center border border-gray-200 shadow-2xs flex flex-col justify-between cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
            >
              <span className="text-[11px] font-medium text-gray-600 truncate">{store}</span>
              <span className={`text-sm font-bold mt-1 ${qty < 0 ? 'text-red-600' : qty === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                {qty}
              </span>
              <span className="text-[10px] text-blue-600 mt-1 underline">調整</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  const ItemHeader = ({ item, level = 1 }: { item: InventoryItem; level?: number }) => {
    const isExpanded = !!expandedItems[`item:${item.barcode}`];
    const paddingClass = level === 1 ? 'p-4 sm:p-5' : 'pl-12 pr-4 py-3';

    return (
        <div
            onClick={() => toggleExpand(`item:${item.barcode}`)}
            className={`flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none border-b border-gray-100 ${paddingClass}`}
        >
            <div className="flex-1 pr-4">
                <h3 className={`text-gray-800 ${level === 1 ? 'font-semibold text-base sm:text-lg' : 'font-medium text-sm'}`}>
                    {level === 1 ? item.name : `${item.name} (${item.model_number})`}
                </h3>
                <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-1">
                    <span>JAN: <strong className="text-gray-700">{item.barcode}</strong></span>
                    {level === 1 && <span>型番: <strong className="text-gray-700">{item.model_number || 'なし'}</strong></span>}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <div className="text-right">
                    <span className="text-[11px] block text-gray-400 font-medium">総在庫数</span>
                    <span className={`text-lg font-bold ${item.total_quantity < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                        {item.total_quantity}
                    </span>
                </div>
                <span className={`text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
            </div>
        </div>
    );
  };

  const filteredUngrouped = searchItems(ungroupedItems);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">在庫一覧</h1>
          <Link 
            href="/" 
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
          >
            ホーム
          </Link>
        </div>
        <hr className="mb-6" />

        <div className="mb-6">
          <input
            type="text"
            placeholder="材料名、JAN、型番で検索..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base"
          />
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="space-y-3">
            {CATEGORIES.map(cat => {
              const items = categorizedInventory[cat.key] || [];
              const filteredItems = searchItems(items);
              const isGroupExpanded = !!expandedItems[`group:${cat.key}`];

              if (items.length === 0 || (searchTerm && filteredItems.length === 0)) {
                return null;
              }

              return (
                <div key={cat.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div
                    onClick={() => toggleExpand(`group:${cat.key}`)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  >
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      {cat.label} <span className="text-xs text-gray-400 font-normal">({items.length}件)</span>
                    </h2>
                    <div className="flex items-center gap-4">
                       <span className={`text-gray-400 transform transition-transform duration-200 ${isGroupExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>

                  {isGroupExpanded && (
                    <div className="border-t border-gray-100 bg-white">
                      {filteredItems.map(subItem => (
                          <div key={subItem.barcode} className="bg-white">
                              <ItemHeader item={subItem} level={2} />
                              {expandedItems[`item:${subItem.barcode}`] && (
                                  <StoreQuantities item={subItem} />
                              )}
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredUngrouped.map((item) => (
              <div key={item.barcode} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <ItemHeader item={item} level={1} />
                {expandedItems[`item:${item.barcode}`] && (
                   <StoreQuantities item={item} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 在庫調整用モーダル */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold text-gray-800 mb-1">在庫数の直接調整</h3>
            <p className="text-xs text-gray-500 mb-4">
              <strong className="text-gray-800">{adjustTarget.itemName}</strong><br />
              店舗: <span className="text-blue-600 font-bold">{adjustTarget.storeName}</span>
            </p>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1">新しい実在庫数</label>
              <input
                type="number"
                value={newQuantityInput}
                onChange={(e) => setNewQuantityInput(e.target.value)}
                className="w-full p-2.5 border border-gray-300 rounded-lg text-lg font-bold text-center bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="0"
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-sm transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleExecuteAdjustment}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-sm shadow-sm transition"
              >
                保存する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}