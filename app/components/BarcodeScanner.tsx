'use client';
import { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  useEffect(() => {
    // 枠を広めに設定
    const config = { 
      fps: 15, 
      qrbox: { width: 350, height: 200 } 
    };
    
    const html5QrCode = new Html5Qrcode("reader");

    // iPhoneで最も安定する最低限の設定
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (decodedText) => {
        onScan(decodedText);
        // スキャン成功時に停止
        html5QrCode.stop().catch(() => {});
      },
      () => {} // エラーは無視
    ).catch((err) => {
      console.error("カメラ起動エラー:", err);
      alert("カメラを起動できませんでした。ブラウザのカメラ権限を確認してください。");
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="w-full relative overflow-hidden rounded-lg border-2 border-blue-500">
      <div id="reader" className="w-full"></div>
      <style jsx global>{`
        #reader__scan_region {
          width: 100% !important;
        }
        #reader__dashboard_section {
          display: none !important;
        }
      `}</style>
    </div>
  );
}