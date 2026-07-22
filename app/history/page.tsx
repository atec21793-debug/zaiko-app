'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<{ [barcode: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // 月ごとの集計用ステート (デフォルトは今月: YYYY-MM)
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr); 
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<string | null>(null);

  // 履歴データと製品マスタを一括取得
  const fetchData = async () => {
    setLoading(true);
    
    // 1. 製品マスタ（products）を取得してマップを作成
    const { data: prodData } = await supabase.from('products').select('*');
    const map: { [barcode: string]: string } = {};
    if (prodData) {
      prodData.forEach((p) => {
        map[p.barcode] = p.name;
      });
    }
    setProductMap(map);

    // 2. 履歴（history）を取得
    const { data: histData, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
    } else if (histData) {
      setHistoryList(histData);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 履歴の削除（取り消し処理 & 在庫・集計の自動補正）
  const handleDelete = async (item: any) => {
    const itemName = productMap[item.barcode] || item.barcode;
    if (!confirm(`この履歴（${item.type}: ${itemName} 数量:${item.quantity}）を取り消しますか？\n在庫数も自動で元に戻ります。`)) {
      return;
    }

    const { error: delErr } = await supabase.from('history').delete().eq('id', item.id);
    if (delErr) {
      alert('削除エラー: ' + delErr.message);
      return;
    }

    const { data: inv } = await supabase
      .from('inventory')
      .select('*')
      .eq('barcode', item.barcode)
      .eq('store_name', item.store_name)
      .single();

    if (inv) {
      const adjustment = item.type === '入庫' ? -item.quantity : item.quantity;
      const newQty = inv.quantity + adjustment;
      await supabase
        .from('inventory')
        .update({ quantity: newQty })
        .eq('id', inv.id);
    }

    alert('取り消し処理が完了しました。');
    fetchData();
  };

  // 選択された「月」でフィルタリング
  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      const itemMonthStr = item.created_at.split('T')[0].substring(0, 7); // YYYY-MM
      if (selectedMonth) {
        return itemMonthStr === selectedMonth;
      }
      return true;
    });
  }, [historyList, selectedMonth]);

  // 出庫者ごとの合計金額集計（選択中の月ベース）
  const userSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    filteredHistory
      .filter((item) => item.type === '出庫' && item.user_name && item.user_name !== '-')
      .forEach((item) => {
        summary[item.user_name] = (summary[item.user_name] || 0) + (item.total_amount || 0);
      });
    return summary;
  }, [filteredHistory]);

  // タップされた出庫者が使った材料を全店舗合算で集計（選択中の月ベース：材料名でグルーピング）
  const selectedUserMaterials = useMemo(() => {
    if (!selectedUserForDetail) return [];
    const materialMap: { [name: string]: { name: string; quantity: number; totalAmount: number } } = {};

    filteredHistory
      .filter((item) => item.type === '出庫' && item.user_name === selectedUserForDetail)
      .forEach((item) => {
        const name = productMap[item.barcode] || `(未登録: ${item.barcode})`;
        if (!materialMap[name]) {
          materialMap[name] = { name, quantity: 0, totalAmount: 0 };
        }
        materialMap[name].quantity += item.quantity;
        materialMap[name].totalAmount += item.total_amount || 0;
      });

    return Object.values(materialMap);
  }, [filteredHistory, selectedUserForDetail, productMap]);

  return (
    <main className="w-full max-w-full p-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">月別履歴・集計</h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>
      <hr className="mb-4" />

      {/* 月選択フィルター */}
      <div className="bg-white p-3 rounded-xl border shadow-sm mb-4">
        <label className="block text-xs font-bold text-gray-600 mb-1">表示する月を選択</label>
        <input 
          type="month" 
          value={selectedMonth} 
          onChange={(e) => { setSelectedMonth(e.target.value); setSelectedUserForDetail(null); }}
          className="w-full p-2 border rounded-lg text-sm bg-gray-50 font-bold"
        />
      </div>

      {/* 出庫者ごとの合計金額集計セクション */}
      <div className="bg-gray-800 text-white p-4 rounded-xl shadow-md mb-6">
        <h2 className="text-sm font-bold mb-2 border-b border-gray-700 pb-1">
          👤 出庫者別 合計金額 ({selectedMonth || '全期間'})
        </h2>
        {Object.keys(userSummary).length === 0 ? (
          <p className="text-xs text-gray-400 py-2">この月の出庫データはありません</p>
        ) : (
          <div className="space-y-2 mt-2">
            {Object.entries(userSummary).map(([user, total]) => (
              <div 
                key={user}
                onClick={() => setSelectedUserForDetail(selectedUserForDetail === user ? null : user)}
                className={`flex justify-between items-center p-2 rounded-lg cursor-pointer transition ${
                  selectedUserForDetail === user ? 'bg-gray-700 ring-2 ring-blue-400' : 'bg-gray-900/50 hover:bg-gray-700'
                }`}
              >
                <span className="text-sm font-bold flex items-center gap-1">
                  {user} <span className="text-[10px] text-gray-400 font-normal">（タップで詳細）</span>
                </span>
                <span className="text-base font-black text-green-400">¥{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 選択された出庫者の合算材料詳細エリア（材料名表示） */}
      {selectedUserForDetail && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl mb-6 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-sm text-blue-900">
              📦 {selectedUserForDetail} さんの使用材料（全店舗合算）
            </h3>
            <button 
              type="button" 
              onClick={() => setSelectedUserForDetail(null)}
              className="text-xs text-blue-600 font-bold bg-white px-2 py-1 rounded border shadow-xs"
            >
              閉じる
            </button>
          </div>
          {selectedUserMaterials.length === 0 ? (
            <p className="text-xs text-gray-500">データがありません</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {selectedUserMaterials.map((m) => (
                <div key={m.name} className="bg-white p-2 rounded border text-xs flex justify-between items-center">
                  <span className="font-bold text-gray-800">{m.name}</span>
                  <span className="font-bold">合計: {m.quantity}個 (¥{m.totalAmount.toLocaleString()})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 履歴一覧（時系列・材料名表示） */}
      <h2 className="font-bold text-base mb-3">入出庫履歴 ({filteredHistory.length}件)</h2>
      {loading ? (
        <p className="text-center text-gray-500 py-8">読み込み中...</p>
      ) : filteredHistory.length === 0 ? (
        <p className="text-center text-gray-500 py-8">該当する月の履歴はありません。</p>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const productName = productMap[item.barcode] || `(未登録: ${item.barcode})`;
            return (
              <div 
                key={item.id} 
                className={`p-3 rounded-xl border shadow-sm bg-white flex flex-col gap-1 text-sm ${
                  item.type === '入庫' ? 'border-l-4 border-l-blue-500' : 'border-l-4 border-l-green-500'
                }`}
              >
                <div className="flex justify-between items-center text-xs text-gray-500">
                  <span>{new Date(item.created_at).toLocaleString('ja-JP')}</span>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                      item.type === '入庫' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {item.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      className="text-red-500 hover:text-red-700 font-bold text-xs bg-red-50 px-2 py-0.5 rounded border border-red-200"
                    >
                      取り消し
                    </button>
                  </div>
                </div>

                <div className="flex justify-between font-bold text-gray-800">
                  <span className="text-base">{productName}</span>
                  <span>{item.quantity} 個</span>
                </div>

                <div className="flex justify-between text-xs text-gray-600">
                  <span>店舗: {item.store_name}</span>
                  <span>担当: {item.user_name || '-'}</span>
                </div>

                {item.total_amount > 0 && (
                  <div className="text-right text-xs font-bold text-gray-700 mt-1">
                    金額: ¥{item.total_amount.toLocaleString()} (単価: ¥{item.unit_price?.toLocaleString()})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}