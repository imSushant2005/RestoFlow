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

  const CHATGPT_PROMPT = `Please read the attached menu photo(s) and output a JSON list of categories and items exactly in the format below.

CRITICAL INSTRUCTIONS:
1. Categorize all items logically. Group them into appropriate categories such as "Appetizers/Starters", "Main Course", "Desserts", "Beverages", etc., even if the menu photo doesn't explicitly group them.
2. Translate local terms to standard names where it makes grouping clearer, or keep them if they represent the cuisine.
3. Output ONLY pure JSON without any markdown formatting blocks, backticks, or explanations. 

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

  const updateCategoryName = (catIndex: number, newName: string) => {
    const newData = { ...extractedData };
    newData.categories[catIndex].name = newName;
    setExtractedData(newData);
  };

  const updateItem = (catIndex: number, itemIndex: number, field: string, value: any) => {
    const newData = { ...extractedData };
    newData.categories[catIndex].items[itemIndex][field] = value;
    setExtractedData(newData);
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
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-8 py-6 border-b flex justify-between items-center bg-gradient-to-r from-purple-50 to-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-200">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">AI Menu Importer</h2>
              <p className="text-xs text-gray-500 font-medium tracking-wider">Fast-track menu creation via ChatGPT</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
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
                  We allow you to quickly import your menu without paying for expensive AI OCR software! Just copy the specific prompt below, provide ChatGPT with clear photos of your physical menu, and it will generate the categorized JSON code for you automatically.
                </p>
                
                <div className="relative group">
                  <pre className="bg-gray-900 text-purple-200 p-4 rounded-xl text-xs overflow-x-auto border border-gray-800 font-mono leading-relaxed whitespace-pre-wrap max-h-64 custom-scrollbar">
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
                  className="w-full h-80 bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 font-mono text-sm focus:border-purple-500 focus:ring-0 outline-none resize-none custom-scrollbar"
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
                  Validate & Review
                </button>
              </div>
            </div>
          )}

          {step === 'REVIEW' && extractedData && (
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-2">
                <div>
                   <h3 className="font-bold text-gray-900 text-lg">Step 3: Review & Edit</h3>
                   <p className="text-sm text-gray-500">You can edit categories and item names/prices before finalizing.</p>
                </div>
                <span className="text-xs font-black px-3 py-1 bg-green-100 text-green-600 rounded-full uppercase tracking-widest border border-green-200 shadow-sm flex items-center gap-1"><Check size={12}/> Valid JSON</span>
              </div>
              
              <div className="space-y-5">
                {extractedData.categories?.map((cat: any, i: number) => (
                  <div key={i} className="border border-purple-100 rounded-2xl p-4 md:p-5 bg-purple-50/20 shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
                         <Sparkles size={14} />
                      </div>
                      <input 
                         type="text" 
                         value={cat.name}
                         onChange={(e) => updateCategoryName(i, e.target.value)}
                         className="font-black text-purple-900 text-lg bg-transparent border-b-2 border-transparent hover:border-purple-200 focus:border-purple-500 outline-none w-full transition-colors pb-1"
                         placeholder="Category Name"
                      />
                    </div>
                    
                    <div className="space-y-2 pl-2">
                      {cat.items?.map((item: any, j: number) => (
                        <div key={j} className="flex flex-col sm:flex-row justify-between sm:items-center text-sm bg-white p-3 rounded-xl border border-gray-100 shadow-sm gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md">
                          <div className="flex flex-1 items-center gap-3 w-full">
                            <button 
                               onClick={() => updateItem(i, j, 'isVeg', !item.isVeg)} 
                               className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md border"
                               title="Toggle Veg/Non-Veg"
                            >
                               <span className="text-[10px]">{item.isVeg ? '🟢' : '🔴'}</span>
                            </button>
                            <input 
                               type="text"
                               value={item.name}
                               onChange={(e) => updateItem(i, j, 'name', e.target.value)}
                               className="font-bold text-gray-800 bg-transparent outline-none w-full border-b border-transparent focus:border-gray-300"
                               placeholder="Item Name"
                            />
                          </div>
                          <div className="flex items-center gap-1 sm:w-28 pl-9 sm:pl-0">
                             <span className="font-bold text-gray-400">₹</span>
                             <input 
                               type="number"
                               value={item.price}
                               onChange={(e) => updateItem(i, j, 'price', parseFloat(e.target.value) || 0)}
                               className="font-black text-gray-900 bg-transparent outline-none w-full border-b border-transparent focus:border-gray-300 min-w-0"
                               placeholder="Price"
                             />
                          </div>
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
          <div className="p-4 md:p-6 border-t bg-gray-50 flex gap-4 flex-shrink-0">
            <button
              onClick={() => setStep('PASTE_JSON')}
              className="px-4 md:px-6 py-4 border-2 border-gray-200 hover:bg-white text-gray-600 rounded-2xl font-bold transition-all whitespace-nowrap"
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
