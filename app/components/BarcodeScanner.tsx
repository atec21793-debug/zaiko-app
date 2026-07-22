'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (decodedText: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const scannerId = 'realtime-reader'
    const html5QrCode = new Html5Qrcode(scannerId)
    scannerRef.current = html5QrCode

    // 少し遅延を入れて要素が確実に描画されてからカメラを起動
    const timer = setTimeout(() => {
      html5QrCode
        .start(
          { facingMode: 'environment' }, // スマホの背面カメラを指定
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
          },
          (decodedText) => {
            // 読み取り成功時の処理
            html5QrCode
              .stop()
              .then(() => {
                onScan(decodedText)
              })
              .catch(() => {
                onScan(decodedText)
              })
          },
          () => {
            // スキャン中（バーコード未検出）のエラーは無視して続行
          }
        )
        .catch((err) => {
          console.error('Camera start error:', err)
          alert('カメラの起動に失敗しました。ブラウザのカメラ権限を確認してください。')
        })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(() => {})
      }
    }
  }, [onScan])

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-xl p-4 w-full max-w-md flex flex-col items-center">
        <h3 className="text-lg font-bold mb-2">バーコードをかざしてください</h3>
        {/* リアルタイム映像が映る領域 */}
        <div id="realtime-reader" className="w-full rounded-lg overflow-hidden mb-4 bg-black"></div>
        <button
          type="button"
          onClick={() => {
            if (scannerRef.current && scannerRef.current.isScanning) {
              scannerRef.current
                .stop()
                .then(() => onClose())
                .catch(() => onClose())
            } else {
              onClose()
            }
          }}
          className="w-full bg-red-600 text-white py-3 rounded-xl font-bold"
        >
          閉じる
        </button>
      </div>
    </div>
  )
}