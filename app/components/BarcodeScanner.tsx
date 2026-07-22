'use client'

interface Props {
  onScan: (decodedText: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  // スマホの標準カメラでバーコードや写真を撮影して読み取る方式
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      // html5-qrcodeを使って画像ファイルからバーコードをデコードする
      const { Html5Qrcode } = await import('html5-qrcode')
      const html5QrCode = new Html5Qrcode('reader-file-container')
      const decodedText = await html5QrCode.scanFile(file, true)
      onScan(decodedText)
    } catch (err) {
      alert('バーコードの読み取りに失敗しました。もう一度撮影してください。')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md flex flex-col items-center space-y-4">
        <h3 className="text-lg font-bold">バーコードを撮影・スキャン</h3>
        <p className="text-xs text-gray-500 text-center">
          下のボタンを押してカメラを起動し、バーコードを撮影してください。
        </p>

        {/* 隠しコンテナ */}
        <div id="reader-file-container" className="hidden"></div>

        {/* スマホのカメラを直接起動するネイティブ入力 */}
        <label className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold text-center cursor-pointer shadow-md">
          カメラを起動して撮影
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-gray-300 text-gray-700 py-3 rounded-xl font-bold"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}