'use client';
import { useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan }: { onScan: (text: string) => void }) {
  useEffect(() => {
    // ID "reader" の要素を作成
    const config = { fps: 10, qrbox: { width: 250, height: 100 } };
    const html5QrCode = new Html5Qrcode("reader");

    // 背面カメラ(environment)を指定して起動
    html5QrCode.start(
      { facingMode: { exact: "environment" } },
      config,
      (decodedText) => {
        onScan(decodedText);
        html5QrCode.stop();
      },
      (errorMessage) => {
        // 読み取り中のエラーは無視
      }
    ).catch((err) => {
      // 背面カメラがない場合、デフォルトのカメラで再試行
      html5QrCode.start(
        { facingMode: "user" },
        config,
        (decodedText) => {
          onScan(decodedText);
          html5QrCode.stop();
        },
        () => {}
      ).catch((err) => console.error("カメラ起動失敗:", err));
    });

    return () => {
      if (html5QrCode.isScanning) {
        html5QrCode.stop().catch(() => {});
      }
    };
  }, [onScan]);

  return <div id="reader" className="w-full"></div>;
}