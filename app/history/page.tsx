'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルター用ステート
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr); // デフォルトは今日
  const [selectedMonth, setSelectedMonth] = useState(''); // 月ごとの集計用 (YYYY-MM)
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<string | null>(null); // タップされた出庫者

  // 履歴データの取得
  const fetchHistory = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching history:', error);
    } else if (data) {
      setHistoryList(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // 履歴の削除（取り消し処理 & 在庫・集計の自動補正）
  const handleDelete = async (item: any) => {
    if (!confirm(`この履歴（${item.type}: ${item.barcode} 数量:${item.quantity}）を取り消しますか？\n在庫数も自動で元に戻ります。`)) {
      return;
    }

    // 1. 履歴を削除
    const { error: delErr } = await supabase.from('history').delete().eq('id', item.id);
    if (delErr) {
      alert('削除エラー: ' + delErr.message);
      return;
    }

    // 2. 在庫数を自動補正（入庫なら減らし、出庫なら増やす）
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
    fetchHistory();
  };

  // フィルタリングされた履歴データ
  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      const itemDateStr = item.created_at.split('T')[0];
      const itemMonthStr = itemDateStr.substring(0, 7); // YYYY-MM

      if (selectedMonth) {
        return itemMonthStr === selectedMonth;
      } else if (selectedDate) {
        return itemDateStr === selectedDate;
      }
      return true;
    });
  }, [historyList, selectedDate, selectedMonth]);

  // 出庫者ごとの合計金額集計（選択中の日付 or 月ベース）
  const userSummary = useMemo(() => {
    const summary: { [key: string]: number } = {};
    filteredHistory
      .filter((item) => item.type === '出庫' && item.user_name && item.user_name !== '-')
      .forEach((item) => {
        summary[item.user_name] = (summary[item.user_name] || 0) + (item.total_amount || 0);
      });
    return summary;
  }, [filteredHistory]);

  // タップされた出庫者が使った材料を全店舗合算で集計
  const selectedUserMaterials = useMemo(() => {
    if (!selectedUserForDetail) return [];
    const materialMap: { [barcode: string]: { barcode: string; quantity: number; totalAmount: number } } = {};

    historyList
      .filter((item) => {
        const itemDateStr = item.created_at.split('T')[0];
        const itemMonthStr = itemDateStr.substring(0, 7);
        const matchPeriod = selectedMonth ? itemMonthStr === selectedMonth : selectedDate ? itemDateStr === selectedDate : true;
        return matchPeriod && item.type === '出庫' && item.user_name === selectedUserForDetail;
      })
      .forEach((item) => {
        if (!materialMap[item.barcode]) {
          materialMap[item.barcode] = { barcode: item.barcode, quantity: 0, totalAmount: 0 };
        }
        materialMap[item.barcode].quantity += item.quantity;
        materialMap[item.barcode].totalAmount += item.total_amount || 0;
      });

    return Object.values(materialMap);
  }, [historyList, selectedUserForDetail, selectedDate, selectedMonth]);

  return (
    <main className="min-h-screen p-4 bg-gray-50">
      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">履歴・集計</h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>
      <hr className="mb-4" />

      {/* 期間フィルター（日付 or 月） */}
      <div className="bg-white p-3 rounded-xl border shadow-sm mb-4 space-y-2">
        <div className="flex justify-between items-center text-xs font-bold text-gray-600">
          <span>表示フィルター</span>
          <button 
            type="button" 
            onClick={() => { setSelectedDate(todayStr); setSelectedMonth(''); setSelectedUserForDetail(null); }}
            className="text-blue-600 underline"
          >
            今日に戻す
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-gray-500 mb-1">日付で絞り込み</label>
            <input 
              type="date" 
              value={selectedMonth ? '' : selectedDate} 
              onChange={(e) => { setSelectedDate(e.target.value); setSelectedMonth(''); }}
              className="w-full p-2 border rounded-lg text-xs bg-gray-50"
            />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-gray-500 mb-1">月ごとの集計 (YYYY-MM)</label>
            <input 
              type="month" 
              value={selectedMonth} 
              onChange={(e) => { setSelectedMonth(e.target.value); setSelectedDate(''); }}
              className="w-full p-2 border rounded-lg text-xs bg-gray-50"
            />
          </div>
        </div>
      </div>

      {/* 出庫者ごとの合計金額集計セクション */}
      <div className="bg-gray-800 text-white p-4 rounded-xl shadow-md mb-6">
        <h2 className="text-sm font-bold mb-2 border-b border-gray-700 pb-1">
          出庫者別 合計金額 ({selectedMonth ? `${selectedMonth}全体` : selectedDate})
        </h2>
        {Object.keys(userSummary).length === 0 ? (
          <p className="text-xs text-gray-400 py-2">この期間の出庫データはありません</p>
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
                  👤 {user} <span className="text-[10px] text-gray-400 font-normal">（タップで詳細）</span>
                </span>
                <span className="text-base font-black text-green-400">¥{total.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 選択された出庫者の合算材料詳細エリア */}
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
                <div key={m.barcode} className="bg-white p-2 rounded border text-xs flex justify-between">
                  <span>JAN: {m.barcode}</span>
                  <span className="font-bold">合計数量: {m.quantity}個 (¥{m.totalAmount.toLocaleString()})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 履歴一覧（時系列） */}
      <h2 className="font-bold text-base mb-3">入出庫履歴 ({filteredHistory.length}件)</h2>
      {loading ? (
        <p className="text-center text-gray-500 py-8">読み込み中...</p>
      ) : filteredHistory.length === 0 ? (
        <p className="text-center text-gray-500 py-8">該当する履歴はありません。</p>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => (
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
                <span>JAN: {item.barcode}</span>
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
          ))}
        </div>
      )}
    </main>
  );
}