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
  const scannerContainerRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(!hasNativeSupport);
  const detectorRef = useRef<any>(null);
  const html5ScannerRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);

  // Debounce scans - don't fire same barcode within 2 seconds
  const handleDetection = useCallback((barcode: string, format: string) => {
    if (barcode !== lastScanned) {
      setLastScanned(barcode);
      onScan(barcode, format);
      setTimeout(() => setLastScanned(null), 2000);
    }
  }, [lastScanned, onScan]);

  // Cleanup function
  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (html5ScannerRef.current) {
      try {
        html5ScannerRef.current.stop().catch(() => {});
      } catch {}
      html5ScannerRef.current = null;
    }
  }, []);

  // Initialize scanner
  useEffect(() => {
    if (!active) {
      cleanup();
      return;
    }

    async function startNativeScanner() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          // Initialize native detector
          try {
            // @ts-ignore
            detectorRef.current = new window.BarcodeDetector({ formats });
            setIsScanning(true);
            setCameraError(null);
            
            // Start scan loop
            const scanFrame = async () => {
              if (!videoRef.current || !detectorRef.current || !active) return;
              try {
                const barcodes = await detectorRef.current.detect(videoRef.current);
                if (barcodes.length > 0) {
                  handleDetection(barcodes[0].rawValue, barcodes[0].format);
                }
              } catch {}
              animationRef.current = requestAnimationFrame(scanFrame);
            };
            scanFrame();
          } catch (err) {
            console.warn('Native detector failed, switching to fallback');
            cleanup();
            startFallbackScanner();
          }
        }
      } catch (err) {
        const error = err as Error;
        setCameraError(error.message);
        onError?.(error);
      }
    }

    async function startFallbackScanner() {
      setUsingFallback(true);
      
      try {
        // Dynamically import html5-qrcode
        const { Html5Qrcode } = await import('html5-qrcode');
        
        if (!scannerContainerRef.current) return;
        
        // Create scanner element
        const scannerId = 'html5-barcode-scanner';
        let scannerEl = document.getElementById(scannerId);
        if (!scannerEl) {
          scannerEl = document.createElement('div');
          scannerEl.id = scannerId;
          scannerContainerRef.current.appendChild(scannerEl);
        }
        
        const html5Scanner = new Html5Qrcode(scannerId);
        html5ScannerRef.current = html5Scanner;
        
        await html5Scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.777,
          },
          (decodedText, decodedResult) => {
            handleDetection(decodedText, decodedResult.result.format?.formatName || 'unknown');
          },
          () => {} // Ignore errors during scanning
        );
        
        setIsScanning(true);
        setCameraError(null);
      } catch (err) {
        const error = err as Error;
        console.error('Fallback scanner error:', error);
        setCameraError(error.message || 'Failed to start camera');
        onError?.(error);
      }
    }

    if (hasNativeSupport) {
      startNativeScanner();
    } else {
      startFallbackScanner();
    }

    return cleanup;
  }, [active, formats, handleDetection, onError, cleanup]);

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

  // Fallback scanner UI
  if (usingFallback) {
    return (
      <div className="relative w-full max-w-lg mx-auto">
        <div 
          ref={scannerContainerRef}
          className="w-full rounded-lg overflow-hidden bg-black min-h-[300px]"
        />
        
        {/* Status indicator */}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center z-10">
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
            isScanning ? 'bg-green-500 text-white' : 'bg-amber-500 text-white'
          }`}>
            <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-white animate-pulse' : 'bg-amber-200'}`} />
            {isScanning ? 'Scanning...' : 'Loading camera...'}
          </div>
          
          {lastScanned && (
            <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-mono">
              ✓ {lastScanned}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Native scanner UI
  return (
    <div className="relative w-full max-w-lg mx-auto">
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
          <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-mono">
            ✓ {lastScanned}
          </div>
        )}
      </div>

      <div ref={scannerContainerRef} className="hidden" />
    </div>
  );
}
