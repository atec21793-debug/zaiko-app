'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

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

// カテゴリーと判定キーワードの定義
const CATEGORIES = [
  { key: 'ダクト', label: '📦 ダクト類', matchName: 'ダクト' },
  { key: 'ジョイント', label: '🔗 ジョイント類', matchName: 'ジョイント' },
  { key: '頭', label: '🧢 頭 (ウォールコーナー等)', matchName: '頭' },
  { key: 'L頭', label: '🧢 L頭 (ツバ付ウォール等)', matchName: 'L頭' },
  { key: '90', label: '📐 90°曲り', matchName: '90' },
  { key: '45', label: '📐 45°曲り', matchName: '45' },
];

export default function InventoryPage() {
  const [categorizedInventory, setCategorizedInventory] = useState<Record<string, InventoryItem[]>>({});
  const [ungroupedItems, setUngroupedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // 開閉状態の管理ステート
  const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data: products, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;
      const { data: inventoryData, error: invError } = await supabase.from('inventory').select('*');
      if (invError) throw invError;

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

      inventoryData?.forEach((inv) => {
        if (map[inv.barcode]) {
          map[inv.barcode].store_quantities[inv.store_name] = inv.quantity;
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

  // 店舗別内訳コンポーネント
  const StoreQuantities = ({ item }: { item: InventoryItem }) => (
    <div className="bg-gray-50 px-4 py-4 sm:px-5 border-t border-gray-100 mt-[-1px]">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">店舗別在庫内訳</p>
      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
        {STORES.map((store) => {
          const qty = item.store_quantities[store] || 0;
          return (
            <div key={store} className="bg-white rounded-lg p-2.5 text-center border border-gray-200 shadow-2xs flex flex-col justify-between">
              <span className="text-[11px] font-medium text-gray-600 truncate">{store}</span>
              <span className={`text-sm font-bold mt-1 ${qty < 0 ? 'text-red-600' : qty === 0 ? 'text-gray-400' : 'text-gray-800'}`}>{qty}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // アイテム行コンポーネント
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">在庫一覧</h1>
            <p className="text-sm text-gray-500">各種部材はカテゴリーごとにまとめて表示されます。</p>
          </div>
          <div className="w-full md:w-80">
            <input
              type="text"
              placeholder="材料名、JAN、型番で検索..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
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
    </div>
  );
}