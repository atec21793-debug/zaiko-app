'use client';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function SummaryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<{ [barcode: string]: { name: string } }>({});
  const [loading, setLoading] = useState(true);

  // 今月の年月を YYYY-MM 形式で取得
  const todayStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(todayStr);
  const [searchStore, setSearchStore] = useState('');

  // 1. データの全件取得（履歴＆製品マスタ）
  const fetchData = async () => {
    setLoading(true);
    
    // 製品マスタ取得
    const { data: prodData } = await supabase.from('products').select('*');
    const map: { [barcode: string]: { name: string } } = {};
    if (prodData) {
      prodData.forEach((p) => {
        map[p.barcode] = { name: p.name };
      });
    }
    setProductMap(map);

    // 履歴を全件取得（ページング処理）
    let allHistory: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data: histData, error } = await supabase
        .from('history')
        .select('*')
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error || !histData || histData.length === 0) {
        fetchMore = false;
      } else {
        allHistory = [...allHistory, ...histData];
        if (histData.length < pageSize) fetchMore = false;
        else page++;
      }
    }

    setHistoryList(allHistory);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 2. 日付から "YYYY-MM" を取得するヘルパー
  const getItemMonthStr = (createdAt: string) => {
    if (!createdAt) return '';
    try {
      const date = new Date(createdAt);
      if (isNaN(date.getTime())) return createdAt.substring(0, 7);
      const jstDate = new Date(date.getTime() + (9 * 60 * 60 * 1000));
      return jstDate.toISOString().substring(0, 7);
    } catch (e) {
      return createdAt.substring(0, 7);
    }
  };

  // 3. 材料ごとに入庫数・出庫数を集計
  const summaryData = useMemo(() => {
    const map: { [barcode: string]: { name: string; inQty: number; outQty: number; outAmount: number } } = {};

    historyList
      .filter((item) => {
        // 月フィルター
        const itemMonthStr = getItemMonthStr(item.created_at);
        if (selectedMonth && itemMonthStr !== selectedMonth) return false;

        // 店舗フィルター
        if (searchStore.trim() !== '') {
          const matchStore = item.store_name && item.store_name.toLowerCase().includes(searchStore.trim().toLowerCase());
          if (!matchStore) return false;
        }

        return true;
      })
      .forEach((item) => {
        const barcode = item.barcode;
        const prodInfo = productMap[barcode];
        const name = prodInfo ? prodInfo.name : `(未登録: ${barcode})`;

        if (!map[barcode]) {
          map[barcode] = { name, inQty: 0, outQty: 0, outAmount: 0 };
        }

        if (item.type === '入庫') {
          map[barcode].inQty += item.quantity;
        } else if (item.type === '出庫') {
          map[barcode].outQty += item.quantity;
          const amount = item.total_amount !== undefined && item.total_amount !== null
            ? Number(item.total_amount)
            : (Number(item.unit_price || 0) * item.quantity);
          map[barcode].outAmount += amount;
        }
      });

    return Object.values(map);
  }, [historyList, selectedMonth, searchStore, productMap]);

  return (
    <main className="w-full max-w-full p-4 bg-gray-50 min-h-screen">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">入出庫まるとめ集計</h1>
        <Link 
          href="/" 
          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-sm font-bold text-sm transition"
        >
          ホーム
        </Link>
      </div>
      <hr className="mb-4" />

      {/* フィルターエリア */}
      <div className="bg-white p-3 rounded-xl border shadow-sm mb-4 space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">集計する月を選択</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-2 border rounded-lg text-base bg-gray-50 font-bold"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">店舗名で絞り込み</label>
          <input 
            type="text"
            placeholder="例: カパス"
            value={searchStore}
            onChange={(e) => setSearchStore(e.target.value)}
            className="w-full p-2 border rounded-lg text-base bg-gray-50 font-bold"
          />
        </div>
      </div>

      {/* 集計結果テーブル/リスト */}
      <h2 className="font-bold text-base mb-3">材料別 入出庫内訳 ({summaryData.length}件)</h2>
      {loading ? (
        <p className="text-center text-gray-500 py-8">読み込み中...</p>
      ) : summaryData.length === 0 ? (
        <p className="text-center text-gray-500 py-8">該当するデータはありません。</p>
      ) : (
        <div className="space-y-3">
          {summaryData.map((item) => (
            <div key={item.name} className="p-3 rounded-xl border shadow-sm bg-white flex flex-col gap-2">
              <div className="font-bold text-base text-gray-800">{item.name}</div>
              <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2 rounded-lg text-center text-xs">
                <div>
                  <span className="block text-gray-500 font-bold">入庫数</span>
                  <span className="text-blue-600 font-black text-sm">+{item.inQty} 個</span>
                </div>
                <div>
                  <span className="block text-gray-500 font-bold">出庫数</span>
                  <span className="text-green-600 font-black text-sm">-{item.outQty} 個</span>
                </div>
                <div>
                  <span className="block text-gray-500 font-bold">出庫金額</span>
                  <span className="text-gray-800 font-black text-sm">¥{item.outAmount.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}