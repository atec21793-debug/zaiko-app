'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 枠サイズを大きめに設定
    const config = { fps: 20, qrbox: { width: 350, height: 200 } };
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    // カメラ起動（環境設定をシンプルにして起動を優先）
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (text) => {
        onScan(text);
      },
      () => {}
    ).catch(console.error);

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return (
    <div className="w-full overflow-hidden rounded-xl border-4 border-gray-800">
      <div id="reader" className="w-full"></div>
      <style jsx global>{`
        #reader__scan_region { width: 100% !important; }
        #reader__dashboard_section { display: none !important; }
      `}</style>
    </div>
  );
}