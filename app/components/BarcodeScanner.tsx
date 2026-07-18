'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 枠を広めに設定 (width: 350, height: 200)
    const config = { fps: 15, qrbox: { width: 350, height: 200 } };
    
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode("reader");
    }
    const html5QrCode = scannerRef.current;

    // 背面カメラを優先して起動
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScan(decodedText);
        // ここでは停止せず、親コンポーネントで停止させる
      },
      () => {} // エラーは無視
    ).catch((err) => {
      console.error("カメラ起動エラー:", err);
      alert("カメラを起動できませんでした。ブラウザの設定でカメラの使用を許可してください。");
    });

    return () => {
      // コンポーネントがアンマウントされた時だけ停止
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="w-full relative overflow-hidden rounded-xl border-4 border-gray-800 bg-black">
      <div id="reader" className="w-full scale-105 transform"></div>
      <style jsx global>{`
        #reader__scan_region {
          width: 100% !important;
          border: none !important;
        }
        #reader__scan_region video {
          object-fit: cover;
        }
        #reader__dashboard_section {
          display: none !important;
        }
      `}</style>
    </div>
  );
}