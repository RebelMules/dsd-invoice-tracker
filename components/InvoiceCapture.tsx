'use client';

import { useRef, useState } from 'react';

interface InvoiceCaptureProps {
  onCapture: (imageBlob: Blob, preview: string) => void;
  onCancel: () => void;
}

export default function InvoiceCapture({ onCapture, onCancel }: InvoiceCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Start camera on mount
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setIsLoading(false);
    }
  };

  // Initialize camera
  useState(() => {
    startCamera();
  });

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Set canvas to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    
    // Get preview URL
    const previewUrl = canvas.toDataURL('image/jpeg', 0.9);
    setPreview(previewUrl);
    
    // Stop camera while reviewing
    stopCamera();
  };

  const confirmCapture = () => {
    if (!canvasRef.current || !preview) return;
    
    canvasRef.current.toBlob((blob) => {
      if (blob) {
        onCapture(blob, preview);
      }
    }, 'image/jpeg', 0.9);
  };

  const retake = () => {
    setPreview(null);
    startCamera();
  };

  const handleCancel = () => {
    stopCamera();
    onCancel();
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="bg-black/80 text-white p-4 flex items-center justify-between">
        <button
          onClick={handleCancel}
          className="px-4 py-2 text-white/80 hover:text-white"
        >
          Cancel
        </button>
        <h2 className="font-semibold">Capture Invoice</h2>
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Camera/Preview area */}
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {preview ? (
          // Show captured image preview
          <img
            src={preview}
            alt="Invoice preview"
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          // Show camera feed
          <>
            <video
              ref={videoRef}
              className="max-h-full max-w-full object-contain"
              playsInline
              muted
              autoPlay
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-white">Starting camera...</div>
              </div>
            )}
            {/* Guide overlay */}
            <div className="absolute inset-8 border-2 border-white/30 rounded-lg pointer-events-none">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-sm px-3 py-1 rounded-full">
                Align invoice within frame
              </div>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black/80 p-6 flex items-center justify-center gap-6">
        {preview ? (
          // Review controls
          <>
            <button
              onClick={retake}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 text-white rounded-xl font-semibold"
            >
              Retake
            </button>
            <button
              onClick={confirmCapture}
              className="px-8 py-3 bg-green-500 hover:bg-green-400 text-white rounded-xl font-semibold"
            >
              Use Photo
            </button>
          </>
        ) : (
          // Capture button
          <button
            onClick={capturePhoto}
            disabled={isLoading}
            className="w-20 h-20 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 disabled:opacity-50 transition-all active:scale-95"
          >
            <div className="w-16 h-16 bg-white border-4 border-gray-300 rounded-full" />
          </button>
        )}
      </div>

      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
