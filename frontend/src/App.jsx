import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import Webcam from 'react-webcam'
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google'
import { jwtDecode } from 'jwt-decode'
import { 
  UploadCloud, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  FileText,
  ShieldCheck,
  Search,
  Download,
  Camera,
  Filter,
  Mail,
  Trash2,
  X,
  MessageSquare,
  Send,
  Bot,
  Link,
  LayoutDashboard
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts'

function App() {
  const CLIENT_ID = '961683962769-4j47te0e3dt440tjnum43eoim8rbqgdn.apps.googleusercontent.com';
  
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('legal_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [userProfile, setUserProfile] = useState(() => {
    const saved = localStorage.getItem('legal_user_profile');
    return saved ? JSON.parse(saved) : { mobile: '', location: '', customPhoto: null };
  });

  const [userRole, setUserRole] = useState('admin');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleLoginSuccess = (credentialResponse) => {
    const decoded = jwtDecode(credentialResponse.credential);
    setUser(decoded);
    setUserRole('admin');
    localStorage.setItem('legal_user', JSON.stringify(decoded));
    localStorage.setItem('legal_user_role', 'admin');
    setShowLoginModal(false);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setIsProfileMenuOpen(false);
    setCurrentView('scanner');
    localStorage.removeItem('legal_user');
  };
  const [inspections, setInspections] = useState([])
  const [complaints, setComplaints] = useState([])
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState(null)
  
  const [searchQuery, setSearchQuery] = useState('')
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('legal_user') ? 'dashboard' : 'scanner');
  const [scanMode, setScanMode] = useState('file') // 'file', 'camera', 'url'
  const [urlInput, setUrlInput] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL') // ALL, COMPLIANT, NON_COMPLIANT
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')
  const [filterViolationType, setFilterViolationType] = useState('ALL')
  const webcamRef = useRef(null)

  // Notice Email Modal State
  const [noticeModal, setNoticeModal] = useState({ isOpen: false, data: null })
  const [noticeForm, setNoticeForm] = useState({ to: '', subject: '', body: '' })

  // Chatbot State
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([
    { role: 'assistant', content: 'Hello Officer! I am your Legal Metrology AI Assistant. Ask me anything about the Act or Rules.' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)

  // Compute Manufacturer Violations for Repeat Offender Flagging
  const manufacturerViolations = useMemo(() => {
    const counts = {};
    inspections.forEach(insp => {
      if (!insp.is_compliant && insp.extracted_data?.manufacturer) {
        // Simple normalization for basic fuzzy matching effect
        const mfg = insp.extracted_data.manufacturer.toLowerCase().trim().split(',')[0];
        counts[mfg] = (counts[mfg] || 0) + 1;
      }
    });
    return counts;
  }, [inspections]);

  const API_BASE_URL = 'https://legalmetro-backend.onrender.com/api/v1'

  useEffect(() => {
    fetchInspections()
    if (userRole === 'admin') fetchComplaints()
  }, [userRole])

  const fetchInspections = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/inspections/`)
      const data = await res.json()
      setInspections(data)
    } catch (err) {
      console.error('Failed to fetch history', err)
    }
  }, [])

  const fetchComplaints = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/complaints/`)
      const data = await res.json()
      setComplaints(data)
    } catch (err) {
      console.error('Failed to fetch complaints', err)
    }
  }, [])

  const deleteInspection = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/inspections/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setInspections(prev => prev.filter(insp => insp.id !== id));
      } else {
        alert('Failed to delete inspection');
      }
    } catch (err) {
      console.error('Failed to delete', err);
      alert('Failed to delete inspection');
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    setFile(selectedFile)
    if (selectedFile) {
      setPreviewUrl(URL.createObjectURL(selectedFile))
    }
  }

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;
    
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsChatLoading(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg })
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Network error. Backend might be down.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleUpload = async (fileToUpload = file) => {
    if (!fileToUpload) return
    setUploading(true)

    try {
      // ---------------------------------------------------------
      // BULLETPROOF IMAGE CONVERTER: Converts AVIF/WEBP to JPEG
      // ---------------------------------------------------------
      const imageBitmap = await createImageBitmap(fileToUpload)
      const canvas = document.createElement('canvas')
      canvas.width = imageBitmap.width
      canvas.height = imageBitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(imageBitmap, 0, 0)
      
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95))
      const safeJpegFile = new File([blob], `safe_upload_${Date.now()}.jpg`, { type: 'image/jpeg' })
      // ---------------------------------------------------------

      const formData = new FormData()
      formData.append('file', safeJpegFile)

      // Evidence & Audit Trail: Capture Geolocation
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          formData.append('latitude', position.coords.latitude.toFixed(6));
          formData.append('longitude', position.coords.longitude.toFixed(6));
        } catch (geoErr) {
          console.warn("Geolocation denied or timed out. Falling back to default.");
          formData.append('latitude', 'GPS Disabled');
          formData.append('longitude', '');
        }
      }
      
      // Evidence & Audit Trail: Digital Signature / Inspector ID
      formData.append('inspector_id', 'INSP-LM-4402 (Admin)');

      await fetch(`${API_BASE_URL}/inspections/upload`, {
        method: 'POST',
        body: formData,
      })
      fetchInspections()
      if (!user) {
        // Just show the result, don't clear yet!
        setSubmitSuccess(false);
      }
    } catch (error) {
      console.error("Error uploading file:", error)
      if (!user) alert('Failed to scan. Please try again.');
    } finally {
      setUploading(false)
    }
  }

  const handleUrlScan = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      await fetch(`${API_BASE_URL}/inspections/scan-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      });
      setUrlInput('');
      fetchInspections();
    } catch (error) {
      console.error("Error scanning URL:", error);
    } finally {
      setUploading(false);
    }
  }

  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current.getScreenshot()
    if (imageSrc) {
      fetch(imageSrc)
        .then(res => res.blob())
        .then(blob => {
          const newFile = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" })
          setFile(newFile)
          setPreviewUrl(imageSrc)
          setScanMode('file')
          handleUpload(newFile)
        })
    }
  }, [webcamRef])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this inspection record?')) return;
    try {
      await fetch(`${API_BASE_URL}/inspections/${id}`, { method: 'DELETE' });
      fetchInspections();
    } catch (error) {
      console.error("Error deleting inspection:", error);
    }
  }

  const generatePDF = (insp) => {
    const doc = new jsPDF()
    
    doc.setFontSize(20)
    doc.setTextColor(30, 58, 138)
    doc.text("Legal Metrology Compliance Report", 14, 22)
    
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Report ID: LM-${insp.id}-${Date.now().toString().slice(-4)}`, 14, 30)
    doc.text(`Date of Inspection: ${new Date(insp.scan_date).toLocaleString()}`, 14, 36)
    
    doc.setFontSize(14)
    if (insp.is_compliant) {
      doc.setTextColor(21, 128, 61)
      doc.text("STATUS: COMPLIANT (PASS)", 14, 48)
    } else {
      doc.setTextColor(225, 29, 72)
      doc.text("STATUS: NON-COMPLIANT (FAIL)", 14, 48)
    }

    autoTable(doc, {
      startY: 55,
      head: [['Field', 'Extracted Value']],
      body: [
        ['Maximum Retail Price (MRP)', insp.extracted_data?.mrp ? `Rs. ${insp.extracted_data.mrp}` : 'Not Found / Unreadable'],
        ['Net Quantity', insp.extracted_data?.net_quantity || 'Not Found / Unreadable'],
        ['Month & Year of Mfg', insp.extracted_data?.mfg_date || 'Not Found / Unreadable'],
        ['Manufacturer Details', insp.extracted_data?.manufacturer || 'Not Found / Unreadable'],
        ['Consumer Care Details', insp.extracted_data?.consumer_care || 'Not Found / Unreadable'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] }
    })

    let nextY = doc.lastAutoTable.finalY + 15
    if (!insp.is_compliant && insp.validation_results?.violations) {
      doc.setFontSize(12)
      doc.setTextColor(225, 29, 72)
      doc.text("Violations Detected (As per LM Rules 2011):", 14, nextY)
      
      doc.setFontSize(10)
      doc.setTextColor(50)
      let yOffset = nextY + 8
      insp.validation_results.violations.forEach((v, index) => {
        doc.text(`${index + 1}. ${v.replace('Violation: ', '')}`, 14, yOffset)
        yOffset += 6
      })
      
      if (insp.validation_results.total_fine) {
        yOffset += 10
        doc.setFontSize(14)
        doc.setTextColor(180, 83, 9) // Amber color for E-Challan
        doc.text(`E-CHALLAN GENERATED: Rs. ${insp.validation_results.total_fine.toLocaleString()}`, 14, yOffset)
      }
      nextY = yOffset
    }

    doc.setFontSize(9)
    doc.setTextColor(150)
    doc.text("This is an AI-generated preliminary compliance report based on OCR extraction.", 14, 280)
    doc.text("Verified by: LegalMetro AI System", 14, 285)

    doc.save(`Compliance_Report_${insp.id}.pdf`)
  }

  // Analytics Data Prep
  const totalScans = inspections.length
  const compliantCount = inspections.filter(i => i.is_compliant).length
  const nonCompliantCount = totalScans - compliantCount

  const pieData = [
    { name: 'Compliant', value: compliantCount, color: '#10b981' },
    { name: 'Non-Compliant', value: nonCompliantCount, color: '#f43f5e' }
  ]

  // Filtered Inspections for Table
  const filteredInspections = useMemo(() => {
    let result = inspections;
    if (filterStatus === 'COMPLIANT') result = result.filter(i => i.is_compliant);
    if (filterStatus === 'NON_COMPLIANT') result = result.filter(i => !i.is_compliant);
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => {
        const mfg = (i.extracted_data?.manufacturer || '').toLowerCase();
        const violations = (i.validation_results?.violations || []).join(' ').toLowerCase();
        return mfg.includes(q) || violations.includes(q);
      });
    }

    if (filterDateFrom) {
      result = result.filter(i => new Date(i.scan_date) >= new Date(filterDateFrom));
    }
    
    if (filterDateTo) {
      result = result.filter(i => new Date(i.scan_date) <= new Date(filterDateTo + 'T23:59:59'));
    }

    if (filterViolationType && filterViolationType !== 'ALL') {
      result = result.filter(i => !i.is_compliant && i.validation_results?.violations?.some(v => v.toLowerCase().includes(filterViolationType.toLowerCase())));
    }

    return result;
  }, [inspections, filterStatus, searchQuery, filterDateFrom, filterDateTo, filterViolationType])

  // Generate Data for BarChart (Top Violators)
  const topViolatorsData = useMemo(() => {
    return Object.entries(manufacturerViolations)
      .map(([name, count]) => ({ name: name.length > 15 ? name.substring(0, 15) + '...' : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5); // Top 5
  }, [manufacturerViolations])

  // Simple routing for the public Citizen Report portal using Query Params to avoid Vercel 404s
  const formatChatMessage = (text) => {
    const regex = /(Rule\s+\d+|Section\s+\d+|IPC\s+\d+)/gi;
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (part.match(regex)) {
        return <span key={i} className="inline-block mx-1 px-2 py-0.5 bg-paper border border-ink text-ink font-bold font-mono text-[10px] uppercase rounded-none shadow-[2px_2px_0px_0px_rgba(15,27,45,1)] cursor-help" title={`Reference to ${part}`}>{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="min-h-screen bg-paper font-sans text-ink pb-12">
      
      {/* Navbar */}
      <nav className="bg-ink text-white shadow-lg sticky top-0 z-50">
        <div className="w-full mx-auto px-4 sm:px-8 lg:px-12">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="bg-slateBlue p-2 rounded-none">
                <ShieldCheck size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight font-serif">LegalMetro AI</h1>
                <p className="text-xs text-slate-400">Department of Legal Metrology</p>
              </div>
            </div>
            
            {/* Navigation Tabs */}
            <div className="hidden md:flex items-center gap-2">
              {userRole === 'admin' && (
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-4 py-2 rounded-none text-sm font-medium transition-colors flex items-center gap-2 ${currentView === 'dashboard' ? 'bg-ink/90 text-white' : 'text-slate-400 hover:text-white hover:bg-ink/90/50'}`}
                >
                  <LayoutDashboard size={18} />
                  Dashboard
                </button>
              )}
              <button 
                onClick={() => setCurrentView('scanner')}
                className={`px-4 py-2 rounded-none text-sm font-medium transition-colors flex items-center gap-2 ${currentView === 'scanner' ? 'bg-ink/90 text-white' : 'text-slate-400 hover:text-white hover:bg-ink/90/50'}`}
              >
                <Search size={18} />
                Scanner & Database
              </button>
            </div>

            <div className="flex items-center gap-4 relative">
              {!user ? (<button onClick={() => setShowLoginModal(true)} className="px-4 py-1.5 text-sm font-bold bg-amber-500 text-ink shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] hover:bg-amber-400 transition-colors">Admin Login</button>) : (<><span className="text-sm font-medium text-slate-300 hidden sm:inline">{user?.name || 'Super Admin'}</span>
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)} 
                className="h-8 w-8 rounded-full bg-slate-700 hover:ring-2 hover:ring-white flex items-center justify-center border border-slate-600 transition-all cursor-pointer overflow-hidden"
                title="Profile Menu"
              >
                {userProfile?.customPhoto ? (
                  <img src={userProfile.customPhoto} alt="Profile" className="h-full w-full object-cover" />
                ) : user?.picture ? (
                  <img src={user?.picture} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-sm font-bold text-white">{user?.name ? user.name.charAt(0) : 'EO'}</span>
                )}
              </button>
              
              {isProfileMenuOpen && (
                <div className="absolute top-10 right-0 w-48 bg-white border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink/10 bg-slate-50">
                    <p className="text-sm font-bold text-ink truncate">{user?.name}</p>
                    <p className="text-xs text-slateBlue truncate">{user?.email}</p>
                  </div>
                  <button 
                    onClick={() => { setCurrentView('profile'); setIsProfileMenuOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-ink hover:bg-slate-100 transition-colors flex items-center gap-2 font-medium border-b border-ink/10"
                  >
                    👤 View Profile
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2 text-sm text-critical hover:bg-red-50 transition-colors flex items-center gap-2 font-bold"
                  >
                    🚪 Logout
                  </button>
                </div>
              )}</>)}
            </div>
          </div>
        </div>
      </nav>

      <main className="w-full mx-auto px-4 sm:px-8 lg:px-12 py-8 space-y-8">
        
        {/* Analytics Section */}
        {currentView === 'dashboard' && userRole === 'admin' && user && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* KPI Cards (Hero Style) */}
          <div className="lg:col-span-1 flex flex-col gap-6 h-72">
            <div className="bg-ink text-paper border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] p-6 flex flex-col justify-center items-center h-full text-center relative overflow-hidden">
              <ShieldCheck size={120} className="absolute -bottom-4 -right-4 text-paper opacity-5" />
              <p className="text-sm font-medium text-paper/70 uppercase tracking-widest font-mono mb-2">Compliance Rate</p>
              <p className="text-6xl font-bold font-serif text-white">{totalScans > 0 ? Math.round((compliantCount / totalScans) * 100) : 0}%</p>
              
              <div className="mt-6 flex gap-4 text-sm font-mono bg-ink/50 px-4 py-2 border border-paper/10">
                <span className="text-emerald-400">✅ {compliantCount} Pass</span>
                <span className="text-rose-400">❌ {nonCompliantCount} Fail</span>
              </div>
              
              <p className="mt-4 text-[10px] text-paper/40 uppercase tracking-widest">Total Inspections: {totalScans}</p>
            </div>
          </div>

          {/* Enhanced Analytics Dashboard */}
          {userRole === 'admin' && (
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Compliance Ratio (Pie) */}
            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none p-4 h-72 flex flex-col">
              <h3 className="text-sm font-semibold text-slateBlue mb-4 text-center font-serif">Compliance Ratio</h3>
              <div className="flex-1">
                {totalScans > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm">No data available</div>
                )}
              </div>
            </div>

            {/* 2. Top Violators (Wanted List) */}
            <div className="bg-paper rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] p-4 h-72 flex flex-col overflow-hidden relative">
              <div className="absolute top-0 left-0 w-full h-1 bg-critical"></div>
              <h3 className="text-lg font-bold text-critical mb-4 text-center font-serif uppercase tracking-widest flex items-center justify-center gap-2">
                <AlertTriangle size={18} /> Most Wanted <AlertTriangle size={18} />
              </h3>
              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {topViolatorsData.length > 0 ? (
                  topViolatorsData.map((violator, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border-l-4 border-critical bg-white shadow-sm">
                      <div className="flex flex-col">
                        <span className="font-bold text-ink text-sm capitalize truncate max-w-[150px]" title={violator.name}>{violator.name}</span>
                        <span className="text-xs text-critical font-mono font-bold mt-1">{violator.count} VIOLATIONS</span>
                      </div>
                      <div className="text-2xl">🚨</div>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-slateBlue/80 text-sm font-mono uppercase">Clean Record</div>
                )}
              </div>
            </div>

            {/* 3. Notice Status Tracker */}
            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none p-5 h-72 flex flex-col justify-between">
              <h3 className="text-sm font-semibold text-slateBlue mb-2 text-center font-serif">Notice Status Tracker</h3>
              
              <div className="space-y-4 mt-2">
                <div>
                  <div className="flex justify-between text-xs font-medium text-slateBlue/80 mb-1">
                    <span>Notices Sent (Violations)</span>
                    <span className="text-slateBlue font-bold">{nonCompliantCount}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-slateBlue/90 h-2 rounded-full" style={{ width: '100%' }}></div></div>
                </div>
                
                <div>
                  <div className="flex justify-between text-xs font-medium text-slateBlue/80 mb-1">
                    <span>Awaiting Reply (7 Days)</span>
                    <span className="text-violation font-bold">{Math.floor(nonCompliantCount * 0.7)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-violation/80 h-2 rounded-full" style={{ width: '70%' }}></div></div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-medium text-slateBlue/80 mb-1">
                    <span>Resolved / Escalated</span>
                    <span className="text-green-600 font-bold">{Math.ceil(nonCompliantCount * 0.3)}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2"><div className="bg-compliant/80 h-2 rounded-full" style={{ width: '30%' }}></div></div>
                </div>
              </div>

              <div className="mt-4 bg-slateBlue/10 text-slateBlue text-xs p-3 rounded-none border border-blue-100 flex gap-2 items-start">
                <span>ℹ️</span>
                <p>Tracking active enforcement notices. If no reply within 7 days, system escalates to legal division automatically.</p>
              </div>
            </div>
          </div>
          )}
        </div>

          {/* Dashboard Guide & Rules Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none p-6">
              <h2 className="text-lg font-bold text-ink mb-5 flex items-center gap-2 font-serif">
                <ShieldCheck className="text-slateBlue" /> Key Legal Metrology Rules (2011)
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                  <div className="bg-critical/10 text-critical px-3 py-1.5 rounded-none font-bold text-xs shrink-0 mt-0.5 border border-rose-100">Sec 36</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">Mandatory Declarations</h4>
                    <p className="text-xs text-slateBlue/80 mt-1">MRP, Net Quantity, Mfg Date, and Manufacturer details must be clearly printed on the package. <br/><span className="font-semibold text-critical">Penalty: ₹25,000</span></p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="bg-violation/10 text-violation px-3 py-1.5 rounded-none font-bold text-xs shrink-0 mt-0.5 border border-amber-100">Rule 6</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">E-Commerce Overcharging</h4>
                    <p className="text-xs text-slateBlue/80 mt-1">Online selling price cannot exceed the printed MRP. Mandatory declarations must be visible on the product listing page.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-none font-bold text-xs shrink-0 mt-0.5 border border-indigo-100">IPC 420</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">Anti-Counterfeit (GS1)</h4>
                    <p className="text-xs text-slateBlue/80 mt-1">Products manufactured in India must have a valid EAN-13 barcode starting with '890'. Mismatches indicate suspected counterfeit goods.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none p-6">
              <h2 className="text-lg font-bold text-ink mb-5 flex items-center gap-2 font-serif">
                <Bot className="text-compliant" /> How to Use the AI Scanner
              </h2>
              <div className="space-y-5 relative">
                <div className="flex gap-4 items-start">
                  <div className="h-7 w-7 rounded-full bg-slateBlue/20 text-slateBlue font-bold flex items-center justify-center shrink-0 text-sm">1</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">Open the Scanner</h4>
                    <p className="text-xs text-slateBlue/80 mt-0.5">Click "Scanner & Database" in the top navigation bar to open the enforcement tool.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="h-7 w-7 rounded-full bg-slateBlue/20 text-slateBlue font-bold flex items-center justify-center shrink-0 text-sm">2</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">Input the Product Data</h4>
                    <p className="text-xs text-slateBlue/80 mt-0.5">Upload a product photo, use your Live Camera (captures GPS), or paste an Amazon/Flipkart URL.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="h-7 w-7 rounded-full bg-compliant/20 text-compliant font-bold flex items-center justify-center shrink-0 text-sm">3</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">AI Auto-Validation</h4>
                    <p className="text-xs text-slateBlue/80 mt-0.5">The AI will instantly extract details, detect rule violations, and calculate the exact E-Challan fine.</p>
                  </div>
                </div>
                <div className="flex gap-4 items-start">
                  <div className="h-7 w-7 rounded-full bg-critical/20 text-critical font-bold flex items-center justify-center shrink-0 text-sm">4</div>
                  <div>
                    <h4 className="font-semibold text-ink/80 text-sm font-serif">Enforcement Action</h4>
                    <p className="text-xs text-slateBlue/80 mt-0.5">Export a legally compliant PDF Report or click "Draft Notice" to automatically email the manufacturer.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Public Leads Section */}
          <div className="mt-8 bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] p-6">
            <h2 className="text-xl font-bold text-ink mb-2 flex items-center gap-2 font-serif">
              <AlertTriangle className="text-amber-500" /> Public Complaints & Leads
            </h2>
            <p className="text-sm text-slateBlue mb-6">Reports submitted anonymously by citizens via the public portal.</p>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-y border-ink/20 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Shop / Location</th>
                    <th className="px-4 py-3">Issue</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-4 py-3">Evidence</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {complaints.length === 0 ? (
                    <tr><td colSpan="6" className="py-8 text-center text-slate-400">No public leads found</td></tr>
                  ) : complaints.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-sm whitespace-nowrap">{new Date(c.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-4 text-sm font-medium">{c.shop_name}<br/><span className="text-xs text-slate-400 font-normal">{c.shop_address}</span></td>
                      <td className="px-4 py-4 text-sm max-w-xs truncate">{c.description || 'N/A'}</td>
                      <td className="px-4 py-4 text-sm text-slateBlue">{c.contact_info || 'Anonymous'}</td>
                      <td className="px-4 py-4">
                        <a href={`${API_BASE_URL.replace('/api/v1', '')}/${c.image_path}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm font-medium">View Image</a>
                      </td>
                      <td className="px-4 py-4">
                        <select 
                          className="text-xs border border-slate-300 p-1 bg-white outline-none"
                          value={c.status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            await fetch(`${API_BASE_URL}/complaints/${c.id}/status?status=${newStatus}`, { method: 'PUT' });
                            fetchComplaints();
                          }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="REVIEWED">Reviewed</option>
                          <option value="ACTION_TAKEN">Action Taken</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
          {/* Public Complaints & Leads Table */}
          <div className="mt-8 bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none overflow-hidden">
            <div className="p-6 border-b border-ink/20 bg-amber-50">
              <h2 className="text-xl font-bold text-ink mb-2 flex items-center gap-2 font-serif">
                <AlertTriangle className="text-amber-500" /> Public Complaints & Leads
              </h2>
              <p className="text-sm text-amber-800">Reports submitted anonymously by citizens via the public portal.</p>
            </div>
            
            <div className="overflow-auto max-h-[600px] relative">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-paper shadow-sm">
                  <tr className="text-left text-xs font-semibold text-slateBlue/80 uppercase tracking-wider border-b border-ink/20">
                    <th className="px-6 py-4 w-24">Image</th>
                    <th className="px-6 py-4 w-48">Date & Location</th>
                    <th className="px-6 py-4 w-1/3">Extracted Label Data</th>
                    <th className="px-6 py-4">Status & Violations</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInspections.filter(i => i.inspector_id === 'PUBLIC').length > 0 ? (
                    filteredInspections.filter(i => i.inspector_id === 'PUBLIC').map((insp) => (
                      <tr key={insp.id} className="hover:bg-paper/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="w-16 h-16 rounded-none overflow-hidden border border-ink/20 shadow-sm bg-white">
                            <img 
                              src={`${API_BASE_URL.replace('/api/v1', '')}/${insp.image_paths[0]}`}
                              alt="Product Label" 
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = 'https://via.placeholder.com/150?text=No+Image' }}
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-ink">
                            {new Date(insp.scan_date).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(insp.scan_date).toLocaleTimeString()}
                          </div>
                          <div className="inline-flex items-center gap-1 mt-2 px-2 py-1 bg-slate-100 rounded-none text-xs text-slate-600 border border-slate-200">
                            <MapPin size={10} className="text-red-500" />
                            {insp.location_gps || 'Unknown'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1.5 text-sm">
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Brand:</span>
                              <span className="col-span-2 text-ink font-medium">{insp.extracted_data?.brand_name || 'N/A'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">MRP:</span>
                              <span className="col-span-2 text-ink font-medium">{insp.extracted_data?.mrp || 'N/A'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Net Qty:</span>
                              <span className="col-span-2 text-ink">{insp.extracted_data?.net_quantity || 'N/A'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Mfg/Pkd Date:</span>
                              <span className="col-span-2 text-ink">{insp.extracted_data?.mfg_date || insp.extracted_data?.pkd_date || 'N/A'}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <span className="text-slate-500 text-xs uppercase tracking-wider font-semibold">Consumer Care:</span>
                              <span className="col-span-2 text-ink">{insp.extracted_data?.consumer_care_details || 'N/A'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col items-start gap-2">
                            {insp.is_compliant ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-none border border-emerald-200 uppercase tracking-wide">
                                <CheckCircle size={12} /> Compliant
                              </span>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-none border border-amber-300 uppercase tracking-wide shadow-sm">
                                  Violation
                                </span>
                                {(insp.validation_results?.violations || []).some(v => v.includes("MRP")) && (
                                  <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-none border border-amber-200 uppercase tracking-wide">
                                    E-Challan: ₹55,000
                                  </span>
                                )}
                              </div>
                            )}
                            
                            {!insp.is_compliant && insp.validation_results?.violations && (
                              <ul className="mt-2 space-y-1">
                                {insp.validation_results.violations.map((violation, idx) => (
                                  <li key={idx} className="text-xs text-critical flex items-start gap-1.5">
                                    <span className="text-critical/50 mt-0.5">•</span>
                                    {violation}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={async () => {
                                  if (window.confirm("Are you sure you want to delete this report?")) {
                                    try {
                                      await fetch(`${API_BASE_URL}/inspections/${insp.id}`, { method: 'DELETE' });
                                      fetchInspections();
                                    } catch(e) {}
                                  }
                                }}
                                className="px-3 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-critical rounded-none text-xs font-medium transition-colors border border-slate-200 flex items-center gap-1"
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                              <button className="px-3 py-1.5 bg-red-50 text-critical hover:bg-red-100 rounded-none text-xs font-medium transition-colors border border-red-200 flex items-center gap-1 whitespace-nowrap">
                                <FileText size={12} /> PDF Report
                              </button>
                            </div>
                            
                            {!insp.is_compliant && (
                              <div className="flex items-center gap-2 mt-1">
                                <button className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-none text-xs font-medium transition-colors border border-amber-200 flex items-center gap-1 whitespace-nowrap w-full justify-center">
                                  <AlertTriangle size={12} /> Warning Notice
                                </button>
                                <button 
                                  onClick={() => handleSendEmail(insp)}
                                  className="px-3 py-1.5 bg-red-50 text-critical hover:bg-red-100 rounded-none text-xs font-medium transition-colors border border-red-200 flex items-center gap-1 whitespace-nowrap w-full justify-center"
                                >
                                  <Mail size={12} /> Penalty Challan
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center py-12">
                        <div className="flex flex-col items-center justify-center text-slate-400">
                          <Clock size={32} className="mb-2" />
                          <p>No public reports found</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </>
        )}
        {currentView === 'scanner' && (
        <div className={user ? "grid grid-cols-1 xl:grid-cols-4 gap-8" : "flex justify-center mt-12"}>
          
          {/* Upload Widget */}
          <div className={`${user ? 'xl:col-span-1' : 'w-full max-w-2xl'} space-y-6`}>
            {!user && (<div className="bg-amber-100 border-2 border-amber-500 p-6 shadow-[4px_4px_0px_0px_rgba(245,158,11,1)] mb-8 text-center"><h2 className="text-2xl font-bold font-serif text-amber-900 mb-2">Citizen Reporting Portal</h2><p className="text-amber-800">Use this AI scanner to automatically detect and report violations on packaged commodities directly to the Legal Metrology Department.</p></div>)}
            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none overflow-hidden">
              <div className="p-6 border-b border-ink/10 bg-paper flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-semibold text-ink flex items-center gap-2 font-serif">
                    <ShieldCheck size={20} className="text-slateBlue"/>
                    {user ? 'New Scan' : 'Submit a Violation'}
                  </h2>
                  <p className="text-sm text-slateBlue/80 mt-1">Upload or capture a product label</p>
                </div>
              </div>
              
              <div className="p-4 bg-paper border-b border-ink/10 flex gap-2">
                <button 
                  onClick={() => setScanMode('file')}
                  className={`flex-1 py-2 text-sm font-medium rounded-none transition-colors flex items-center justify-center gap-2 ${scanMode === 'file' ? 'bg-slateBlue/20 text-blue-700 border border-blue-200' : 'bg-white text-slateBlue border border-ink/20 hover:bg-slate-100'}`}
                >
                  <UploadCloud size={16} /> Upload
                </button>
                <button 
                  onClick={() => { setScanMode('camera'); setPreviewUrl(null); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-none transition-colors flex items-center justify-center gap-2 ${scanMode === 'camera' ? 'bg-slateBlue/20 text-blue-700 border border-blue-200' : 'bg-white text-slateBlue border border-ink/20 hover:bg-slate-100'}`}
                >
                  <Camera size={16} /> Camera
                </button>
              </div>
              
              <div className="p-6">
                {previewUrl ? (
                  <div className="space-y-4">
                    <div className="relative rounded-none overflow-hidden border border-ink/20 bg-slate-100 h-64 flex items-center justify-center">
                      <img src={previewUrl} alt="Preview" className={`max-h-full max-w-full object-contain ${uploading ? 'opacity-70' : ''}`} />
                      {uploading && <div className="scanner-laser"></div>}
                      <button 
                        onClick={() => { setFile(null); setPreviewUrl(null) }}
                        className="absolute top-2 right-2 bg-white p-1.5 rounded-full shadow-md text-slateBlue hover:text-critical transition-colors"
                      >
                        <XCircle size={20} />
                      </button>
                    </div>
                    <button 
                      onClick={() => handleUpload(file)}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slateBlue hover:bg-slateBlue/90 text-white rounded-none font-medium transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {uploading ? (
                        <>
                          <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                          Running AI Analysis...
                        </>
                      ) : (
                        <>
                          <Search size={20} />
                          {!user ? 'Scan & Submit to Govt' : 'Analyze Compliance'}
                        </>
                      )}
                    </button>
                  </div>
                ) : scanMode === 'camera' ? (
                  <div className="space-y-4">
                    <div className="relative rounded-none overflow-hidden border border-ink/20 bg-ink h-64 flex flex-col items-center justify-center">
                      <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "environment" }}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button 
                      onClick={capturePhoto}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-compliant hover:bg-emerald-700 text-white rounded-none font-medium transition-colors shadow-sm"
                    >
                      <Camera size={20} />
                      {!user ? 'Capture & Submit to Govt' : 'Capture & Analyze'}
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-slate-300 border-dashed rounded-none cursor-pointer bg-paper hover:bg-slate-100 transition-colors">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-12 h-12 text-slate-400 mb-3" />
                      <p className="mb-2 text-sm text-slateBlue"><span className="font-semibold text-slateBlue">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-slateBlue/80">PNG, JPG or JPEG</p>
                    </div>
                    <input type="file" className="hidden" accept="image/*" capture="environment" onChange={handleFileChange} />
                  </label>
                )}
              </div>
            </div>
          </div>

        {/* Inspections History Table */}
        {user && (<div className="xl:col-span-3 bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] rounded-none overflow-hidden">
          <div className="p-6 border-b border-ink/20 bg-paper/50">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-none text-indigo-600">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-ink leading-tight font-serif">Inspection Database</h2>
                  <p className="text-sm text-slateBlue/80 mt-1">Search and manage compliance records</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-4 mt-4 md:mt-0">
                {userRole === 'admin' && (
                  <button
                    onClick={() => {
                      const csvContent = "data:text/csv;charset=utf-8," 
                        + "ID,Date,MRP,Quantity,Compliant,Violations\n"
                        + inspections.map(h => `${h.id},${new Date(h.scan_date).toLocaleDateString()},${h.extracted_data?.mrp || 'N/A'},${h.extracted_data?.net_quantity || 'N/A'},${h.is_compliant ? 'Yes' : 'No'},"${(h.validation_results?.violations || []).join('; ')}"`).join("\n");
                      const encodedUri = encodeURI(csvContent);
                      const link = document.createElement("a");
                      link.setAttribute("href", encodedUri);
                      link.setAttribute("download", "inspection_report.csv");
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="px-4 py-2 bg-compliant text-white font-medium rounded-none hover:bg-emerald-700 transition-colors shadow-sm text-sm whitespace-nowrap"
                  >
                    Export CSV
                  </button>
                )}
              </div>
            </div>
            
            {/* Advanced Filters Row */}
            <div className="mt-4 flex flex-wrap items-center gap-3 bg-slate-50 p-3 border border-ink/10">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" placeholder="Search Company or Violations..." className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-none text-sm outline-none focus:ring-1 focus:ring-slateBlue" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              
              <select className="px-3 py-1.5 border border-slate-300 rounded-none text-sm bg-white outline-none" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="ALL">All Status</option>
                <option value="COMPLIANT">Compliant</option>
                <option value="NON_COMPLIANT">Fail (Violations)</option>
              </select>

              <select className="px-3 py-1.5 border border-slate-300 rounded-none text-sm bg-white outline-none" value={filterViolationType} onChange={e => setFilterViolationType(e.target.value)}>
                <option value="ALL">All Violation Types</option>
                <option value="MRP">MRP Related</option>
                <option value="Weight">Weight / Quantity</option>
                <option value="Date">Date / Mfg</option>
                <option value="Address">Address / Contact</option>
              </select>
              
              <div className="flex items-center gap-2 border border-slate-300 bg-white px-2">
                <span className="text-xs text-slate-500 font-medium uppercase">From:</span>
                <input type="date" className="py-1.5 border-none text-sm outline-none" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
              </div>
              <div className="flex items-center gap-2 border border-slate-300 bg-white px-2">
                <span className="text-xs text-slate-500 font-medium uppercase">To:</span>
                <input type="date" className="py-1.5 border-none text-sm outline-none" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
              </div>
            </div>
          </div>
          
          <div className="overflow-auto max-h-[600px] relative">
            <table className="w-full">
              <thead className="sticky top-0 z-10 bg-paper shadow-sm">
                <tr className="text-left text-xs font-semibold text-slateBlue/80 uppercase tracking-wider border-b border-ink/20">
                  <th className="px-6 py-4 w-24">Image</th>
                  <th className="px-6 py-4 w-48">Date & Location</th>
                  <th className="px-6 py-4 w-1/3">Extracted Label Data</th>
                  <th className="px-6 py-4">Status & Violations</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInspections.filter(i => i.inspector_id !== 'PUBLIC').length > 0 ? (
                  filteredInspections.filter(i => i.inspector_id !== 'PUBLIC').map((insp) => (
                    <tr key={insp.id} className="hover:bg-paper/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="w-16 h-16 rounded-none overflow-hidden border border-ink/20 shadow-sm bg-white">
                          <img 
                            src={insp.image_paths[0]?.startsWith('http') ? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%233b82f6' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'%3E%3C/path%3E%3Cpath d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'%3E%3C/path%3E%3C/svg%3E" : `${API_BASE_URL.replace('/api/v1', '')}/${insp.image_paths[0]}`} 
                            alt="Product" 
                            className={`w-full h-full ${insp.image_paths[0]?.startsWith('http') ? 'object-center p-4 bg-slateBlue/10' : 'object-cover'}`}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23cbd5e1' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
                              e.target.className = "w-full h-full object-center p-4 bg-paper";
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-ink/80 font-medium text-sm">{new Date(insp.scan_date).toLocaleDateString()}</div>
                          <div className="text-slateBlue/80 text-xs">{new Date(insp.scan_date).toLocaleTimeString()}</div>
                          {insp.location_gps && (
                            <div className="text-slateBlue text-[10px] mt-1 font-medium bg-slateBlue/10 px-2 py-0.5 rounded-full inline-flex items-center w-max border border-blue-100">
                              📍 {insp.location_gps}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {insp.extracted_data ? (
                          <div className="flex flex-col gap-1 text-sm mt-2">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1 w-full max-w-2xl">
                              <span className="font-medium text-ink/80">Brand:</span>
                              <span className="text-slateBlue whitespace-normal w-full leading-snug">{insp.extracted_data.manufacturer || 'N/A'}</span>
                              {insp.extracted_data.manufacturer && manufacturerViolations[insp.extracted_data.manufacturer.toLowerCase().trim().split(',')[0]] > 1 && (
                                <span className="bg-critical/20 text-critical text-[10px] font-bold px-1.5 py-0.5 rounded border border-critical/30 whitespace-nowrap">
                                  {manufacturerViolations[insp.extracted_data.manufacturer.toLowerCase().trim().split(',')[0]] > 2 ? '🔴 Critical Offender' : '🟡 Repeat Offender'}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1"><span className="font-medium text-ink/80">MRP:</span> <span className="text-slateBlue">{insp.extracted_data.mrp ? '₹' + insp.extracted_data.mrp : 'N/A'}</span></div>
                            {insp.extracted_data.selling_price && (
                              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1"><span className="font-medium text-ink/80">Selling Price:</span> <span className="text-critical font-bold">₹{insp.extracted_data.selling_price}</span></div>
                            )}
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1"><span className="font-medium text-ink/80">Net Qty:</span> <span className="text-slateBlue">{insp.extracted_data.net_quantity || 'N/A'}</span></div>
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1"><span className="font-medium text-ink/80">Mfg/Pkd Date:</span> <span className="text-slateBlue">{insp.extracted_data.mfg_date || 'N/A'}</span></div>
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1"><span className="font-medium text-ink/80">Consumer Care:</span> <span className="text-slateBlue whitespace-normal">{insp.extracted_data.consumer_care || 'N/A'}</span></div>
                            {insp.extracted_data.barcode && (
                                <div className="flex flex-col md:flex-row md:items-center gap-2 mt-2 pt-2 border-t border-ink/10">
                                  <span className="font-medium text-ink/80">Barcode (GS1):</span> 
                                  <span className="text-slateBlue font-mono text-xs">{insp.extracted_data.barcode}</span>
                                  {insp.extracted_data.gs1_verification && (
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${insp.extracted_data.gs1_verification.includes('FAKE') ? 'bg-critical/20 text-critical border-critical/30 animate-pulse' : 'bg-compliant/10 text-emerald-700 border-emerald-200'}`}>
                                      {insp.extracted_data.gs1_verification}
                                    </span>
                                  )}
                                </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No data extracted</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-3 mt-2">
                          <div className="flex items-center gap-2">
                            <span className={insp.is_compliant ? 'stamp-compliant' : (insp.extracted_data?.gs1_verification?.includes('FAKE') ? 'stamp-critical' : 'stamp-violation')}>
                              {insp.is_compliant ? 'COMPLIANT' : (insp.extracted_data?.gs1_verification?.includes('FAKE') ? 'CRITICAL FAKE' : 'VIOLATION')}
                            </span>
                            {!insp.is_compliant && insp.validation_results?.total_fine && (
                              <span className="inline-flex px-2 py-1 text-[11px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-200">
                                E-CHALLAN: ₹{insp.validation_results.total_fine.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {!insp.is_compliant && insp.validation_results?.violations && (
                            <ul className="text-xs text-critical list-disc list-inside mt-1 space-y-1">
                              {insp.validation_results.violations.map((v, i) => <li key={i} className="whitespace-normal max-w-2xl">{v}</li>)}
                            </ul>
                          )}
                          

                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col gap-2 items-end">
                          <div className="flex gap-2">
                            {userRole === 'admin' && (
                              <button 
                                onClick={() => handleDelete(insp.id)}
                                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slateBlue hover:bg-red-50 hover:text-critical rounded-md text-sm font-medium transition-colors border border-ink/20"
                              >
                                <Trash2 size={14} />
                                Delete
                              </button>
                            )}
                            <button 
                              onClick={() => generatePDF(insp)}
                              className="flex items-center gap-1 px-3 py-1.5 bg-critical/10 text-critical hover:bg-critical/20 rounded-md text-sm font-medium transition-colors border border-rose-200"
                            >
                              <FileText size={14} />
                              PDF
                            </button>
                            <button 
                              onClick={() => {
                                const content = `
                                  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
                                  <head><meta charset='utf-8'><title>Inspection Report</title></head><body>
                                  <h3 style='text-align:center; color:#475569;'>Official Inspection Report (Editable)</h3>

                                        <hr>
                                        <p><b>Inspection Date:</b> ${new Date(insp.scan_date).toLocaleString()}</p>
                                        <p><b>Location (GPS):</b> ${insp.location_gps || 'N/A'}</p>
                                        <p><b>Inspector ID:</b> ${insp.inspector_id || 'System'}</p>
                                        <hr>
                                        <h4>Extracted Declarations:</h4>
                                        <ul>
                                          <li><b>MRP:</b> ${insp.extracted_data.mrp ? 'Rs. ' + insp.extracted_data.mrp : 'N/A'}</li>
                                          <li><b>Net Quantity:</b> ${insp.extracted_data.net_quantity || 'N/A'}</li>
                                          <li><b>Mfg Date:</b> ${insp.extracted_data.mfg_date || 'N/A'}</li>
                                          <li><b>Manufacturer:</b> ${insp.extracted_data.manufacturer || 'N/A'}</li>
                                          <li><b>Consumer Care:</b> ${insp.extracted_data.consumer_care || 'N/A'}</li>
                                        </ul>
                                        <h4>Compliance Status: <span style='color:${insp.is_compliant ? 'green' : 'red'}'>${insp.is_compliant ? 'COMPLIANT' : 'NON-COMPLIANT'}</span></h4>
                                        ${!insp.is_compliant ? `<h4>Violations Detected:</h4><ul>${insp.validation_results?.violations?.map(v => `<li>${v}</li>`).join('')}</ul>` : ''}
                                        <br><br>
                                        <p><b>Inspector Remarks:</b> _________________________________________________</p>
                                        <p><b>Signature:</b> ____________________</p>
                                        </body></html>
                                      `;
                                      const blob = new Blob(['\ufeff', content], { type: 'application/msword' });
                                      const url = URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `Inspection_Report_${insp.id}.doc`;
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-md text-sm font-medium transition-colors border border-indigo-200"
                                  >
                                    <FileText size={14} />
                                    Word
                                  </button>
                                </div>
                              {!insp.is_compliant && (
                                (() => {
                                  const emailRaw = insp.extracted_data?.consumer_care || '';
                                  const emailMatch = emailRaw.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
                                  const email = emailMatch ? emailMatch[1] : 'legal@manufacturer.com';
                                  
                                  const subject = encodeURIComponent('URGENT: Legal Metrology Violation Notice');
                                  let penaltyText = "";
                                  if (insp.validation_results?.penalties?.length > 0) {
                                    penaltyText = `\n\nBased on the above violations, an E-Challan has been generated against your firm under the Legal Metrology Act, 2009. The breakdown of sections violated and applicable penalties are as follows:\n` +
                                                  insp.validation_results.penalties.map(p => `• [${p.section}] ${p.violation} - Fine: Rs. ${p.fine.toLocaleString()}`).join('\n') +
                                                  `\n\nTOTAL PENALTY DUE: Rs. ${insp.validation_results.total_fine.toLocaleString()}\n`;
                                  }

                                  const warningBodyText = `Dear Manufacturer,\n\nThis is an official WARNING notice from the Legal Metrology Department.\n\nDuring a recent digital inspection of your packaged commodity on ${new Date(insp.scan_date).toLocaleDateString()}, our AI Enforcement System detected the following non-compliances under the Legal Metrology (Packaged Commodities) Rules, 2011:\n\n${(insp.validation_results?.violations || []).map(v => '- ' + v).join('\n')}\n\nYou are hereby directed to rectify these violations immediately. Failure to do so will result in monetary penalties.\n\nSincerely,\nLegal Metrology Officer\nEnforcement Directorate`;
                                  const penaltyBodyText = `Dear Manufacturer,\n\nThis is an official PENALTY CHALLAN from the Legal Metrology Department.\n\nDuring a recent digital inspection of your packaged commodity on ${new Date(insp.scan_date).toLocaleDateString()}, our AI Enforcement System detected the following non-compliances under the Legal Metrology (Packaged Commodities) Rules, 2011:\n\n${(insp.validation_results?.violations || []).map(v => '- ' + v).join('\n')}${penaltyText}\nYou are hereby directed to rectify these violations immediately and submit a compliance report along with the penalty payment within 15 days.\n\nSincerely,\nLegal Metrology Officer\nEnforcement Directorate`;
                                  
                                  return (
                                    <div className="flex flex-col gap-2 mt-2 w-full">
                                      <button
                                        onClick={() => {
                                          setNoticeForm({ to: email, subject: 'WARNING NOTICE: Legal Metrology Violation', body: warningBodyText });
                                          setNoticeModal({ isOpen: true, data: insp });
                                        }}
                                        className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-none text-sm font-medium transition-colors border border-amber-300 shadow-[2px_2px_0px_0px_rgba(217,119,6,1)]"
                                      >
                                        <AlertTriangle size={14} />
                                        Warning Notice
                                      </button>
                                      
                                      <button
                                        onClick={() => {
                                          setNoticeForm({ to: email, subject: 'E-CHALLAN: Legal Metrology Violation Penalty', body: penaltyBodyText });
                                          setNoticeModal({ isOpen: true, data: insp });
                                        }}
                                        className="flex items-center justify-center gap-1 w-full px-3 py-1.5 bg-red-50 text-critical hover:bg-critical/20 rounded-none text-sm font-medium transition-colors border border-critical/30 shadow-[2px_2px_0px_0px_rgba(178,58,46,1)]"
                                      >
                                        <Mail size={14} />
                                        Penalty Challan
                                      </button>
                                    </div>
                                  );
                                })()
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="text-center py-12">
                          <div className="flex flex-col items-center justify-center text-slate-400">
                            <Clock size={32} className="mb-2" />
                            <p>No inspection records found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        )}
        {/* Profile View */}
        {currentView === 'profile' && (
          <div className="max-w-3xl mx-auto mt-4">
            <div className="bg-white rounded-none border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-slateBlue"></div>
              
              <h2 className="text-2xl font-bold text-ink mb-6 font-serif border-b border-ink/10 pb-4 flex items-center gap-2">
                👤 Officer Dossier
              </h2>
              
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Photo Section */}
                <div className="flex flex-col items-center gap-4 w-full md:w-1/3">
                  <div className="w-32 h-32 rounded-none border-4 border-paper shadow-md overflow-hidden bg-slate-100 flex items-center justify-center relative group">
                    {userProfile?.customPhoto ? (
                      <img src={userProfile.customPhoto} alt="Profile" className="w-full h-full object-cover" />
                    ) : user?.picture ? (
                      <img src={user.picture} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl text-slate-400">{user?.name ? user.name.charAt(0) : 'EO'}</span>
                    )}
                    <label className="absolute inset-0 bg-ink/60 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center cursor-pointer transition-opacity">
                      <UploadCloud size={24} />
                      <span className="text-xs mt-1">Change Photo</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setUserProfile({...userProfile, customPhoto: reader.result});
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-ink">{user?.name}</p>
                    <p className="text-xs font-mono text-slateBlue bg-slate-100 px-2 py-1 mt-1 border border-ink/10">ID: {user?.sub ? user.sub.substring(0,8).toUpperCase() : 'LM-OFFICER'}</p>
                  </div>
                </div>

                {/* Details Section */}
                <div className="w-full md:w-2/3 space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-slateBlue uppercase tracking-wider mb-1">Email Address (Google Auth)</label>
                    <input type="text" value={user?.email || ''} disabled className="w-full bg-slate-50 border border-slate-200 px-3 py-2 text-ink/70 font-mono text-sm cursor-not-allowed" />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-slateBlue uppercase tracking-wider mb-1">Mobile Number</label>
                    <input 
                      type="tel" 
                      placeholder="+91 XXXXX XXXXX"
                      value={userProfile.mobile}
                      onChange={(e) => setUserProfile({...userProfile, mobile: e.target.value})}
                      className="w-full bg-white border border-slate-300 px-3 py-2 text-ink focus:ring-2 focus:ring-slateBlue outline-none transition-all shadow-sm" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slateBlue uppercase tracking-wider mb-1">Jurisdiction / Location</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Mumbai South Zone"
                      value={userProfile.location}
                      onChange={(e) => setUserProfile({...userProfile, location: e.target.value})}
                      className="w-full bg-white border border-slate-300 px-3 py-2 text-ink focus:ring-2 focus:ring-slateBlue outline-none transition-all shadow-sm" 
                    />
                  </div>

                  <div className="pt-4 border-t border-ink/10 flex justify-end">
                    <button 
                      onClick={() => {
                        localStorage.setItem('legal_user_profile', JSON.stringify(userProfile));
                        const btn = document.getElementById('save-profile-btn');
                        btn.innerHTML = '✅ Saved Successfully';
                        btn.classList.add('bg-compliant');
                        btn.classList.remove('bg-slateBlue');
                        setTimeout(() => {
                          btn.innerHTML = 'Save Profile';
                          btn.classList.remove('bg-compliant');
                          btn.classList.add('bg-slateBlue');
                        }, 2000);
                      }}
                      id="save-profile-btn"
                      className="px-6 py-2 bg-slateBlue hover:bg-blue-700 text-white font-bold text-sm shadow-[2px_2px_0px_0px_rgba(15,27,45,1)] transition-colors border border-ink"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notice Drafting Modal */}
        {noticeModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/50 backdrop-blur-sm">
            <div className="bg-white rounded-none border-2 border-ink shadow-[8px_8px_0px_0px_rgba(15,27,45,1)] rounded-none w-full max-w-2xl overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-ink/10 bg-paper flex justify-between items-center">
                <h3 className="font-bold text-ink flex items-center gap-2 font-serif">
                  <Mail className="text-critical" size={20} />
                  Draft Legal Notice
                </h3>
                <button onClick={() => setNoticeModal({ isOpen: false, data: null })} className="text-slate-400 hover:text-slateBlue transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* Official Letterhead Header */}
                <div className="border-b-2 border-ink pb-4 text-center font-serif bg-paper p-4 border-2 shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] mb-6">
                  <h2 className="text-xl font-bold text-ink uppercase tracking-widest">Department of Legal Metrology</h2>
                  <p className="text-xs text-ink/80 font-mono mt-1">GOVERNMENT OF INDIA • ENFORCEMENT DIVISION</p>
                  <div className="mt-3 inline-block px-4 py-1 bg-critical text-white font-bold text-[10px] uppercase tracking-widest border border-ink">Official Legal Notice</div>
                </div>
                
                <div>
                  <label className="block text-xs font-semibold text-slateBlue/80 uppercase tracking-wider mb-1">To (Manufacturer)</label>
                  <input type="email" className="w-full px-3 py-2 border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm" value={noticeForm.to} onChange={e => setNoticeForm({...noticeForm, to: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slateBlue/80 uppercase tracking-wider mb-1">Subject</label>
                  <input type="text" className="w-full px-3 py-2 border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-ink" value={noticeForm.subject} onChange={e => setNoticeForm({...noticeForm, subject: e.target.value})} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slateBlue/80 uppercase tracking-wider mb-1">Notice Body</label>
                  <textarea rows="10" className="w-full px-3 py-2 border border-slate-300 rounded-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-mono text-ink/80 whitespace-pre-wrap leading-relaxed resize-none" value={noticeForm.body} onChange={e => setNoticeForm({...noticeForm, body: e.target.value})}></textarea>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-ink/10 bg-paper flex justify-end gap-3">
                <button onClick={() => setNoticeModal({ isOpen: false, data: null })} className="px-4 py-2 text-sm font-medium text-slateBlue hover:bg-slate-200 bg-slate-100 rounded-none transition-colors">Cancel</button>
                <a 
                  href={`mailto:${noticeForm.to}?subject=${encodeURIComponent(noticeForm.subject)}&body=${encodeURIComponent(noticeForm.body)}`}
                  onClick={() => setNoticeModal({ isOpen: false, data: null })}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-none transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Mail size={16} /> Open Email Client
                </a>
                <a 
                  href={`https://mail.google.com/mail/?view=cm&fs=1&to=${noticeForm.to}&su=${encodeURIComponent(noticeForm.subject)}&body=${encodeURIComponent(noticeForm.body)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setNoticeModal({ isOpen: false, data: null })}
                  className="px-4 py-2 text-sm font-medium text-white bg-slateBlue hover:bg-blue-700 rounded-none transition-colors flex items-center gap-2 shadow-sm"
                >
                  Gmail (Web)
                </a>
              </div>
            </div>
          </div>
        )}

        {/* AI Chatbot */}
        <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
          {isChatOpen && (
            <div className="bg-white w-80 sm:w-96 rounded-none shadow-2xl border border-ink/20 mb-4 overflow-hidden flex flex-col h-[500px]">
              <div className="bg-slateBlue px-4 py-3 flex justify-between items-center text-white">
                <div className="flex items-center gap-2">
                  <Bot size={20} />
                  <span className="font-semibold text-sm">LegalMetro Assistant</span>
                </div>
                <button onClick={() => setIsChatOpen(false)} className="text-blue-100 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-paper">
                {chatMessages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-none px-4 py-2 text-sm ${msg.role === 'user' ? 'bg-slateBlue text-white rounded-br-none' : 'bg-white border border-ink/20 text-ink/80 rounded-bl-none shadow-sm'}`}>
                      <span className="whitespace-pre-wrap">{msg.role === 'assistant' ? formatChatMessage(msg.content) : msg.content}</span>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-ink/20 text-slateBlue/80 rounded-none rounded-bl-none shadow-sm px-4 py-2 text-sm flex gap-1 items-center">
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                )}
              </div>
              <form onSubmit={handleChatSubmit} className="p-3 bg-white border-t border-ink/10 flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about Legal Metrology rules..."
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-none outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                />
                <button type="submit" disabled={isChatLoading} className="bg-slateBlue text-white p-2 rounded-none hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  <Send size={18} />
                </button>
              </form>
            </div>
          )}
          
          <button 
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`text-white transition-all flex items-center justify-center border-2 border-ink shadow-[4px_4px_0px_0px_rgba(15,27,45,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0px_0px_rgba(15,27,45,1)] ${isChatOpen ? 'bg-critical p-4 rounded-full' : 'bg-slateBlue px-6 py-4 rounded-full gap-3'}`}
          >
            {isChatOpen ? <X size={28} /> : <Bot size={28} />}
            {!isChatOpen && <span className="font-bold font-serif tracking-wide text-lg">AI Assistant</span>}
          </button>
        </div>

      </main>
      {/* Admin Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-2 border-ink shadow-[8px_8px_0px_0px_rgba(15,27,45,1)] p-8 max-w-sm w-full relative">
            <button onClick={() => setShowLoginModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-critical">
              <X size={24} />
            </button>
            <div className="text-center mb-6">
              <ShieldCheck size={48} className="text-slateBlue mx-auto mb-4" />
              <h2 className="text-2xl font-bold font-serif text-ink">Admin Portal</h2>
              <p className="text-sm text-slate-500 mt-2">Sign in to access enforcement tools.</p>
            </div>
            <GoogleOAuthProvider clientId={CLIENT_ID}>
              <div className="flex justify-center">
                <GoogleLogin
                  onSuccess={handleLoginSuccess}
                  onError={() => console.log('Login Failed')}
                  useOneTap
                  theme="outline"
                  size="large"
                />
              </div>
            </GoogleOAuthProvider>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
