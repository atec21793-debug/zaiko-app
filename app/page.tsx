import Link from 'next/link';

export default function Home() {
  const menuItems = [
    { name: '入庫', href: '/inbound', color: 'bg-gray-800' },
    { name: '出庫', href: '/outbound', color: 'bg-gray-800' },
    { name: '材料管理', href: '/manage', color: 'bg-gray-800' },
    { name: '履歴', href: '/history', color: 'bg-gray-800' },
    { name: '在庫一覧', href: '/inventory', color: 'bg-gray-800' },
    { name: '集計', href: '/summary', color: 'bg-gray-800' }, 
  ];

  return (
    <main className="min-h-screen p-4 bg-gray-50 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6 text-center text-gray-800">在庫管理</h1>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(0, 2).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full`}>
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        {menuItems.slice(2, 4).map((item) => (
          <Link key={item.name} href={item.href} className={`${item.color} text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full`}>
            {item.name}
          </Link>
        ))}
      </div>

      {/* 在庫一覧 (左) と 集計 (右) の行 */}
      {/* その下にそれぞれ「佐々木」「管理」を配置して2カラムを維持 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 左列：在庫一覧 ＆ 佐々木 */}
        <div className="flex flex-col gap-4">
          <Link href={menuItems[4].href} className={`${menuItems[4].color} text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full`}>
            {menuItems[4].name}
          </Link>
          <Link href="/user/佐々木" className="bg-gray-800 text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full">
            佐々木
          </Link>
        </div>

        {/* 右列：集計 ＆ 管理 */}
        <div className="flex flex-col gap-4">
          <Link href={menuItems[5].href} className={`${menuItems[5].color} text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full`}>
            {menuItems[5].name}
          </Link>
          <Link href="/manage" className="bg-gray-800 text-white h-24 flex items-center justify-center rounded-xl text-lg font-bold shadow-lg w-full">
            管理
          </Link>
        </div>
      </div>
    </main>
  );
}