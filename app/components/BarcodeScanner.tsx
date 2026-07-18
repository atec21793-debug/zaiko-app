'use client';
import { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    // 枠を広めに設定
    const config = { fps: 10, qrbox: { width: 300, height: 150 } };
    
    // インスタンス作成
    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    // 起動：iPhoneのSafari対策として解像度をあえて指定しない
    html5QrCode.start(
      { facingMode: "environment" },
      config,
      (text) => {
        onScan(text);
      },
      () => {}
    ).catch((err) => {
      console.error("スキャナーエラー:", err);
      // 起動失敗時に画面をリロードせず、ユーザーに通知するだけにする
    });

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return <div id="reader" className="w-full"></div>;
}