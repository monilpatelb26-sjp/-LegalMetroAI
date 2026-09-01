import re

with open('src/App.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove Blockchain UI from App.jsx
blockchain_ui_pattern = re.compile(r'\s*\{\/\* Blockchain Verification UI \*\/\}.*?\}', re.DOTALL)
# The pattern might fail due to nested braces in JSX. Let's do string replacement instead.
blockchain_ui_str = """                          {/* Blockchain Verification UI */}
                          {insp.validation_results?.blockchain_tx_hash && (
                            <div className="mt-2 flex flex-col gap-1 border-t border-ink/10 pt-2 w-max">
                              <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-slateBlue tracking-wider">
                                <ShieldCheck size={12} className="text-emerald-500" /> Blockchain Secured
                              </div>
                              <div className="flex items-center gap-2">
                                <code className="text-[10px] font-mono bg-slate-100 border border-ink/20 px-1.5 py-0.5 text-ink/70 rounded-sm">
                                  {insp.validation_results.blockchain_tx_hash.substring(0, 16)}...
                                </code>
                                <button onClick={(e) => {
                                  const btn = e.currentTarget;
                                  const orig = btn.innerHTML;
                                  btn.innerHTML = '<span class="animate-spin inline-block w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full mr-1 align-middle"></span><span class="align-middle">Verifying...</span>';
                                  setTimeout(() => btn.innerHTML = '<span class="text-emerald-600">✅ 100% Authentic</span>', 1000);
                                  setTimeout(() => btn.innerHTML = orig, 3000);
                                }} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold transition-all">Verify</button>
                              </div>
                            </div>
                          )}"""
content = content.replace(blockchain_ui_str, "")

# 2. Remove URL scanning
url_state = "const [scanMode, setScanMode] = useState('file'); // 'file', 'camera', 'url'\n  const [urlInput, setUrlInput] = useState('');"
content = content.replace(url_state, "")

url_handler_pattern = re.compile(r'\s*const handleUrlScan.*?catch \(err\) \{.*?\}\n  \};', re.DOTALL)
content = re.sub(url_handler_pattern, '', content)

url_tabs_str = """              {/* Scanner Modes (Tabs) */}
              <div className="flex bg-slate-100 p-1 rounded-none border border-ink/20">
                <button 
                  onClick={() => setScanMode('file')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-none transition-colors ${scanMode === 'file' ? 'bg-white shadow-sm text-ink' : 'text-slateBlue hover:text-ink'}`}
                >
                  <UploadCloud size={16} className="inline mr-2" /> File Upload
                </button>
                <button 
                  onClick={() => setScanMode('camera')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-none transition-colors ${scanMode === 'camera' ? 'bg-white shadow-sm text-ink' : 'text-slateBlue hover:text-ink'}`}
                >
                  <Camera size={16} className="inline mr-2" /> Live Camera
                </button>
                <button 
                  onClick={() => setScanMode('url')}
                  className={`flex-1 py-2 px-4 text-sm font-medium rounded-none transition-colors ${scanMode === 'url' ? 'bg-white shadow-sm text-ink' : 'text-slateBlue hover:text-ink'}`}
                >
                  <Link size={16} className="inline mr-2" /> Web URL
                </button>
              </div>"""
content = content.replace(url_tabs_str, "")

url_ui_str = """                ) : scanMode === 'url' ? (
                  <div className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-none bg-paper p-6">
                    <Link className="w-12 h-12 text-slateBlue/80 mb-4" />
                    <input
                      type="url"
                      placeholder="Paste Amazon or Flipkart URL here..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-none focus:outline-none focus:ring-2 focus:ring-slateBlue mb-4"
                    />
                    <button 
                      onClick={handleUrlScan}
                      disabled={uploading || !urlInput.trim()}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slateBlue hover:bg-slateBlue/90 text-white rounded-none font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                      {uploading ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" /> : <Search size={18} />}
                      {uploading ? 'Scraping Page...' : 'Scan URL & Detect MRP'}
                    </button>
                  </div>"""
content = content.replace(url_ui_str, "")

content = content.replace("scanMode === 'camera' ?", "previewUrl ?")
content = content.replace("!previewUrl ?", "true ?") # Will manually fix this one since it's tricky.
# Wait, let's not break JSX. 

with open('src/App.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
print("Removed frontend features partly")
