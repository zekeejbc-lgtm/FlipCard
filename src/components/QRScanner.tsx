import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';
import jsQR from 'jsqr';

// API URL - should match the one in index.tsx
const GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';

interface QRScannerProps {
  userId: string;
  onSuccess: (qrText: string) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

/**
 * QR Code Scanner & Uploader Component
 * - Scan QR codes using device camera
 * - Upload QR code image and extract text
 * - Save extracted text to backend
 */
export const QRScanner: React.FC<QRScannerProps> = ({ userId, onSuccess, onError, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [scanMode, setScanMode] = useState<'instructions' | 'camera' | 'upload' | null>('instructions');
  const [isScanning, setIsScanning] = useState(false);
  const [scannedText, setScannedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      stopCamera();
    };
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  }, []);

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setIsScanning(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      onError('Unable to access camera. Please check permissions.');
      setIsScanning(false);
    }
  }, [onError]);

  // Scan QR from camera continuously using jsQR
  useEffect(() => {
    if (!isScanning || scanMode !== 'camera') return;

    const detectQR = () => {
      if (!videoRef.current || !canvasRef.current) {
        animationFrameRef.current = requestAnimationFrame(detectQR);
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert'
        });

        if (qrCode && qrCode.data) {
          setScannedText(qrCode.data);
          stopCamera();
          return; // Stop scanning once QR is found
        }
      }

      animationFrameRef.current = requestAnimationFrame(detectQR);
    };

    animationFrameRef.current = requestAnimationFrame(detectQR);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, scanMode, stopCamera]);

  // Handle image upload and extract QR using jsQR
  const handleImageUpload = useCallback(async (file: File) => {
    setUploadPreview(null);
    setScannedText('');
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        setUploadPreview(dataUrl);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            onError('Canvas not supported');
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });

          if (qrCode && qrCode.data) {
            setScannedText(qrCode.data);
          } else {
            onError('No QR code found in image. You can manually enter the text below.');
          }
        };
        img.onerror = () => onError('Failed to load image');
        img.src = dataUrl;
      };
      reader.onerror = () => onError('Failed to read file');
      reader.readAsDataURL(file);
    } catch (err) {
      onError('Failed to process file');
    }
  }, [onError]);

  // Save scanned QR text to backend
  const saveQRText = useCallback(async () => {
    if (!scannedText.trim()) {
      onError('QR text cannot be empty');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'saveScannedQRCode',
          userId,
          qrCodeText: scannedText
        })
      });

      const result = await response.json();
      if (result.success) {
        onSuccess(scannedText);
        setScannedText('');
        setScanMode(null);
        setUploadPreview(null);
      } else {
        onError(result.error || 'Failed to save QR code');
      }
    } catch (err) {
      onError('Network error saving QR code');
    } finally {
      setIsLoading(false);
    }
  }, [scannedText, userId, onSuccess, onError]);

  const handleClose = () => {
    stopCamera();
    setScanMode(null);
    setScannedText('');
    setUploadPreview(null);
    onClose?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-stone-800">Scan School QR Code</h2>
        {onClose && (
          <button onClick={handleClose} className="p-1 hover:bg-stone-100 rounded-full">
            <X size={20} className="text-stone-500" />
          </button>
        )}
      </div>

      {scanMode === 'instructions' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 text-blue-600 font-bold text-lg mt-1">1</div>
              <div>
                <p className="text-sm font-medium text-blue-900">Visit USEP Attendance System</p>
                <p className="text-xs text-blue-700 mt-1">Go to your student profile to find your QR code</p>
              </div>
            </div>
            
            <a
              href="https://usep-qrattendance.site/public/login?page=StudentProfile"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open Attendance System
            </a>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 text-amber-600 font-bold text-lg mt-1">2</div>
              <div>
                <p className="text-sm font-medium text-amber-900">Scan or Upload Your QR Code</p>
                <p className="text-xs text-amber-700 mt-1">Use your device camera or upload a screenshot</p>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <div className="flex-shrink-0 text-emerald-600 font-bold text-lg mt-1">3</div>
              <div>
                <p className="text-sm font-medium text-emerald-900">Save to Your Profile</p>
                <p className="text-xs text-emerald-700 mt-1">Your QR code will be linked to your account</p>
              </div>
            </div>
          </div>

          <button
            onClick={() => setScanMode(null)}
            className="w-full bg-stone-800 text-white py-3 rounded-xl hover:bg-stone-900 transition font-medium"
          >
            Continue to Scanner
          </button>
        </div>
      )}

      {!scanMode && scanMode !== 'instructions' && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Ready to scan your school ID QR code from the USEP Attendance System?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setScanMode('camera'); startCamera(); }}
              className="flex-1 bg-stone-800 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-900 transition font-medium"
            >
              <Camera size={20} /> Use Camera
            </button>
            <button
              onClick={() => { setScanMode('upload'); fileInputRef.current?.click(); }}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium"
            >
              <Upload size={20} /> Upload Image
            </button>
          </div>
        </div>
      )}

      {scanMode === 'camera' && (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden bg-stone-900">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full"
              style={{ aspectRatio: '4/3' }}
            />
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-white/50 rounded-lg">
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                </div>
              </div>
            )}
          </div>
          <canvas ref={canvasRef} className="hidden" />
          
          {isScanning && !scannedText && (
            <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-sm text-amber-700 flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span>Scanning... Point camera at QR code</span>
            </div>
          )}

          {scannedText && (
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
              <p className="text-xs text-stone-600 mb-1 font-medium">✓ QR Code Detected:</p>
              <p className="font-mono text-sm text-emerald-700 break-all">{scannedText}</p>
            </div>
          )}

          <div className="flex gap-2">
            {scannedText && (
              <button
                onClick={saveQRText}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Check size={18} /> Save QR Code</>
                )}
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-300 transition font-medium"
            >
              <X size={18} /> Cancel
            </button>
          </div>
        </div>
      )}

      {scanMode === 'upload' && (
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleImageUpload(e.target.files[0]);
              }
            }}
            className="hidden"
          />

          {!uploadPreview && (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 rounded-xl p-8 text-center cursor-pointer hover:border-stone-400 transition"
            >
              <Upload size={32} className="mx-auto text-stone-400 mb-2" />
              <p className="text-sm text-stone-600">Click to select QR code image</p>
            </div>
          )}

          {uploadPreview && (
            <>
              <img src={uploadPreview} alt="QR Preview" className="w-full rounded-xl border border-stone-200" />
              
              {scannedText ? (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
                  <p className="text-xs text-stone-600 mb-1 font-medium">✓ QR Code Detected:</p>
                  <p className="font-mono text-sm text-emerald-700 break-all">{scannedText}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-stone-700">
                    QR not detected. Enter text manually:
                  </label>
                  <textarea
                    value={scannedText}
                    onChange={(e) => setScannedText(e.target.value)}
                    placeholder="Paste or type the QR code text here..."
                    className="w-full p-3 border border-stone-300 rounded-xl text-sm font-mono focus:ring-2 focus:ring-stone-400 outline-none"
                    rows={3}
                  />
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            {scannedText && (
              <button
                onClick={saveQRText}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Check size={18} /> Save QR Code</>
                )}
              </button>
            )}
            <button
              onClick={handleClose}
              className="flex-1 bg-stone-200 text-stone-700 py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-300 transition font-medium"
            >
              <X size={18} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
