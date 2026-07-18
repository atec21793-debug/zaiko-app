'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 枠サイズを大きめに設定
    const config = { fps: 15, qrbox: { width: 300, height: 150 } };
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    // 解像度を落として負荷を激減させる設定
    const cameraConfig = {
      facingMode: "environment",
      width: { ideal: 640 },
      height: { ideal: 480 }
    };

    html5QrCode.start(
      cameraConfig,
      config,
      (text) => {
        onScan(text);
      },
      () => {}
    ).catch((err) => console.log("カメラ起動エラー:", err));

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div id="reader" className="w-full">
      <style jsx global>{`
        #reader__scan_region { width: 100% !important; }
        #reader__dashboard_section { display: none !important; }
      `}</style>
    </div>
  );
}