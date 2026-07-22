import Link from 'next/link';

export default function Home() {
  const menuItems = [
    { name: '入庫', href: '/inbound', color: 'bg-blue-600' },
    { name: '出庫', href: '/outbound', color: 'bg-green-600' },
    { name: '材料管理', href: '/products', color: 'bg-orange-600' },
    { name: '履歴・集計', href: '/history', color: 'bg-purple-600' },
    { name: '在庫一覧', href: '/inventory', color: 'bg-indigo-600' },
  ];

  return (
    <main className="min-h-screen p-4 bg-gray-50 max-w-md mx-auto">
      <h1 className="text-2xl font-black mb-6 text-center text-gray-800">在庫管理システム</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(0, 2).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-32 flex items-center justify-center rounded-xl text-xl font-bold shadow-lg transition active:scale-95`}>
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(2, 4).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-32 flex items-center justify-center rounded-xl text-xl font-bold shadow-lg transition active:scale-95`}>
            {item.name}
          </Link>
        ))}
      </div>

      <div className="w-full">
        <Link href={menuItems[4].href} className={`${menuItems[4].color} text-white h-24 flex items-center justify-center rounded-xl text-xl font-bold shadow-lg transition active:scale-95`}>
          {menuItems[4].name}
        </Link>
      </div>
    </main>
  );
}