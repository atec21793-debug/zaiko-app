'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient'; // パスは適宜調整してください
import Link from 'next/link';
import { useParams } from 'next/navigation';

type InventoryItem = {
  barcode: string;
  name: string;
  model_number: string;
};

// まとめて表示するグループの定義
const GROUP_KEYWORDS = ['ダクト', '頭', '45', '90', 'ジョイント'];

export default function PersonalInventoryPage() {
  const params = useParams();
  const userName = decodeURIComponent(params.name as string); // '天野', '佐々木', '宇治'

  const [products, setProducts] = useState<InventoryItem[]>([]);
  const [personalStock, setPersonalStock] = useState<{ [barcode: string]: number }>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null); // 選択中のグループ

  useEffect(() => {
    if (userName) {
      fetchPersonalData();
    }
  }, [userName]);

  const fetchPersonalData = async () => {
    setLoading(true);
    try {
      // 1. 製品マスターの取得
      const { data: prodData, error: prodError } = await supabase.from('products').select('*');
      if (prodError) throw prodError;
      setProducts(prodData || []);

      // 2. 該当ユーザーの履歴（出庫・消費・調整など）を全て取得
      const { data: histData, error: histError } = await supabase
        .from('history')
        .select('*')
        .eq('user_name', userName);

      if (histError) throw histError;

      // 3. 材料ごとに「出庫（プラス）」と「消費（マイナス）」等を計算して個人の手元在庫を算出
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

  // 「消費」ボタンを押したときの処理
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

  // 手元在庫数を直接編集して上書きするときの処理
  const handleEditStock = async (item: InventoryItem) => {
    const currentQty = personalStock[item.barcode] || 0;
    const inputStr = prompt(`${item.name} の手元在庫数をいくつに修正しますか？`, String(currentQty));
    if (inputStr === null) return; // キャンセル

    const newQty = parseInt(inputStr, 10);
    if (isNaN(newQty) || newQty < 0) {
      alert('有効な0以上の数値を入力してください。');
      return;
    }

    const diff = newQty - currentQty;
    if (diff === 0) return; // 変更なし

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

  // 指定された対象ワードのいずれかを含む商品だけを抽出
  const allowedKeywords = [
    'ダクト',
    '頭',
    '45',
    '90',
    'ジョイント',
    '平面',
    'アウトコーナー',
    'インコーナー',
    'ウォールコーナー',
    'スライド式',
    'シーリングキャップ',
  ];

  const targetProducts = products.filter((item) =>
    allowedKeywords.some((kw) => item.name.toLowerCase().includes(kw.toLowerCase()))
  );

  // 検索またはグループ選択によるフィルタリング
  const filteredProducts = targetProducts.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.barcode.includes(searchTerm) ||
      item.model_number.toLowerCase().includes(searchTerm.toLowerCase());

    if (selectedGroup) {
      return matchesSearch && item.name.toLowerCase().includes(selectedGroup.toLowerCase());
    }

    return matchesSearch;
  });

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
        <div className="mb-4">
          <input
            type="text"
            placeholder="材料名、JAN、型番で検索..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              if (selectedGroup) setSelectedGroup(null); // 検索時はグループ選択を解除
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-base"
          />
        </div>

        {/* グループ（まとめ）ボタンエリア（グループ未選択かつ検索ワード空のときに表示） */}
        {!searchTerm && (
          <div className="mb-6">
            <div className="text-xs font-bold text-gray-500 mb-2">よく使うカテゴリ（タップして個別表示）</div>
            <div className="flex flex-wrap gap-2">
              {GROUP_KEYWORDS.map((kw) => {
                // 該当グループの合計在庫数を簡易計算
                const groupItems = targetProducts.filter((p) => p.name.toLowerCase().includes(kw.toLowerCase()));
                const groupTotalStock = groupItems.reduce((acc, p) => acc + (personalStock[p.barcode] || 0), 0);

                return (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setSelectedGroup(selectedGroup === kw ? null : kw)}
                    className={`px-4 py-2 rounded-xl font-bold text-sm shadow-sm transition cursor-pointer flex items-center gap-2 ${
                      selectedGroup === kw
                        ? 'bg-blue-600 text-white'
                        : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <span>{kw}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${selectedGroup === kw ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'}`}>
                      {groupTotalStock}個
                    </span>
                  </button>
                );
              })}
              {selectedGroup && (
                <button
                  type="button"
                  onClick={() => setSelectedGroup(null)}
                  className="px-4 py-2 rounded-xl font-bold text-sm bg-gray-200 text-gray-700 hover:bg-gray-300 transition cursor-pointer"
                >
                  すべて表示に戻す
                </button>
              )}
            </div>
          </div>
        )}

        {selectedGroup && (
          <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <span className="text-sm font-bold text-blue-800">「{selectedGroup}」の個別商品リストを表示中</span>
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              className="text-xs text-blue-600 hover:underline font-bold"
            >
              解除する
            </button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-500">読み込み中...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-gray-100 border-b border-gray-200 font-bold text-gray-700 text-sm grid grid-cols-12 gap-2">
              <div className="col-span-6">材料名 / 型番</div>
              <div className="col-span-3 text-center">手元在庫数</div>
              <div className="col-span-3 text-center">操作</div>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-sm">該当する商品がありません</div>
              ) : (
                filteredProducts.map((item) => {
                  const stockCount = personalStock[item.barcode] || 0;
                  return (
                    <div key={item.barcode} className="p-4 grid grid-cols-12 gap-2 items-center hover:bg-gray-50 transition">
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
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}