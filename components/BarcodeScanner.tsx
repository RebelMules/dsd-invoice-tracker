'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface BarcodeScannerProps {
  onScan: (barcode: string, format: string) => void;
  onError?: (error: Error) => void;
  formats?: string[];
  active?: boolean;
}

// Check if native BarcodeDetector is available
const hasNativeSupport = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export default function BarcodeScanner({
  onScan,
  onError,
  formats = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'],
  active = true,
}: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const detectorRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // Debounce scans - don't fire same barcode within 2 seconds
  const handleDetection = useCallback((barcode: string, format: string) => {
    if (barcode !== lastScanned) {
      setLastScanned(barcode);
      onScan(barcode, format);
      // Reset after 2 seconds to allow re-scanning same item
      setTimeout(() => setLastScanned(null), 2000);
    }
  }, [lastScanned, onScan]);

  // Initialize camera
  useEffect(() => {
    if (!active) return;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Back camera on mobile
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsScanning(true);
          setCameraError(null);
        }
      } catch (err) {
        const error = err as Error;
        setCameraError(error.message);
        onError?.(error);
      }
    }

    startCamera();

    return () => {
      // Cleanup camera on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, onError]);

  // Initialize barcode detector and scan loop
  useEffect(() => {
    if (!isScanning || !active) return;

    async function initDetector() {
      if (hasNativeSupport) {
        // Use native BarcodeDetector
        try {
          // @ts-ignore - BarcodeDetector not in all TS libs yet
          detectorRef.current = new window.BarcodeDetector({ formats });
        } catch (err) {
          console.warn('Native BarcodeDetector failed, would fall back to ZXing');
          // TODO: Add ZXing fallback for Safari/Firefox
        }
      } else {
        // TODO: Load ZXing-js dynamically for unsupported browsers
        console.warn('BarcodeDetector not supported, ZXing fallback needed');
      }
    }

    async function scanFrame() {
      if (!videoRef.current || !detectorRef.current || !active) return;

      try {
        const barcodes = await detectorRef.current.detect(videoRef.current);
        
        if (barcodes.length > 0) {
          const { rawValue, format } = barcodes[0];
          handleDetection(rawValue, format);
        }
      } catch (err) {
        // Silently ignore detection errors (common during camera init)
      }

      // Continue scanning
      animationRef.current = requestAnimationFrame(scanFrame);
    }

    initDetector().then(() => {
      if (detectorRef.current) {
        scanFrame();
      }
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, active, formats, handleDetection]);

  if (cameraError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg border-2 border-red-200">
        <div className="text-red-600 text-lg font-semibold mb-2">Camera Error</div>
        <div className="text-red-500 text-sm text-center">{cameraError}</div>
        <div className="text-gray-500 text-xs mt-4">
          Make sure camera permissions are enabled
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Video feed */}
      <video
        ref={videoRef}
        className="w-full rounded-lg bg-black"
        playsInline
        muted
      />
      
      {/* Scanning overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-3/4 h-24 border-2 border-green-400 rounded-lg bg-green-400/10">
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-green-400 animate-pulse" />
        </div>
      </div>

      {/* Status indicator */}
      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center">
        <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
          isScanning ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'
        }`}>
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-white animate-pulse' : 'bg-gray-300'}`} />
          {isScanning ? 'Scanning...' : 'Initializing...'}
        </div>
        
        {lastScanned && (
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm">
            ✓ {lastScanned}
          </div>
        )}
      </div>

      {/* Hidden canvas for processing if needed */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Browser support warning */}
      {!hasNativeSupport && (
        <div className="mt-2 text-xs text-amber-600 text-center">
          ⚠️ Your browser doesn't support native barcode detection. Loading fallback...
        </div>
      )}
    </div>
  );
}
