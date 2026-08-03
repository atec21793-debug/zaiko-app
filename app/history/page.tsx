'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import Link from 'next/link';

export default function HistoryPage() {
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [productMap, setProductMap] = useState<{ [barcode: string]: { name: string; unit_price?: number } }>({});
  const [storeList, setStoreList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // スクロール位置を保持するための参照
  const scrollPositionRef = useRef<number>(0);

  // 今月の年月を YYYY-MM 形式で取得
  const todayStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(todayStr); 

  const [activeTab, setActiveTab] = useState<'all' | '出庫' | '入庫'>('all');
  const [searchStore, setSearchStore] = useState('');
  const [searchMaterial, setSearchMaterial] = useState('');

  // 編集用の状態（単価・個数・店舗名）
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editUnitPrice, setEditUnitPrice] = useState<number>(0);
  const [editQuantity, setEditQuantity] = useState<number>(0);
  const [editStoreName, setEditStoreName] = useState<string>('');

  // 履歴データ、製品マスタ、店舗一覧を取得
  const fetchData = async (preserveScroll = false) => {
    if (preserveScroll) {
      scrollPositionRef.current = window.scrollY;
    } else {
      setLoading(true);
    }
    
    // 1. 製品マスタ取得（unit_priceも一緒に取得して単価の初期値候補にする）
    const { data: prodData } = await supabase.from('products').select('*');
    const map: { [barcode: string]: { name: string; unit_price?: number } } = {};
    if (prodData) {
      prodData.forEach((p) => {
        map[p.barcode] = { name: p.name, unit_price: p.unit_price };
      });
    }
    setProductMap(map);

    // 2. 店舗一覧取得
    const { data: invData } = await supabase.from('inventory').select('store_name');
    if (invData) {
      const stores = Array.from(new Set(invData.map((item) => item.store_name).filter(Boolean)));
      setStoreList(stores);
    }

    // 3. 履歴取得
    const { data: histData, error } = await supabase
      .from('history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching history:', error);
    } else if (histData) {
      setHistoryList(histData);
    }
    setLoading(false);

    if (preserveScroll) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current);
      });
    }
  };

  useEffect(() => {
    fetchData(false);
  }, []);

  const handleDelete = async (item: any) => {
    const prodInfo = productMap[item.barcode];
    const itemName = prodInfo ? prodInfo.name : item.barcode;
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
    fetchData(true);
  };

  // 店舗を変更したときに、その店舗におけるその商品の単価を自動で取得してセットする関数
  const handleStoreChangeForEdit = async (barcode: string, newStore: string) => {
    setEditStoreName(newStore);
    if (!barcode || !newStore) return;

    // 1. まず inventory テーブルから該当店舗・該当商品の単価があればそれを取得する
    const { data: invData } = await supabase
      .from('inventory')
      .select('unit_price')
      .eq('barcode', barcode)
      .eq('store_name', newStore)
      .maybeSingle();

    if (invData && invData.unit_price !== null && invData.unit_price !== undefined) {
      setEditUnitPrice(Number(invData.unit_price));
      return;
    }

    // 2. inventory に単価がなければ、直近の history から同じ店舗・商品の出庫単価を探す
    const { data: histData } = await supabase
      .from('history')
      .select('unit_price')
      .eq('barcode', barcode)
      .eq('store_name', newStore)
      .eq('type', '出庫')
      .not('unit_price', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (histData && histData.length > 0 && histData[0].unit_price !== null) {
      setEditUnitPrice(Number(histData[0].unit_price));
      return;
    }

    // 3. それも見つからなければ、製品マスタ（products）の基本単価があればそれを設定する
    const prodInfo = productMap[barcode];
    if (prodInfo && prodInfo.unit_price !== undefined && prodInfo.unit_price !== null) {
      setEditUnitPrice(Number(prodInfo.unit_price));
    }
  };

  const handleSaveEdit = async (item: any) => {
    const newUnitPrice = Number(editUnitPrice);
    const newQuantity = Number(editQuantity);
    const newStore = editStoreName.trim();

    if (isNaN(newUnitPrice) || newUnitPrice < 0) {
      alert('正しい単価を入力してください');
      return;
    }
    if (isNaN(newQuantity) || newQuantity <= 0) {
      alert('数量は1以上を入力してください');
      return;
    }
    if (!newStore) {
      alert('店舗名を選択してください');
      return;
    }

    const newTotalAmount = item.type === '出庫' ? newUnitPrice * newQuantity : (item.total_amount || 0);

    const updatePayload: any = {
      quantity: newQuantity,
      store_name: newStore,
    };

    if (item.type === '出庫') {
      updatePayload.unit_price = newUnitPrice;
      updatePayload.total_amount = newTotalAmount;
    }

    const { error } = await supabase
      .from('history')
      .update(updatePayload)
      .eq('id', item.id);

    if (error) {
      alert('履歴の修正に失敗しました: ' + error.message);
    } else {
      alert('履歴を修正しました！');
      setEditingId(null);
      fetchData(true);
    }
  };

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

  const filteredHistory = useMemo(() => {
    return historyList.filter((item) => {
      if (activeTab !== 'all' && item.type !== activeTab) {
        return false;
      }

      const itemMonthStr = getItemMonthStr(item.created_at);
      if (selectedMonth && itemMonthStr !== selectedMonth) {
        return false;
      }

      if (searchStore.trim() !== '') {
        const storeMatch = item.store_name && item.store_name.toLowerCase().includes(searchStore.trim().toLowerCase());
        if (!storeMatch) return false;
      }

      if (searchMaterial.trim() !== '') {
        const prodInfo = productMap[item.barcode];
        const productName = prodInfo ? prodInfo.name : item.barcode;
        const materialMatch = productName.toLowerCase().includes(searchMaterial.trim().toLowerCase());
        if (!materialMatch) return false;
      }

      return true;
    });
  }, [historyList, activeTab, selectedMonth, searchStore, searchMaterial, productMap]);

  return (
    <main className="w-full max-w-full p-4 bg-gray-50 min-h-screen">
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

      <div className="bg-white p-3 rounded-xl border shadow-sm mb-4 space-y-3">
        <div>
          <label className="block text-xs font-bold text-gray-600 mb-1">表示する月を選択</label>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full p-2 border rounded-lg text-base bg-gray-50 font-bold"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
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
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1">材料名で絞り込み</label>
            <input 
              type="text"
              placeholder="例: ダクト"
              value={searchMaterial}
              onChange={(e) => setSearchMaterial(e.target.value)}
              className="w-full p-2 border rounded-lg text-base bg-gray-50 font-bold"
            />
          </div>
        </div>
      </div>

      <div className="flex rounded-xl bg-gray-200 p-1 mb-4 font-bold text-sm">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex-1 py-2 rounded-lg transition ${
            activeTab === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          すべて
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('出庫')}
          className={`flex-1 py-2 rounded-lg transition ${
            activeTab === '出庫' ? 'bg-white text-green-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          出庫のみ
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('入庫')}
          className={`flex-1 py-2 rounded-lg transition ${
            activeTab === '入庫' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          入庫のみ
        </button>
      </div>

      <h2 className="font-bold text-base mb-3">入出庫履歴 ({filteredHistory.length}件)</h2>
      {loading ? (
        <p className="text-center text-gray-500 py-8">読み込み中...</p>
      ) : filteredHistory.length === 0 ? (
        <p className="text-center text-gray-500 py-8">該当する履歴はありません。</p>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((item) => {
            const prodInfo = productMap[item.barcode];
            const productName = prodInfo ? prodInfo.name : `(未登録: ${item.barcode})`;
            
            const unitPrice = item.unit_price !== undefined && item.unit_price !== null ? Number(item.unit_price) : 0;
            const totalAmount = item.total_amount !== undefined && item.total_amount !== null ? Number(item.total_amount) : (unitPrice * item.quantity);
            const isEditing = editingId === item.id;

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

                {!isEditing ? (
                  <>
                    <div className="flex justify-between font-bold text-gray-800">
                      <span className="text-base">{productName}</span>
                      <span>{item.quantity} 個</span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-600 items-center">
                      <span>店舗: {item.store_name}</span>
                      <div className="flex items-center gap-2">
                        <span>担当: {item.user_name || '-'}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(item.id);
                            setEditUnitPrice(unitPrice);
                            setEditQuantity(item.quantity);
                            setEditStoreName(item.store_name || '');
                          }}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold text-[11px] border"
                        >
                          内容を修正
                        </button>
                      </div>
                    </div>

                    {item.type === '出庫' && (
                      <div className="mt-1 pt-2 border-t border-gray-100 text-xs font-bold text-gray-700">
                        金額: ¥{totalAmount.toLocaleString()} (単価: ¥{unitPrice.toLocaleString()})
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-2 bg-gray-50 p-3 rounded-lg border mt-1">
                    <div className="text-xs font-bold text-gray-800 mb-1">{productName} の修正</div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-0.5">数量</label>
                        <input
                          type="number"
                          value={editQuantity}
                          onChange={(e) => setEditQuantity(Number(e.target.value))}
                          className="w-full p-1.5 border rounded text-xs bg-white font-bold"
                          min="1"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-0.5">店舗名</label>
                        <select
                          value={editStoreName}
                          onChange={(e) => handleStoreChangeForEdit(item.barcode, e.target.value)}
                          className="w-full p-1.5 border rounded text-xs bg-white font-bold"
                        >
                          <option value="">店舗を選択</option>
                          {storeList.map((store) => (
                            <option key={store} value={store}>
                              {store}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {item.type === '出庫' && (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 mb-0.5">単価（店舗変更で自動反映）</label>
                        <input
                          type="number"
                          value={editUnitPrice}
                          onChange={(e) => setEditUnitPrice(Number(e.target.value))}
                          className="w-full p-1.5 border rounded text-xs bg-white font-bold text-green-700"
                          min="0"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-bold text-xs"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item)}
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold text-xs shadow-xs"
                      >
                        保存
                      </button>
                    </div>
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