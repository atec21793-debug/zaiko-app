'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type InventoryItem = {
  barcode: string;
  name: string;
  model_number: string;
};

// カテゴリ（グループ）の定義と除外キーワード
const CATEGORIES = [
  { 
    key: 'ダクト', 
    label: 'ダクト類', 
    matchName: 'ダクト', 
    exclude: ['77ダクト', 'スリムダクト', '90ダクト'] 
  },
  { 
    key: 'ジョイント', 
    label: 'ジョイント', 
    matchName: 'ジョイント', 
    exclude: ['77ジョイント', '90ジョイント'] 
  },
  { 
    key: 'L頭', 
    label: 'L頭', 
    matchName: 'L頭', 
    exclude: [] 
  },
  { 
    key: '頭', 
    label: '頭', 
    matchName: '頭', 
    exclude: ['L頭', '77頭', '頭W(後付)'] // 「頭」単体に一致するもの、L頭や77頭などを分離するため
  },
  { 
    key: '90', 
    label: '90', 
    matchName: '90', 
    exclude: ['立面90', '90ダクト', '90ジョイント', '9090'] 
  },
  { 
    key: '45', 
    label: '45', 
    matchName: '45', 
    exclude: [] 
  },
];

export default function PersonalInventoryPage() {
  const params = useParams();
  const userName = decodeURIComponent(params.name as string); // '天野', '佐々木', '宇治'

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [personalStock, setPersonalStock] = useState<{ [barcode: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedGroups, setExpandedGroups] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    if (userName) {
      fetchPersonalData();
    }
  }, [userName]);

  const fetchPersonalData = async () => {
    setLoading(true);
    try {
      const { data: prodData, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;
      setProducts(prodData || []);

      const { data: histData, error: histError } = await supabase
        .from('history')
        .select('*')
        .eq('user_name', userName);

      if (histError) throw histError;

      const stockMap: { [barcode: string]: number } = {};

      histData?.forEach((item) => {
        const barcode = item.barcode;
        const qty = Number(item.quantity) || 0;

        if (!stockMap[barcode]) {
          stockMap[barcode] = 0;
        }

        if (item.type === '出庫' || item.type === '入庫' || item.type === '調整(+)') {
          stockMap[barcode] += qty;
        } else if (item.type === '消費' || item.type === '使用' || item.type === '調整(-)') {
          stockMap[barcode] -= qty;
        }
      });

      setPersonalStock(stockMap);
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  };

  // 「消費」ボタン
  const handleConsumeItem = async (item: InventoryItem) => {
    const currentQty = personalStock[item.barcode] || 0;
    if (currentQty <= 0) {
      alert('現在、手元に在庫がありません。');
      return;
    }

    const qtyStr = prompt(`${item.name} をいくつ消費（使用）しましたか？（現在の持ち出し数: ${currentQty}）`, '1');
    if (!qtyStr) return;
    const qty = parseInt(qtyStr, 10);

    if (isNaN(qty) || qty <= 0) {
      alert('有効な数量を入力してください。');
      return;
    }

    if (qty > currentQty) {
      alert(`手元の在庫数（${currentQty}個）を超える数量は消費できません。`);
      return;
    }

    try {
      const { data: prodData } = await supabase
        .from('products')
        .select('unit_price')
        .eq('barcode', item.barcode)
        .single();

      const unitPrice = prodData?.unit_price || 0;
      const totalAmount = unitPrice * qty;

      const { error } = await supabase.from('history').insert([
        {
          barcode: item.barcode,
          store_name: '個人手元',
          type: '消費',
          quantity: qty,
          unit_price: unitPrice,
          total_amount: totalAmount,
          user_name: userName,
        },
      ]);

      if (error) throw error;

      alert(`${userName} さんが ${item.name} を ${qty}個 消費しました。`);
      fetchPersonalData();
    } catch (error: any) {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  // 在庫数の直接編集
  const handleEditStock = async (item: InventoryItem) => {
    const currentQty = personalStock[item.barcode] || 0;
    const inputStr = prompt(`${item.name} の手元在庫数をいくつに修正しますか？`, String(currentQty));
    if (inputStr === null) return;

    const newQty = parseInt(inputStr, 10);
    if (isNaN(newQty) || newQty < 0) {
      alert('有効な0以上の数値を入力してください。');
      return;
    }

    const diff = newQty - currentQty;
    if (diff === 0) return;

    try {
      const { data: prodData } = await supabase
        .from('products')
        .select('unit_price')
        .eq('barcode', item.barcode)
        .single();

      const unitPrice = prodData?.unit_price || 0;
      const type = diff > 0 ? '調整(+)' : '調整(-)';
      const absDiff = Math.abs(diff);
      const totalAmount = unitPrice * absDiff;

      const { error } = await supabase.from('history').insert([
        {
          barcode: item.barcode,
          store_name: '個人手元',
          type: type,
          quantity: absDiff,
          unit_price: unitPrice,
          total_amount: totalAmount,
          user_name: userName,
        },
      ]);

      if (error) throw error;

      alert(`${item.name} の手元在庫を ${newQty}個 に更新しました。`);
      fetchPersonalData();
    } catch (error: any) {
      alert('エラーが発生しました: ' + error.message);
    }
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // 商品がどのカテゴリに属するか、除外条件も考慮して判定
  const categorizeProduct = (item: InventoryItem) => {
    for (const cat of CATEGORIES) {
      if (item.name.includes(cat.matchName)) {
        // 除外キーワードにヒットするかチェック
        const isExcluded = cat.exclude.some((ex) => item.name.includes(ex));
        if (!isExcluded) {
          return cat.key;
        }
      }
    }
    return 'その他';
  };

  // データの分類とグループ化
  const categorized: Record<string, InventoryItem[]> = { その他: [] };
  CATEGORIES.forEach((cat) => {
    categorized[cat.key] = [];
  });

  const assignedBarcodes = new Set<string>();

  products.forEach((item) => {
    const catKey = categorizeProduct(item);
    if (categorized[catKey]) {
      categorized[catKey].push(item);
      assignedBarcodes.add(item.barcode);
    } else {
      categorized['その他'].push(item);
    }
  });

  // 検索フィルタリング
  const filterList = (list: InventoryItem[]) =>
    list.filter(
      (item) =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.barcode.includes(searchTerm) ||
        item.model_number.toLowerCase().includes(searchTerm.toLowerCase())
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800">{userName} さんの手元在庫</h1>
          <Link 
            href="/" 
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
          >
            ホーム
          </Link>
        </div>
        <hr className="mb-6" />

        {/* 検索バー */}
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
            {/* 各カテゴリのリスト表示 */}
            {CATEGORIES.map((cat) => {
              const items = categorized[cat.key] || [];
              const filteredItems = filterList(items);
              const isExpanded = !!expandedGroups[cat.key];

              if (items.length === 0 || (searchTerm && filteredItems.length === 0)) {
                return null;
              }

              // グループ全体の個人在庫合計
              const groupTotalStock = items.reduce((acc, item) => acc + (personalStock[item.barcode] || 0), 0);

              return (
                <div key={cat.key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div
                    onClick={() => toggleGroup(cat.key)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  >
                    <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                      {cat.label} 
                      <span className="text-xs text-gray-400 font-normal">({items.length}件)</span>
                      <span className="ml-2 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-bold rounded-full border border-blue-100">
                        合計: {groupTotalStock}個
                      </span>
                    </h2>
                    <span className={`text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-white divide-y divide-gray-100">
                      {filteredItems.map((item) => {
                        const stockCount = personalStock[item.barcode] || 0;
                        return (
                          <div key={item.barcode} className="p-4 pl-6 sm:pl-8 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 transition">
                            <div className="col-span-6">
                              <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                              <div className="text-xs text-gray-500">型番: {item.model_number || 'なし'} / JAN: {item.barcode}</div>
                            </div>
                            <div className="col-span-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleEditStock(item)}
                                className={`text-base font-bold px-2 py-1 rounded hover:bg-gray-100 transition cursor-pointer ${
                                  stockCount > 0 ? 'text-gray-900' : 'text-gray-400'
                                }`}
                                title="クリックして数値を変更"
                              >
                                {stockCount} 個
                              </button>
                            </div>
                            <div className="col-span-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleConsumeItem(item)}
                                disabled={stockCount <= 0}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition ${
                                  stockCount > 0 
                                    ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer' 
                                    : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                                }`}
                              >
                                消費
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* その他のカテゴリ */}
            {categorized['その他'].length > 0 && filterList(categorized['その他']).length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div
                  onClick={() => toggleGroup('その他')}
                  className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
                >
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    その他 <span className="text-xs text-gray-400 font-normal">({categorized['その他'].length}件)</span>
                  </h2>
                  <span className={`text-gray-400 transform transition-transform duration-200 ${expandedGroups['その他'] ? 'rotate-180' : ''}`}>▼</span>
                </div>

                {expandedGroups['その他'] && (
                  <div className="border-t border-gray-100 bg-white divide-y divide-gray-100">
                    {filterList(categorized['その他']).map((item) => {
                      const stockCount = personalStock[item.barcode] || 0;
                      return (
                        <div key={item.barcode} className="p-4 pl-6 sm:pl-8 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 transition">
                          <div className="col-span-6">
                            <div className="font-semibold text-gray-800 text-sm">{item.name}</div>
                            <div className="text-xs text-gray-500">型番: {item.model_number || 'なし'} / JAN: {item.barcode}</div>
                          </div>
                          <div className="col-span-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleEditStock(item)}
                              className={`text-base font-bold px-2 py-1 rounded hover:bg-gray-100 transition cursor-pointer ${
                                stockCount > 0 ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {stockCount} 個
                            </button>
                          </div>
                          <div className="col-span-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleConsumeItem(item)}
                              disabled={stockCount <= 0}
                              className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-sm transition ${
                                stockCount > 0 
                                  ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer' 
                                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
                              }`}
                            >
                              消費
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}