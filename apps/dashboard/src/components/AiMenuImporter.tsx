import { useState } from 'react';
import { Sparkles, Upload, Wand2, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function AiMenuImporter({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'UPLOAD' | 'PROCESSING' | 'REVIEW'>('UPLOAD');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
    }
  };

  const processImage = async () => {
    if (!file) return;
    setStep('PROCESSING');
    setError(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64 = reader.result as string;
        try {
          const res = await api.post('/ai/process-image', { image: base64 });
          setExtractedData(res.data.menu);
          setStep('REVIEW');
        } catch (err: any) {
          setError(err.response?.data?.error || 'Failed to analyze menu. Please try a clearer photo.');
          setStep('UPLOAD');
        }
      };
    } catch (err) {
      setError('Failed to read file');
      setStep('UPLOAD');
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      await api.post('/menus/bulk-import', extractedData);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Import failed');
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Magic Importer</h2>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Photo to Digital Menu in seconds</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in slide-in-from-top-2">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {step === 'UPLOAD' && (
            <div className="space-y-6">
              <div 
                className={`border-3 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center text-center transition-all ${previewUrl ? 'border-purple-200 bg-purple-50/30' : 'border-gray-100 hover:border-purple-300 hover:bg-purple-50/10'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const droppedFile = e.dataTransfer.files?.[0];
                  if (droppedFile) {
                    setFile(droppedFile);
                    setPreviewUrl(URL.createObjectURL(droppedFile));
                  }
                }}
              >
                {previewUrl ? (
                  <div className="relative group">
                    <img src={previewUrl} className="max-h-64 rounded-2xl shadow-lg border-4 border-white" alt="Menu preview" />
                    <button 
                      onClick={() => { setFile(null); setPreviewUrl(null); }}
                      className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-300 mb-4">
                      <Upload size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Upload Menu Photo</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-xs">Take a clear picture of your physical menu or upload a PDF/Image</p>
                    <label className="bg-white border-2 border-gray-200 hover:border-purple-600 hover:text-purple-600 px-6 py-2.5 rounded-xl font-bold transition-all cursor-pointer">
                      Select File
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </>
                )}
              </div>
              
              <button
                disabled={!file}
                onClick={processImage}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-200 transition-all active:scale-[0.98]"
              >
                <Wand2 size={20} />
                Analyze with Gemini AI
              </button>
            </div>
          )}

          {step === 'PROCESSING' && (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-purple-200 rounded-full blur-2xl animate-pulse" />
                <Loader2 size={48} className="text-purple-600 animate-spin relative" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Gemini is reading your menu...</h3>
              <p className="text-sm text-gray-500 max-w-xs">Our AI is extracting categories, items, and prices with high precision.</p>
            </div>
          )}

          {step === 'REVIEW' && extractedData && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Extracted Menu Structure</h3>
                <span className="text-xs font-black px-2.5 py-1 bg-green-100 text-green-600 rounded-full uppercase">AI Verified</span>
              </div>
              <div className="space-y-4">
                {extractedData.categories?.map((cat: any, i: number) => (
                  <div key={i} className="border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                    <h4 className="font-bold text-purple-700 text-sm mb-3 flex items-center gap-2">
                       <span className="w-2 h-2 rounded-full bg-purple-400" /> {cat.name}
                    </h4>
                    <div className="space-y-2">
                      {cat.items?.map((item: any, j: number) => (
                        <div key={j} className="flex justify-between items-center text-sm bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">{item.isVeg ? '🟢' : '🔴'}</span>
                            <span className="font-semibold text-gray-700">{item.name}</span>
                          </div>
                          <span className="font-black text-gray-900">₹{item.price}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'REVIEW' && (
          <div className="p-8 border-t bg-gray-50 flex gap-4">
            <button
              onClick={() => setStep('UPLOAD')}
              className="flex-1 px-6 py-4 border-2 border-gray-200 hover:bg-white text-gray-600 rounded-2xl font-bold transition-all"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-200 transition-all disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="animate-spin" /> : <Check size={20} />}
              Confirm & Import Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
