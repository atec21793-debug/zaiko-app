import Link from 'next/link';

export default function Home() {
  const menuItems = [
    { name: '入庫', href: '/inbound', color: 'bg-gray-800' },
    { name: '出庫', href: '/outbound', color: 'bg-gray-800' },
    { name: '材料管理', href: '/products', color: 'bg-gray-800' },
    { name: '履歴・集計', href: '/history', color: 'bg-gray-800' },
    { name: '在庫一覧', href: '/inventory', color: 'bg-gray-800' },
  ];

  return (
    <main className="min-h-screen p-4 bg-gray-50 max-w-md mx-auto">
      <h1 className="text-xl font-bold mb-6 text-center">在庫管理システム</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(0, 2).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-32 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg`}>
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(2, 4).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-32 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg`}>
            {item.name}
          </Link>
        ))}
      </div>

      <div className="w-full">
        <Link href={menuItems[4].href} className={`${menuItems[4].color} text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg`}>
          {menuItems[4].name}
        </Link>
      </div>
    </main>
  );
}