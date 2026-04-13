import { useState } from 'react';
import { Sparkles, Check, X, Loader2, AlertCircle, Copy, ArrowRight, FileJson } from 'lucide-react';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function AiMenuImporter({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'INSTRUCTIONS' | 'PASTE_JSON' | 'REVIEW'>('INSTRUCTIONS');
  const [jsonInput, setJsonInput] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CHATGPT_PROMPT = `Please read the attached menu photo(s) and output a JSON list of categories and items exactly in this format. Output ONLY pure JSON without any markdown formatting blocks or explanations:

[
  {
    "name": "Starters",
    "items": [
      {
        "name": "Spring Rolls",
        "price": 120,
        "description": "Crispy rolls with sweet chili sauce",
        "isVeg": true
      }
    ]
  }
]`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(CHATGPT_PROMPT);
  };

  const handleParseJson = () => {
    try {
      let cleanJson = jsonInput.trim();
      // Remove markdown blocks if ChatGPT still added them
      if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace('```json', '');
      if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace('```', '');
      if (cleanJson.endsWith('```')) cleanJson = cleanJson.slice(0, -3);

      const parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of categories.');
      
      setExtractedData({ categories: parsed });
      setStep('REVIEW');
      setError(null);
    } catch (err: any) {
      setError('Invalid JSON format. Please ensure it exactly matches the required structure. ' + err.message);
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
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assisted Menu Importer</h2>
              <p className="text-xs text-gray-500 font-medium tracking-wider">Zero API dependency JSON setup</p>
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

          {step === 'INSTRUCTIONS' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-purple-50/50 border border-purple-100 p-6 rounded-2xl">
                <h3 className="font-bold text-gray-900 mb-2 text-lg">Step 1: Get data from ChatGPT</h3>
                <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                  We allow you to quickly import your menu without paying for expensive AI software! Just copy the specific prompt below, provide ChatGPT with clear photos of your physical menu, and it will generate the JSON code for you automatically.
                </p>
                
                <div className="relative group">
                  <pre className="bg-gray-900 text-purple-200 p-4 rounded-xl text-xs overflow-x-auto border border-gray-800 font-mono leading-relaxed whitespace-pre-wrap">
                    {CHATGPT_PROMPT}
                  </pre>
                  <button 
                    onClick={copyPrompt}
                    className="absolute top-3 right-3 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-xs font-bold transition flex flex-row"
                  >
                    <Copy size={12} />
                    Copy Prompt
                  </button>
                </div>
              </div>

              <button
                onClick={() => setStep('PASTE_JSON')}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-200 transition-all active:scale-[0.98]"
              >
                I have my JSON Ready <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 'PASTE_JSON' && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Step 2: Paste ChatGPT output</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-sm">Paste the exact JSON code returned by ChatGPT here.</p>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={`[\n  {\n    "name": "Category",\n    "items": [...]\n  }\n]`}
                  className="w-full h-64 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-mono text-sm focus:border-purple-500 focus:ring-0 outline-none resize-none"
                />
              </div>
              
              <div className="flex gap-4">
                <button
                  onClick={() => setStep('INSTRUCTIONS')}
                  className="px-6 py-4 border-2 border-gray-200 hover:bg-gray-50 text-gray-600 rounded-2xl font-bold transition-all"
                >
                  Back
                </button>
                <button
                  disabled={!jsonInput.trim()}
                  onClick={handleParseJson}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-200 transition-all active:scale-[0.98]"
                >
                  <FileJson size={18} />
                  Validate & Preview
                </button>
              </div>
            </div>
          )}

          {step === 'REVIEW' && extractedData && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Step 3: Preview Structure</h3>
                <span className="text-xs font-black px-2.5 py-1 bg-green-100 text-green-600 rounded-full uppercase">Valid JSON</span>
              </div>
              
              <div className="space-y-4 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
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
          <div className="p-6 border-t bg-gray-50 flex gap-4">
            <button
              onClick={() => setStep('PASTE_JSON')}
              className="px-6 py-4 border-2 border-gray-200 hover:bg-white text-gray-600 rounded-2xl font-bold transition-all"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-purple-200 transition-all disabled:opacity-50"
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
