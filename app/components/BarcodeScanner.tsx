'use client';
import { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  useEffect(() => {
    // 1. qrboxを画面幅に合わせて大きめに設定
    // 2. 読み取り速度を上げるためfpsを少し高めに設定
    const config = { 
      fps: 20, 
      qrbox: { width: 350, height: 200 }, // 枠を大きくしました
      aspectRatio: 1.0,
      disableFlip: false 
    };
    
    const html5QrCode = new Html5Qrcode("reader");

    // iPhoneでの高速起動のため、constraintsで解像度を640pxに固定します
    const cameraConfig = {
      facingMode: { ideal: "environment" },
      width: { ideal: 640 },
      height: { ideal: 480 }
    };

    html5QrCode.start(
      cameraConfig,
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
    <div className="w-full relative">
      <div id="reader" className="w-full"></div>
      {/* CSSで読み取り領域をさらに広げる */}
      <style jsx global>{`
        #reader__scan_region {
          width: 100% !important;
          background-color: transparent !important;
        }
        #reader__scan_region img {
          display: none !important;
        }
      `}</style>
    </div>
  );
}