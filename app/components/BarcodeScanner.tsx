'use client';
import { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  useEffect(() => {
    // 枠のサイズを大きく設定 (width: 300, height: 200)
    const config = { 
      fps: 15, 
      qrbox: { width: 300, height: 150 },
      aspectRatio: 1.0
    };
    
    const html5QrCode = new Html5Qrcode("reader");

    // facingMode: "environment" (背面カメラ) を推奨
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScan(decodedText);
        html5QrCode.stop().catch(() => {});
      },
      () => {}
    ).catch((err) => {
      console.error("カメラ起動エラー:", err);
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="w-full overflow-hidden rounded-lg border-2 border-blue-500">
      <div id="reader" className="w-full"></div>
      <style jsx global>{`
        #reader__scan_region {
          width: 100% !important;
        }
        #reader__dashboard_section {
          display: none; /* 余計なボタンを非表示にしてスッキリさせる */
        }
      `}</style>
    </div>
  );
}