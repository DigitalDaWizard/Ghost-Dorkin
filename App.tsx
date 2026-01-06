
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Loader2, 
  ExternalLink, 
  ShieldAlert, 
  ChevronRight,
  ShieldCheck,
  Target,
  Globe,
  Bot,
  Settings as SettingsIcon,
  X,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  Copy,
  Activity,
  ChevronDown,
  AlertCircle,
  Star,
  RefreshCw,
  WifiOff,
  ClipboardCopy,
  LayoutGrid,
  Zap,
  Cpu,
  Binary,
  Filter,
  SortAsc,
  Calendar
} from 'lucide-react';
import { DORK_TEMPLATES } from './constants';
import { DorkTemplate, ScanResult, AnalysisResponse, ScanStatus, AppConfig, EngineProvider, Threat } from './types';
import { aiService } from './services/aiService';

const RegularGhost = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C7.58172 2 4 5.58172 4 10V21L6 19L8 21L10 19L12 21L14 19L16 21L18 19L20 21V10C20 5.58172 16.4183 2 12 2Z" 
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" 
      className="text-neon" fill="rgba(163, 255, 0, 0.1)" />
    <circle cx="9" cy="10" r="1.5" fill="currentColor" className="text-neon" />
    <circle cx="15" cy="10" r="1.5" fill="currentColor" className="text-neon" />
  </svg>
);

