'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

interface Props {
  onScan: (decodedText: string) => void
}

export default function BarcodeScanner({ onScan }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    const scannerId = 'reader-container'
    const html5QrCode = new Html5Qrcode(scannerId)
    scannerRef.current = html5QrCode

    // 少し遅延を入れてDOMが確実に描画されてからカメラを起動
    const timer = setTimeout(() => {
      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 } },
          (decodedText) => {
            html5QrCode
              .stop()
              .then(() => onScan(decodedText))
              .catch(() => onScan(decodedText))
          },
          () => {}
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
    <div className="w-full flex flex-col items-center">
      {/* 確実にレンダリングされる固定IDのコンテナ */}
      <div id="reader-container" className="w-full rounded-lg overflow-hidden bg-black"></div>
    </div>
  )
}