import React, { useRef, useState, useCallback } from 'react';
import { Upload, X, Check, Pen, Trash2 } from 'lucide-react';

// API URL - should match the one in index.tsx
const GAS_URL = 'https://script.google.com/macros/s/AKfycbx7gVOloTlgAZ5NJalR5QRrEo8iRdc-rJWZiaiStu2KMU7hAXvicAJXUm2Jm5iCLZZn/exec';

interface DigitalSignatureUploadProps {
  userId: string;
  currentSignatureUrl?: string;
  onSuccess: (url: string, fileId: string) => void;
  onError: (error: string) => void;
  onClose?: () => void;
}

/**
 * Digital Signature Upload Component
 * - Draw signature on canvas
 * - Upload signature image
 * - Save to Google Drive via backend
 */
export const DigitalSignatureUpload: React.FC<DigitalSignatureUploadProps> = ({
  userId,
  currentSignatureUrl,
  onSuccess,
  onError,
  onClose
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [mode, setMode] = useState<'draw' | 'upload' | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize canvas for drawing
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    // Set drawing style
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Start drawing
  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);

  // Continue drawing
  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing]);

  // Stop drawing
  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }, []);

  // Handle image upload
  const handleImageUpload = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      onError('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadPreview(e.target?.result as string);
    };
    reader.onerror = () => onError('Failed to read file');
    reader.readAsDataURL(file);
  }, [onError]);

  // Save signature to backend
  const saveSignature = useCallback(async () => {
    setIsLoading(true);

    try {
      let base64Data: string;
      let mimeType: string;

      if (mode === 'draw') {
        const canvas = canvasRef.current;
        if (!canvas) {
          onError('Canvas not available');
          return;
        }
        base64Data = canvas.toDataURL('image/png').split(',')[1];
        mimeType = 'image/png';
      } else if (uploadPreview) {
        const match = uploadPreview.match(/^data:(.+);base64,(.+)$/);
        if (!match) {
          onError('Invalid image data');
          return;
        }
        mimeType = match[1];
        base64Data = match[2];
      } else {
        onError('No signature to save');
        return;
      }

      const response = await fetch(GAS_URL, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadDigitalSignature',
          userId,
          data: base64Data,
          fileName: `signature_${Date.now()}.${mimeType.split('/')[1] || 'png'}`,
          mimeType
        })
      });

      const result = await response.json();

      if (result.success) {
        onSuccess(result.url, result.fileId);
        setMode(null);
        setUploadPreview(null);
        setHasDrawn(false);
      } else {
        onError(result.error || 'Failed to save signature');
      }
    } catch (err) {
      onError('Network error saving signature');
    } finally {
      setIsLoading(false);
    }
  }, [mode, uploadPreview, userId, onSuccess, onError]);

  const handleClose = () => {
    setMode(null);
    setUploadPreview(null);
    setHasDrawn(false);
    onClose?.();
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-stone-800">Digital Signature</h2>
        {onClose && (
          <button onClick={handleClose} className="p-1 hover:bg-stone-100 rounded-full">
            <X size={20} className="text-stone-500" />
          </button>
        )}
      </div>

      {/* Current signature preview */}
      {currentSignatureUrl && !mode && (
        <div className="mb-4">
          <p className="text-xs text-stone-500 mb-2">Current Signature:</p>
          <div className="border border-stone-200 rounded-xl p-3 bg-stone-50">
            <img 
              src={currentSignatureUrl} 
              alt="Current signature" 
              className="max-h-24 mx-auto"
            />
          </div>
        </div>
      )}

      {!mode && (
        <div className="space-y-4">
          <p className="text-sm text-stone-600">
            Add your digital signature for official documents and forms.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => { setMode('draw'); setTimeout(initCanvas, 100); }}
              className="flex-1 bg-stone-800 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-stone-900 transition font-medium"
            >
              <Pen size={20} /> Draw Signature
            </button>
            <button
              onClick={() => { setMode('upload'); fileInputRef.current?.click(); }}
              className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium"
            >
              <Upload size={20} /> Upload Image
            </button>
          </div>
        </div>
      )}

      {mode === 'draw' && (
        <div className="space-y-4">
          <div className="border-2 border-stone-300 rounded-xl overflow-hidden bg-white">
            <canvas
              ref={canvasRef}
              className="w-full touch-none cursor-crosshair"
              style={{ height: '200px' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-500">Draw your signature above</p>
            {hasDrawn && (
              <button
                onClick={clearCanvas}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={14} /> Clear
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {hasDrawn && (
              <button
                onClick={saveSignature}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Check size={18} /> Save Signature</>
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

      {mode === 'upload' && (
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
              <p className="text-sm text-stone-600">Click to select signature image</p>
              <p className="text-xs text-stone-400 mt-1">PNG or JPG, max 5MB</p>
            </div>
          )}

          {uploadPreview && (
            <div className="space-y-3">
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50">
                <img 
                  src={uploadPreview} 
                  alt="Signature preview" 
                  className="max-h-32 mx-auto"
                />
              </div>
              <button
                onClick={() => { setUploadPreview(null); fileInputRef.current?.click(); }}
                className="text-sm text-stone-600 hover:text-stone-800 flex items-center gap-1 mx-auto"
              >
                <Upload size={14} /> Choose different image
              </button>
            </div>
          )}

          <div className="flex gap-2">
            {uploadPreview && (
              <button
                onClick={saveSignature}
                disabled={isLoading}
                className="flex-1 bg-emerald-600 text-white py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-700 transition font-medium disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <><Check size={18} /> Save Signature</>
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