const SeverityIndicator = ({ score }: { score: number }) => {
  const getLevel = () => {
    if (score >= 9.0) return { label: 'CRITICAL', style: 'bg-red-500/20 text-red-500 border-red-500/40', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.3)]' };
    if (score >= 7.0) return { label: 'HIGH', style: 'bg-orange-500/20 text-orange-500 border-orange-500/40', glow: '' };
    if (score >= 4.0) return { label: 'MEDIUM', style: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/40', glow: '' };
    return { label: 'LOW', style: 'bg-neon/20 text-neon border-neon/40', glow: '' };
  };
  const { label, style, glow } = getLevel();
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full border backdrop-blur-md transition-all ${style} ${glow}`}>
      <span className="text-[8px] font-black tracking-widest leading-none opacity-70">CVSS</span>
      <span className="text-[11px] font-bold leading-none">{score.toFixed(1)}</span>
    </div>
  );
};

const StatusTracker = ({ status }: { status: ScanStatus }) => {
  const getStatusConfig = () => {
    switch (status) {
      case ScanStatus.INITIALIZING:
        return { label: 'Initializing Core', icon: <Cpu className="animate-pulse text-blue-400" />, color: 'text-blue-400', bg: 'bg-blue-400/10' };
      case ScanStatus.DORKING:
        return { label: 'Executing Neural Dorks', icon: <Globe className="animate-spin-slow text-neon" />, color: 'text-neon', bg: 'bg-neon/10' };
      case ScanStatus.ANALYZING:
        return { label: 'Neural Insights Analysis', icon: <Binary className="animate-bounce text-purple-400" />, color: 'text-purple-400', bg: 'bg-purple-400/10' };
      case ScanStatus.COMPLETED:
        return { label: 'Operation Successful', icon: <CheckCircle2 className="text-emerald-400" />, color: 'text-emerald-400', bg: 'bg-emerald-400/10' };
      case ScanStatus.ERROR:
        return { label: 'Protocol Failure', icon: <ShieldAlert className="text-red-500" />, color: 'text-red-500', bg: 'bg-red-500/10' };
      default:
        return { label: 'System Idle', icon: <Zap className="text-slate-500" />, color: 'text-slate-500', bg: 'bg-white/5' };
    }
  };

  const config = getStatusConfig();

  return (
    <div className={`inline-flex items-center gap-3 px-4 py-2 rounded-full border border-white/5 glass transition-all duration-500 ${config.bg}`}>
      <div className="flex items-center justify-center">
        {React.cloneElement(config.icon as React.ReactElement, { size: 14 })}
      </div>
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${config.color}`}>
        {config.label}
      </span>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'recon' | 'guide'>('recon');
  const [target, setTarget] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DorkTemplate | null>(DORK_TEMPLATES[0]);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [status, setStatus] = useState<ScanStatus>(ScanStatus.IDLE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<{target: string, timestamp: string}[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [pinnedTemplates, setPinnedTemplates] = useState<string[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  
  // Filtering and Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSource, setFilterSource] = useState<'all' | 'Google' | 'Brave'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'title' | 'source'>('relevance');

  const [config, setConfig] = useState<AppConfig>({
    scanlines: false,
    grid: true,
    maxResults: 10,
    activeEngine: 'gemini',
    keys: { openrouter: '', huggingface: '', brave: '' }
  });

  useEffect(() => {
    const savedHistory = localStorage.getItem('ghost_dork_history');
    if (savedHistory) setScanHistory(JSON.parse(savedHistory));
    
    const savedConfig = localStorage.getItem('ghost_dork_config');
    if (savedConfig) setConfig(JSON.parse(savedConfig));

    const savedPins = localStorage.getItem('ghost_dork_pins');
    if (savedPins) setPinnedTemplates(JSON.parse(savedPins));
  }, []);

  const sortedTemplates = useMemo(() => {
    return [...DORK_TEMPLATES].sort((a, b) => {
      const aPinned = pinnedTemplates.includes(a.name);
      const bPinned = pinnedTemplates.includes(b.name);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [pinnedTemplates]);

  const togglePin = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPins = pinnedTemplates.includes(name) 
      ? pinnedTemplates.filter(p => p !== name)
      : [...pinnedTemplates, name];
    setPinnedTemplates(newPins);
    localStorage.setItem('ghost_dork_pins', JSON.stringify(newPins));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleCopyAll = () => {
    if (results.length === 0) return;
    const content = results.map(r => `Source: ${r.source}\nTitle: ${r.title}\nLink: ${r.href}\n---`).join('\n\n');
    navigator.clipboard.writeText(content);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleRunScan = async () => {
    if (!target || !selectedTemplate) return;
    setStatus(ScanStatus.INITIALIZING);
    setErrorMessage(null);
    setResults([]);
    setAnalysis(null);
    setSearchQuery('');
    setFilterSource('all');
    try {
      setStatus(ScanStatus.DORKING);
      const query = selectedTemplate.prompt.replace(/{target}/g, target);
      const { sources } = await aiService.performDorkSearch(query, config.activeEngine, config.keys);
      const limitedSources = sources.slice(0, config.maxResults);
      setResults(limitedSources);
      
      if (limitedSources.length > 0) {
        setStatus(ScanStatus.ANALYZING);
        const report = await aiService.analyzeResults(target, limitedSources, config.activeEngine, config.keys);
        setAnalysis(report);
      } else {
        setAnalysis({
          summary: "No public data nodes identified for this attack vector and target combination.",
          potentialThreats: [],
          recommendations: ["Try a different attack vector or verify the target domain."]
        });
      }
      setStatus(ScanStatus.COMPLETED);
      const newEntry = { target, timestamp: new Date().toLocaleTimeString() };
      const updated = [newEntry, ...scanHistory].slice(0, 5);
      setScanHistory(updated);
      localStorage.setItem('ghost_dork_history', JSON.stringify(updated));
    } catch (error: any) {
      console.error(error);
      setStatus(ScanStatus.ERROR);
      setErrorMessage(error.message || "An unexpected system failure occurred during reconnaissance.");
    }
  };

  const getSourceIcon = (source: string) => {
    if (source.toLowerCase().includes('google')) return <Search size={10} className="text-blue-400" />;
    if (source.toLowerCase().includes('brave')) return <ShieldCheck size={10} className="text-orange-400" />;
    return <Globe size={10} />;
  };

  // Computed Discovery Log items
  const displayResults = useMemo(() => {
    let list = [...results];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.title.toLowerCase().includes(q) || 
        r.href.toLowerCase().includes(q) || 
        r.body.toLowerCase().includes(q)
      );
    }

    // Source filter
    if (filterSource !== 'all') {
      list = list.filter(r => r.source === filterSource);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'source') return a.source.localeCompare(b.source);
      return 0; // relevance is original order
    });

    return list;
  }, [results, searchQuery, filterSource, sortBy]);

  const GuidePage = () => (
    <div className="max-w-4xl mx-auto space-y-12 py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-extrabold tracking-tight">Operation Guide</h2>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">Master the art of reconnaissance with Ghost Dork AI. Follow these protocols for effective target analysis.</p>
      </div>

      <div className="grid gap-6">
        {[
          {
            title: "Configuration",
            icon: <SettingsIcon className="text-blue-400" />,
            steps: [
              "Access the Settings panel via the gear icon in the navigation bar.",
              "Choose your Neural Engine (Gemini is recommended for native search grounding).",
              "Connect your API keys for OpenRouter or Brave Search if using external engines."
            ]
          },
          {
            title: "Priority Protocols",
            icon: <Star className="text-yellow-400" />,
            steps: [
              "Identify attack vectors you use most frequently.",
              "Use the star icon next to any attack vector in the menu to pin it to the top.",
              "Pinned attacks are prioritized in your interface for rapid deployment."
            ]
          },
          {
            title: "Target Selection",
            icon: <Target className="text-neon" />,
            steps: [
              "Enter a target domain (e.g., example.com) in the Recon input field.",
              "Select an Attack from the dropdown menu that matches your objective.",
              "Use 'Admin Panel' for access points or 'Exposed Configuration' for secret leaks."
            ]
          },
          {
            title: "Analysis & Extraction",
            icon: <FileSearch className="text-purple-400" />,
            steps: [
              "Execute the scan to retrieve live data from global search indexes.",
              "Review the discovered Data Nodes for direct evidence of exposure.",
              "Wait for the Neural Intelligence layer to score vulnerabilities based on CVSS."
            ]
          }
        ].map((section, idx) => (
          <div key={idx} className="glass-card rounded-apple p-8 flex gap-6">
            <div className="h-12 w-12 rounded-2xl glass flex items-center justify-center shrink-0">
              {section.icon}
            </div>
            <div className="space-y-4">
              <h3 className="text-xl font-bold">{section.title}</h3>
              <ul className="space-y-3">
                {section.steps.map((step, sIdx) => (
                  <li key={sIdx} className="flex items-start gap-3 text-slate-400 text-sm leading-relaxed">
                    <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/20 shrink-0"></div>
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-neon/10 border border-neon/20 rounded-apple p-8 text-center">
        <h3 className="text-neon font-bold mb-2">Ready to initiate?</h3>
        <p className="text-slate-300 text-sm mb-6">Switch back to the Recon tab to start your first analysis.</p>
        <button 
          onClick={() => setActiveTab('recon')}
          className="bg-neon text-black font-bold px-8 py-3 rounded-full hover:scale-105 transition-transform"
        >
          Return to Recon
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-16 glass z-50 px-6 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <RegularGhost />
          <span className="text-lg font-extrabold tracking-tight">Ghost Dork</span>
        </div>

        <div className="flex items-center bg-white/5 p-1 rounded-full border border-white/10">
          <button 
            onClick={() => setActiveTab('recon')}
            className={`px-6 py-1.5 rounded-full text-sm font-semibold transition-all ${activeTab === 'recon' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Recon
          </button>
          <button 
            onClick={() => setActiveTab('guide')}
            className={`px-6 py-1.5 rounded-full text-sm font-semibold transition-all ${activeTab === 'guide' ? 'bg-white text-black' : 'text-slate-400 hover:text-white'}`}
          >
            Guide
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="h-10 w-10 glass rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <SettingsIcon size={18} />
          </button>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-6 max-w-7xl mx-auto">
        {activeTab === 'guide' ? (
          <GuidePage />
        ) : (
          <div className="space-y-10 animate-in fade-in duration-1000">
            {/* Header & Target Input */}
            <div className="flex flex-col items-center text-center space-y-6 py-10">
              <div className="space-y-2">
                <h1 className="text-6xl font-black tracking-tighter uppercase">Intelligent Recon</h1>
                <p className="text-slate-500 font-medium uppercase tracking-[0.2em] text-[10px]">Neural engine online</p>
              </div>

              <div className="w-full max-w-2xl flex flex-col items-center gap-6">
                {/* Attacks Dropdown with Pinning */}
                <div className="w-full max-w-sm relative group">
                  <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-neon transition-colors">
                    <Bot size={16} />
                  </div>
                  <div className="relative">
                    <select
                      value={selectedTemplate?.name}
                      onChange={(e) => setSelectedTemplate(DORK_TEMPLATES.find(t => t.name === e.target.value) || null)}
                      className="w-full bg-white/[0.03] border border-white/10 rounded-full py-4 pl-14 pr-12 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-neon/5 focus:border-neon transition-all appearance-none cursor-pointer"
                    >
                      {sortedTemplates.map(t => (
                        <option key={t.name} value={t.name} className="bg-[#050505] text-white">
                          {pinnedTemplates.includes(t.name) ? '★ ' : ''}Attack: {t.name}
                        </option>
                      ))}
                    </select>
                    <div 
                      onClick={(e) => selectedTemplate && togglePin(selectedTemplate.name, e as any)}
                      className="absolute right-12 top-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform p-1"
                    >
                      <Star size={16} className={selectedTemplate && pinnedTemplates.includes(selectedTemplate.name) ? "text-yellow-400 fill-yellow-400" : "text-slate-600"} />
                    </div>
                  </div>
                  <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                    <ChevronDown size={16} />
                  </div>
                </div>

                {/* Target Input */}
                <div className="w-full relative group">
                  <input 
                    type="text"
                    placeholder="enter target domain"
                    value={target}
                    onChange={(e) => setTarget(e.target.value.toLowerCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleRunScan()}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-full py-6 pl-10 pr-56 text-lg md:text-xl font-medium focus:outline-none focus:ring-4 focus:ring-neon/10 focus:border-neon transition-all placeholder:text-slate-700"
                  />
                  <button 
                    onClick={handleRunScan}
                    disabled={!target || status === ScanStatus.DORKING || status === ScanStatus.ANALYZING}
                    className="absolute right-3 top-3 bottom-3 px-6 md:px-8 bg-neon text-black rounded-full font-bold flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
                  >
                    {status === ScanStatus.DORKING || status === ScanStatus.ANALYZING ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        <ArrowRight size={20} className="hidden sm:inline" />
                        <span>Execute</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Scan Status Tracker */}
                {status !== ScanStatus.IDLE && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-500">
                    <StatusTracker status={status} />
                  </div>
                )}
              </div>
            </div>

            {/* Content Grid */}
            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* Discovery Column */}
              <div className="space-y-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Discovery Log</h3>
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full border border-white/10 font-bold">{displayResults.length} / {results.length} Nodes</span>
                    </div>
                    {results.length > 0 && (
                      <button 
                        onClick={handleCopyAll}
                        className="flex items-center gap-2 text-[10px] font-bold text-neon hover:text-white transition-colors uppercase tracking-widest bg-white/5 py-1 px-3 rounded-full border border-white/5"
                      >
                        {copiedAll ? <CheckCircle2 size={12} /> : <ClipboardCopy size={12} />}
                        {copiedAll ? 'Copied!' : 'Copy All'}
                      </button>
                    )}
                  </div>

                  {/* Advanced Filters & Sorting */}
                  {results.length > 0 && (
                    <div className="glass p-3 rounded-2xl flex flex-col md:flex-row gap-3 border-white/5 animate-in fade-in slide-in-from-left-2 duration-500">
                      <div className="flex-1 relative group">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-neon transition-colors" />
                        <input 
                          type="text" 
                          placeholder="Search nodes..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-3 text-[11px] focus:outline-none focus:border-neon transition-all"
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <div className="relative group min-w-[100px]">
                          <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <select 
                            value={filterSource}
                            onChange={(e) => setFilterSource(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-neon appearance-none cursor-pointer"
                          >
                            <option value="all">All Sources</option>
                            <option value="Google">Google</option>
                            <option value="Brave">Brave</option>
                          </select>
                        </div>

                        <div className="relative group min-w-[100px]">
                          <SortAsc size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <select 
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-8 pr-2 text-[10px] font-bold uppercase tracking-wider focus:outline-none focus:border-neon appearance-none cursor-pointer"
                          >
                            <option value="relevance">Relevance</option>
                            <option value="title">Title A-Z</option>
                            <option value="source">Source</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Error Messaging UI */}
                {status === ScanStatus.ERROR && errorMessage && (
                  <div className="glass border-red-500/30 bg-red-500/5 p-6 rounded-apple animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-4 mb-3 text-red-500">
                      <ShieldAlert size={24} />
                      <h4 className="font-bold text-sm uppercase tracking-wider">System Breach: Connection Failed</h4>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed mb-4">{errorMessage}</p>
                    <button 
                      onClick={handleRunScan}
                      className="flex items-center gap-2 text-[10px] font-bold text-white hover:text-neon transition-colors uppercase tracking-widest"
                    >
                      <RefreshCw size={12} /> Retry Protocol
                    </button>
                  </div>
                )}

                <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                  {displayResults.length > 0 ? displayResults.map((res, i) => (
                    <div key={i} className="glass-card rounded-apple p-6 group hover:border-white/20 transition-all animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <h4 className="font-bold text-white group-hover:text-neon transition-colors leading-tight">
                          <a href={res.href} target="_blank" rel="noopener noreferrer">{res.title}</a>
                        </h4>
                        <ExternalLink size={14} className="text-slate-600 group-hover:text-neon transition-colors shrink-0" />
                      </div>
                      <p className="text-[11px] text-slate-500 font-mono truncate mb-4 italic">{res.href}</p>
                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest border-t border-white/5 pt-4">
                        {getSourceIcon(res.source)} Grounded via {res.source}
                      </div>
                    </div>
                  )) : results.length > 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center glass rounded-apple opacity-30">
                      <Search className="mb-4" />
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">No nodes match criteria</span>
                    </div>
                  ) : status !== ScanStatus.ERROR && (
                    <div className="h-64 flex flex-col items-center justify-center glass rounded-apple opacity-30">
                      {navigator.onLine ? <Activity className="mb-4" /> : <WifiOff className="mb-4 text-red-500" />}
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em]">
                        {navigator.onLine ? "Awaiting Discovery Feed" : "Offline Mode Detected"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis Column */}
              <div className="space-y-6">
                 <div className="flex items-center justify-between px-2">
                  <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Neural Insights</h3>
                  <div className="flex items-center gap-2 text-[9px] font-bold text-neon/60">
                    <AlertCircle size={10} /> CVSS v3.1 Standards
                  </div>
                </div>
                <div className="glass-card rounded-apple p-8 min-h-[500px]">
                  {analysis ? (
                    <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-700">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="h-1 w-8 bg-neon rounded-full"></div>
                          <h4 className="text-[10px] font-black text-neon uppercase tracking-widest">Executive Intelligence</h4>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium italic">"{analysis.summary}"</p>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Vulnerability Scoring</h4>
                        <div className="grid gap-4">
                          {analysis.potentialThreats.length > 0 ? analysis.potentialThreats.map((threat, i) => {
                            const getBorderColor = (s: number) => {
                              if (s >= 9.0) return 'border-l-red-500';
                              if (s >= 7.0) return 'border-l-orange-500';
                              if (s >= 4.0) return 'border-l-yellow-500';
                              return 'border-l-neon';
                            };
                            return (
                              <div key={i} className={`glass border border-white/5 border-l-4 ${getBorderColor(threat.severity)} p-5 rounded-2xl flex justify-between items-center transition-all hover:bg-white/[0.02]`}>
                                <span className="text-xs font-semibold text-slate-200 pr-6 leading-relaxed flex-1">{threat.description}</span>
                                <SeverityIndicator score={threat.severity} />
                              </div>
                            );
                          }) : (
                            <div className="text-xs text-slate-500 italic px-2">No exploitable threats found in current node data.</div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6 pt-6 border-t border-white/5">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Remediation Protocol</h4>
                        <div className="space-y-3">
                          {analysis.recommendations.map((rec, i) => (
                            <div key={i} className="flex gap-4 items-start text-xs text-slate-400 leading-relaxed group">
                              <CheckCircle2 size={14} className="text-neon shrink-0 mt-0.5 opacity-50 group-hover:opacity-100 transition-opacity" />
                              <span className="font-medium">{rec}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : status === ScanStatus.DORKING || status === ScanStatus.ANALYZING ? (
                    <div className="h-[400px] flex flex-col items-center justify-center space-y-6">
                      <div className="relative">
                        <div className="absolute inset-0 blur-3xl bg-neon/20 animate-pulse"></div>
                        <Loader2 className="animate-spin text-neon relative z-10" size={40} />
                      </div>
                      <span className="text-xs font-black text-neon uppercase tracking-[0.5em] animate-pulse">Decoding Neural Signals</span>
                    </div>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center space-y-6 opacity-20">
                      <Fingerprint size={80} />
                      <span className="text-[10px] font-black uppercase tracking-[0.5em]">Awaiting Analysis Matrix</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="glass w-full max-w-xl rounded-apple overflow-hidden shadow-2xl border border-white/10">
            <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Configuration</h2>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-1">Global System Parameters</p>
              </div>
              <button onClick={() => setShowSettings(false)} className="h-10 w-10 glass rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Neural Engine Choice</label>
                <select 
                  value={config.activeEngine}
                  onChange={(e) => setConfig({...config, activeEngine: e.target.value as EngineProvider})}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl font-semibold focus:outline-none focus:border-neon transition-all cursor-pointer hover:bg-white/[0.08]"
                >
                  <option value="gemini" className="bg-[#050505]">Gemini Ultra-3</option>
                  <option value="openrouter" className="bg-[#050505]">OpenRouter Matrix</option>
                  <option value="huggingface" className="bg-[#050505]">Hugging Face Core</option>
                </select>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Auth Credentials</label>
                <div className="space-y-4">
                   <div className="flex items-center justify-between glass p-4 rounded-2xl border-white/10">
                    <span className="text-sm font-semibold">Native Gemini Integration</span>
                    <button onClick={async () => window.aistudio?.openSelectKey()} className="text-xs font-bold text-neon hover:underline px-4 py-2 bg-neon/10 rounded-full border border-neon/20">Link Key</button>
                  </div>
                  {['openrouter', 'brave', 'huggingface'].map(key => (
                    <div key={key} className="space-y-2">
                      <div className="flex justify-between px-1">
                        <span className="text-[10px] uppercase font-bold text-slate-600">{key} vector key</span>
                      </div>
                      <input 
                        type="password"
                        placeholder={`Enter key for ${key}...`}
                        value={config.keys[key as keyof typeof config.keys]}
                        onChange={(e) => setConfig({...config, keys: {...config.keys, [key]: e.target.value}})}
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-sm focus:outline-none focus:border-neon transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Donations Section */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Research Contributions</label>
                <div className="space-y-3">
                  <div className="glass p-5 rounded-2xl border border-white/5 space-y-3 group hover:border-white/20 transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><Activity size={12}/> Bitcoin Network</span>
                      <button 
                        onClick={() => copyToClipboard('bc1p4lqw848k7jhhkluh78s5v2ft6lh8jps0j0us9xtclr0x6dq5zw2qv63qe0')} 
                        className="text-neon hover:scale-110 transition-transform p-1.5 bg-neon/10 rounded-lg"
                        title="Copy BTC Address"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 break-all select-all leading-relaxed bg-black/40 p-3 rounded-xl">
                      bc1p4lqw848k7jhhkluh78s5v2ft6lh8jps0j0us9xtclr0x6dq5zw2qv63qe0
                    </p>
                  </div>

                  <div className="glass p-5 rounded-2xl border border-white/5 space-y-3 group hover:border-white/20 transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-400 flex items-center gap-2"><Activity size={12}/> Solana Ecosystem</span>
                      <button 
                        onClick={() => copyToClipboard('7E3X7113qc1XU3rAwu7irtbr9pWYVpdQUUoRFm45tBpj')} 
                        className="text-neon hover:scale-110 transition-transform p-1.5 bg-neon/10 rounded-lg"
                        title="Copy SOL Address"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] font-mono text-slate-500 break-all select-all leading-relaxed bg-black/40 p-3 rounded-xl">
                      7E3X7113qc1XU3rAwu7irtbr9pWYVpdQUUoRFm45tBpj
                    </p>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => {
                  localStorage.setItem('ghost_dork_config', JSON.stringify(config));
                  setShowSettings(false);
                }}
                className="w-full py-5 bg-white text-black font-black rounded-full hover:scale-[1.02] transition-transform shadow-xl shadow-white/5"
              >
                DEPLOY SETTINGS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-20 py-12 text-center opacity-40 border-t border-white/5 mx-6">
        <div className="flex flex-col items-center gap-6">
          <RegularGhost className="w-6 h-6" />
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.5em]">Ghost Dork AI Intelligence</p>
            <p className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">Digital Ghost x Research Protocol</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
