'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// Supabase クライアントの初期化
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
};

export default function InventoryPage() {
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // タップ（展開）されている材料のバーコードを管理するステート（複数同時展開も可にする場合は Set や配列）
  const [expandedBarcodes, setExpandedBarcodes] = useState<{ [barcode: string]: boolean }>({});

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*');

      if (prodError) throw prodError;

      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('*');

      if (invError) throw invError;

      const map: { [barcode: string]: InventoryItem } = {};

      products?.forEach((prod) => {
        map[prod.barcode] = {
          barcode: prod.barcode,
          name: prod.name,
          model_number: prod.model_number,
          total_quantity: 0,
          store_quantities: STORES.reduce((acc, store) => ({ ...acc, [store]: 0 }), {}),
        };
      });

      inventoryData?.forEach((inv) => {
        if (map[inv.barcode]) {
          map[inv.barcode].store_quantities[inv.store_name] = inv.quantity;
        }
      });

      Object.values(map).forEach((item) => {
        let total = 0;
        STORES.forEach((store) => {
          total += item.store_quantities[store] || 0;
        });
        item.total_quantity = total;
      });

      setInventoryList(Object.values(map));
    } catch (error) {
      console.error('在庫データの取得に失敗しました:', error);
    } finally {
      setLoading(false);
    }
  };

  // タップされた時に開閉状態を反転させる
  const toggleAccordion = (barcode: string) => {
    setExpandedBarcodes((prev) => ({
      ...prev,
      [barcode]: !prev[barcode],
    }));
  };

  const filteredList = inventoryList.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      item.model_number.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* ヘッダー */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">在庫一覧</h1>
            <p className="text-sm text-gray-500">材料をタップすると店舗ごとの在庫数が表示されます</p>
          </div>
          {/* 検索バー */}
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

        {/* ローディング表示 */}
        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : filteredList.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200 text-gray-500">
            該当する材料が見つかりません。
          </div>
        ) : (
          <div className="space-y-3">
            {filteredList.map((item) => {
              const isExpanded = !!expandedBarcodes[item.barcode];

              return (
                <div
                  key={item.barcode}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all"
                >
                  {/* 材料ヘッダー（ここをタップで開閉） */}
                  <div
                    onClick={() => toggleAccordion(item.barcode)}
                    className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
                  >
                    <div className="flex-1 pr-4">
                      <h2 className="text-base sm:text-lg font-semibold text-gray-800">
                        {item.name}
                      </h2>
                      <div className="flex flex-wrap gap-x-3 text-xs text-gray-500 mt-1">
                        <span>JAN: <strong className="text-gray-700">{item.barcode}</strong></span>
                        <span>型番: <strong className="text-gray-700">{item.model_number || 'なし'}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* 総在庫数 */}
                      <div className="text-right">
                        <span className="text-[11px] block text-gray-400 font-medium">総在庫数</span>
                        <span
                          className={`text-lg sm:text-xl font-bold ${
                            item.total_quantity < 0 ? 'text-red-600' : 'text-blue-600'
                          }`}
                        >
                          {item.total_quantity}
                        </span>
                      </div>

                      {/* 開閉アイコン */}
                      <span className={`text-gray-400 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>
                  </div>

                  {/* 店舗別内訳（タップした時のみ展開） */}
                  {isExpanded && (
                    <div className="bg-gray-50 px-4 py-4 sm:px-5 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        店舗別在庫内訳
                      </p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                        {STORES.map((store) => {
                          const qty = item.store_quantities[store] || 0;
                          return (
                            <div
                              key={store}
                              className="bg-white rounded-lg p-2.5 text-center border border-gray-200 shadow-2xs flex flex-col justify-between"
                            >
                              <span className="text-[11px] font-medium text-gray-600 truncate">{store}</span>
                              <span
                                className={`text-sm font-bold mt-1 ${
                                  qty < 0 ? 'text-red-600' : qty === 0 ? 'text-gray-400' : 'text-gray-800'
                                }`}
                              >
                                {qty}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}