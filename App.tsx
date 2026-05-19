
import React, { useState, useRef } from 'react';
import { geminiService } from './services/geminiService';
import { extractTextFromFile } from './utils/fileProcessor';
import { calculateExperienceYears, calculateDeterministicMatchScore } from './utils/logic';
import { Profile, JobOffer, MatchResult, TailoredCV, Experience, TraceableSkill } from './types';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip } from 'recharts';

// --- Constants ---
const DEFAULT_THRESHOLD = 0.70;

const JOB_MATCH_STEPS = [
  { id: 'job_analysis', label: 'Deconstructing Job Description & ATS Keywords...' },
  { id: 'matching', label: 'Executing Semantic Matching Algorithm...' },
  { id: 'breakdown', label: 'Calculating Score Attribution & Identifying Gaps...' },
  { id: 'tailoring', label: 'Synthesizing Tailored ATS-Optimized CV...' },
];

const INGESTION_STEPS = [
  { id: 'normalize', label: 'Normalizing Source Documents & Bios...' },
  { id: 'roles', label: 'Extracting Roles & Chronological Tenure...' },
  { id: 'skills', label: 'Categorizing Technical Expertise & Tools...' },
  { id: 'history', label: 'Structuring Professional Contributions...' },
  { id: 'finalize', label: 'Finalizing Intelligence Profile...' },
];

const INTEL_STEPS = [
  { id: 'scan', label: 'Scanning Natural Language Patterns...' },
  { id: 'deconstruct', label: 'Deconstructing Document Context...' },
  { id: 'crossref', label: 'Cross-Referencing Against Knowledge Base...' },
  { id: 'propose', label: 'Synthesizing Categorization Proposal...' },
];

// --- Helper Components ---
const SectionHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 className="text-xl font-bold text-slate-800 mb-4 border-b pb-2">{children}</h2>
);

const App: React.FC = () => {
  // Navigation & Flow
  const [activeStep, setActiveStep] = useState<number>(1);
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'ingestion' | 'match' | 'intel'>('ingestion');
  const [loadingStepIdx, setLoadingStepIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Ingestion State
  const [profileText, setProfileText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile Management
  const [profile, setProfile] = useState<Profile | null>(null);

  // Knowledge Hub Intelligence Feed
  const [intelInput, setIntelInput] = useState('');
  const [intelFiles, setIntelFiles] = useState<{ name: string; content: string }[]>([]);

  // Review Modal State
  const [proposedIntel, setProposedIntel] = useState<Record<string, string[]> | null>(null);
  const [selectedIntel, setSelectedIntel] = useState<Record<string, string[]>>({});
  const intelFileInputRef = useRef<HTMLInputElement>(null);

  // Job & Results State
  const [jobText, setJobText] = useState('');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [job, setJob] = useState<JobOffer | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [tailoredCV, setTailoredCV] = useState<TailoredCV | null>(null);

  // Handlers
  const handleFiles = async (files: FileList | null, target: 'initial' | 'intel') => {
    if (!files) return;
    setLoading(true);
    const newFiles: { name: string; content: string }[] = [];
    for (let i = 0; i < files.length; i++) {
      try {
        const text = await extractTextFromFile(files[i]);
        newFiles.push({ name: files[i].name, content: text });
      } catch (err: any) {
        setError(`File Error: ${err.message}`);
      }
    }
    if (target === 'initial') setUploadedFiles(prev => [...prev, ...newFiles]);
    else setIntelFiles(prev => [...prev, ...newFiles]);
    setLoading(false);
  };

  const handleProfileIngestion = async () => {
    const combined = [...uploadedFiles.map(f => f.content), profileText].join('\n\n');
    if (!combined.trim()) return setError("Please provide info.");

    setLoadingType('ingestion');
    setLoading(true);
    setLoadingStepIdx(0);

    try {
      setLoadingStepIdx(0);
      await new Promise(r => setTimeout(r, 600));
      setLoadingStepIdx(1);
      const extracted = await geminiService.extractProfile(combined);

      // Deterministic Experience Calculation
      extracted.years_of_experience = calculateExperienceYears(extracted.experience);

      setLoadingStepIdx(2);
      await new Promise(r => setTimeout(r, 800));
      setLoadingStepIdx(3);
      await new Promise(r => setTimeout(r, 600));
      setLoadingStepIdx(4);
      await new Promise(r => setTimeout(r, 400));

      setProfile(extracted);
      setActiveStep(1.5);
    } catch (err: any) {
      setError(`Extraction failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const processNewIntel = async () => {
    const combinedText = [
      ...intelFiles.map(f => `--- Document: ${f.name} ---\n${f.content}`),
      intelInput ? `--- User Message ---\n${intelInput}` : ''
    ].filter(Boolean).join('\n\n');

    if (!combinedText.trim()) return;

    setLoadingType('intel');
    setLoading(true);
    setLoadingStepIdx(0);

    try {
      setLoadingStepIdx(0);
      await new Promise(r => setTimeout(r, 400));
      setLoadingStepIdx(1);
      await new Promise(r => setTimeout(r, 400));
      setLoadingStepIdx(2);
      const proposed = await geminiService.processNewIntelligence(combinedText);
      setLoadingStepIdx(3);
      await new Promise(r => setTimeout(r, 600));

      if (Object.keys(proposed).length === 0) {
        setError("The engine found no structured skills in the provided input.");
      } else {
        setProposedIntel(proposed);
        setSelectedIntel(proposed);
        setIntelInput('');
        setIntelFiles([]);
      }
    } catch (err: any) {
      setError(`Intelligence synthesis failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleIntelItem = (category: string, item: string) => {
    const current = { ...selectedIntel };
    if (current[category].includes(item)) {
      current[category] = current[category].filter(i => i !== item);
    } else {
      current[category] = [...(current[category] || []), item];
    }
    setSelectedIntel(current);
  };

  const approveIntel = () => {
    if (!profile || !selectedIntel) return;
    const newSkills: TraceableSkill[] = [...profile.skills];

    Object.keys(selectedIntel).forEach(cat => {
      selectedIntel[cat].forEach(skillName => {
        // Check if exists
        const exists = newSkills.some(s => s.category === cat && s.name === skillName);
        if (!exists) {
          newSkills.push({
            name: skillName,
            category: cat,
            source: 'user_note', // Default for manually added/approved intel
            evidence: 'Added via Knowledge Hub'
          });
        }
      });
    });

    setProfile({ ...profile, skills: newSkills });
    setProposedIntel(null);
  };

  const removeSkill = (category: string, skillName: string) => {
    if (!profile) return;
    const newSkills = profile.skills.filter(s => !(s.category === category && s.name === skillName));
    setProfile({ ...profile, skills: newSkills });
  };

  const handleJobAnalysis = async () => {
    if (!jobText.trim() || !profile) return;
    setLoadingType('match');
    setLoading(true);
    setLoadingStepIdx(0);
    try {
      setLoadingStepIdx(0);
      const analyzedJob = await geminiService.analyzeJob(jobText);
      setJob(analyzedJob);
      setLoadingStepIdx(1);
      const match = await geminiService.matchProfileToJob(profile, analyzedJob);

      // Deterministic Match Calculation
      match.match_score = calculateDeterministicMatchScore(match.score_breakdown);

      setMatchResult(match);
      setLoadingStepIdx(2);
      await new Promise(r => setTimeout(r, 800));
      if (match.match_score >= threshold) {
        setLoadingStepIdx(3);
        const cv = await geminiService.generateTailoredCV(profile, analyzedJob);
        setTailoredCV(cv);
      }
      setActiveStep(3);
    } catch (err: any) {
      setError(`Analysis engine failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const radarData = (matchResult && matchResult.score_breakdown) ? [
    { subject: 'Skills', A: (matchResult.score_breakdown.skills || 0) * 100 },
    { subject: 'Experience', A: (matchResult.score_breakdown.experience || 0) * 100 },
    { subject: 'Domain', A: (matchResult.score_breakdown.domain || 0) * 100 },
    { subject: 'Education', A: (matchResult.score_breakdown.education_certifications || 0) * 100 },
    { subject: 'Other', A: (matchResult.score_breakdown.other || 0) * 100 },
  ] : [];

  const currentSteps = loadingType === 'ingestion' ? INGESTION_STEPS : loadingType === 'match' ? JOB_MATCH_STEPS : INTEL_STEPS;

  return (
    <div className="min-h-screen flex flex-col relative bg-slate-50 overflow-x-hidden">

      {/* AI REVIEW MODAL */}
      {proposedIntel && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="max-w-3xl w-full bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-10 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-3xl font-black text-slate-800 tracking-tight">AI Intelligence Proposal</h3>
                <p className="text-slate-500 font-medium mt-1">Review the identified skills before adding them to your Hub.</p>
              </div>
              <button onClick={() => setProposedIntel(null)} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400">&times;</button>
            </div>

            <div className="p-10 max-h-[60vh] overflow-y-auto space-y-8 custom-scrollbar">
              {Object.keys(proposedIntel).map(cat => (
                <div key={cat} className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b pb-2">{cat}</h4>
                  <div className="flex flex-wrap gap-3">
                    {proposedIntel[cat].map(item => {
                      const isSelected = selectedIntel[cat]?.includes(item);
                      return (
                        <button
                          key={item}
                          onClick={() => toggleIntelItem(cat, item)}
                          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border-2 ${isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                        >
                          {isSelected ? '✓ ' : '+ '} {item}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
              <button onClick={() => setProposedIntel(null)} className="px-8 py-3 bg-white border border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={approveIntel} className="px-10 py-3 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-100">Approve Knowledge</button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 z-[150] bg-slate-900/95 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="max-w-xl w-full bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/10">
            <div className="p-10 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg animate-pulse">
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">CareerIntel AI Engine</h3>
                  <p className="text-blue-600 font-black uppercase tracking-widest text-[9px] mt-1 italic">
                    {loadingType === 'ingestion' ? 'Building Professional Vector Space...' : loadingType === 'match' ? 'Performing Semantic Match Analysis...' : 'Processing Intelligence Feed...'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-10 space-y-8">
              <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden shadow-inner">
                <div
                  className="bg-blue-600 h-full transition-all duration-700 ease-out shadow-[0_0_20px_rgba(37,99,235,0.4)]"
                  style={{ width: `${((loadingStepIdx + 1) / currentSteps.length) * 100}%` }}
                />
              </div>

              <div className="space-y-5">
                {currentSteps.map((step, idx) => {
                  const isActive = idx === loadingStepIdx;
                  const isCompleted = idx < loadingStepIdx;
                  return (
                    <div key={step.id} className={`flex items-center gap-5 transition-all duration-500 ${isActive ? 'translate-x-3' : 'opacity-40'}`}>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isCompleted ? 'bg-green-500 shadow-green-100 shadow-lg' : isActive ? 'bg-blue-600 shadow-blue-200 shadow-xl' : 'bg-slate-200'}`}>
                        {isCompleted ? (
                          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        ) : (
                          <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-white animate-ping' : 'bg-slate-400'}`} />
                        )}
                      </div>
                      <span className={`text-sm font-black tracking-tight ${isActive ? 'text-slate-900' : 'text-slate-500'}`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-8 bg-slate-900 text-center">
              <p className="text-[9px] font-black uppercase tracking-[0.4em] text-slate-500 animate-pulse">Executing Distributed Reasoning Network</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-6 sticky top-0 z-[100] backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4 cursor-pointer" onClick={() => setActiveStep(1)}>
            <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /></svg>
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tighter">CareerIntel</h1>
              <p className="text-[10px] font-black uppercase tracking-widest text-blue-600">Enterprise AI Engine</p>
            </div>
          </div>

          <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {[
              { s: 1, l: 'Ingestion' },
              { s: 1.5, l: 'Knowledge Hub' },
              { s: 2, l: 'Match Engine' }
            ].map(step => (
              <button
                key={step.s}
                onClick={() => profile && setActiveStep(step.s)}
                disabled={!profile && step.s !== 1}
                className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeStep === step.s ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {step.l}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-grow max-w-7xl mx-auto w-full p-6 md:p-10 space-y-12">
        {error && (
          <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center justify-between animate-in slide-in-from-top duration-300 shadow-sm">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-sm font-bold">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="ml-4 hover:scale-110 transition-transform font-bold">&times;</button>
          </div>
        )}

        {/* STEP 1: INITIAL INGESTION */}
        {activeStep === 1 && (
          <div className="max-w-3xl mx-auto space-y-12 animate-in fade-in duration-500">
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-black text-slate-900 tracking-tighter">Initialize Engine.</h2>
              <p className="text-xl text-slate-500 font-medium">Start by feeding your primary CV or professional bio.</p>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100">
              <div
                className={`file-drop-zone rounded-[2rem] p-20 text-center cursor-pointer mb-8 border-4 border-dashed transition-all ${isDragging ? 'border-blue-500 bg-blue-50 scale-95' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { e.preventDefault(); setIsDragging(false); handleFiles(e.dataTransfer.files, 'initial'); }}
                onClick={() => fileInputRef.current?.click()}
              >
                <input type="file" ref={fileInputRef} multiple accept=".pdf,.docx,.txt" className="hidden" onChange={(e) => handleFiles(e.target.files, 'initial')} />
                <div className="w-24 h-24 bg-slate-900 text-white rounded-3xl mx-auto flex items-center justify-center shadow-2xl mb-6">
                  <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                </div>
                <p className="text-2xl font-black text-slate-800 tracking-tight">Drop your CV here</p>
                <p className="text-slate-400 font-medium mt-2">PDF, DOCX, or Plain Text assets</p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="mb-8 flex flex-wrap gap-2">
                  {uploadedFiles.map((f, i) => (
                    <span key={i} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase flex items-center gap-2">
                      {f.name} <button onClick={() => setUploadedFiles(prev => prev.filter((_, idx) => idx !== i))}>&times;</button>
                    </span>
                  ))}
                </div>
              )}

              <textarea
                value={profileText}
                onChange={(e) => setProfileText(e.target.value)}
                placeholder="Paste extra details or your current professional bio..."
                className="w-full h-48 p-8 bg-slate-50 border border-slate-100 rounded-[2rem] focus:ring-4 focus:ring-blue-100 outline-none transition-all text-slate-700 mb-8 font-medium leading-relaxed"
              />

              <button
                onClick={handleProfileIngestion}
                disabled={loading || (uploadedFiles.length === 0 && !profileText.trim())}
                className="w-full py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 transition-all flex items-center justify-center gap-4 active:scale-95"
              >
                Launch Intelligence Suite
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* STEP 1.5: KNOWLEDGE HUB */}
        {activeStep === 1.5 && profile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 animate-in fade-in duration-500">
            {/* Sidebar Summary */}
            <div className="lg:col-span-1 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200 border border-slate-100">
                <div className="flex items-center gap-6 mb-10">
                  <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-blue-100">{profile.name.charAt(0)}</div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{profile.name}</h2>
                    <p className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mt-2">Active Intelligence Profile</p>
                  </div>
                </div>
                <div className="space-y-8">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tenure</label>
                    <p className="text-3xl font-black text-slate-900">{profile.years_of_experience} Years</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Core Expertise</label>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {profile.domains?.map((d, i) => (
                        <span key={i} className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{d}</span>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveStep(2)}
                    className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-black transition-all shadow-xl shadow-slate-200"
                  >
                    Proceed to Match Engine
                  </button>
                </div>
              </div>

              {/* FEED THE ENGINE - Natural Language / Extra Files */}
              <div className="bg-blue-600 p-10 rounded-[3rem] shadow-2xl shadow-blue-200 text-white space-y-6">
                <h3 className="text-2xl font-black tracking-tight leading-tight">Feed the Engine</h3>
                <p className="text-blue-100 text-sm font-medium">Add certifications, courses, or natural language updates. The AI will categorize them for you.</p>

                <div className="space-y-4">
                  <textarea
                    value={intelInput}
                    onChange={(e) => setIntelInput(e.target.value)}
                    placeholder="e.g. I just completed a Cisco CyberOps certification..."
                    className="w-full h-44 p-6 bg-blue-500/50 border border-blue-400/80 rounded-2xl placeholder:text-blue-100/60 outline-none focus:bg-blue-400/80 transition-all text-sm font-medium leading-relaxed resize-none overflow-y-auto custom-scrollbar shadow-inner"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => intelFileInputRef.current?.click()}
                      className="flex-grow p-4 bg-blue-700 hover:bg-blue-800 rounded-xl flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                      Upload Assets
                    </button>
                    <input type="file" ref={intelFileInputRef} multiple className="hidden" onChange={(e) => handleFiles(e.target.files, 'intel')} />

                    <button
                      onClick={processNewIntel}
                      disabled={loading || (!intelInput.trim() && intelFiles.length === 0)}
                      className="px-6 py-4 bg-white text-blue-600 rounded-xl hover:bg-blue-50 transition-all font-black uppercase tracking-widest text-xs shadow-lg shadow-blue-900/10 disabled:opacity-50"
                    >
                      {loading && loadingType === 'intel' ? '...' : 'Process'}
                    </button>
                  </div>

                  {intelFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {intelFiles.map((f, i) => (
                        <span key={i} className="px-2 py-1 bg-blue-700/50 rounded-md text-[9px] font-bold border border-blue-500/30 truncate max-w-[100px]">{f.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Main Categorized Knowledge */}
            <div className="lg:col-span-2 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {profile && Object.entries(profile.skills.reduce((acc, skill) => {
                  const cat = skill.category || 'Other';
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(skill);
                  return acc;
                }, {} as Record<string, TraceableSkill[]>)).map(([cat, skills]) => (
                  <div key={cat} className="bg-white p-10 rounded-[2.5rem] shadow-xl shadow-slate-200 border border-slate-100 flex flex-col group transition-all hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cat}</h4>
                      <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-[10px] font-black text-slate-400">{skills.length}</div>
                    </div>

                    <div className="flex flex-wrap gap-3 mb-6 min-h-[60px] content-start">
                      {skills.map((skill, i) => (
                        <span key={i} title={`Source: ${skill.source}`} className="pl-4 pr-3 py-2 bg-slate-50 text-slate-900 rounded-xl text-xs font-bold flex items-center gap-3 group/skill hover:bg-blue-600 hover:text-white transition-all shadow-sm cursor-help">
                          {skill.name}
                          <button
                            onClick={() => removeSkill(cat, skill.name)}
                            className="text-slate-300 hover:text-white transition-colors opacity-0 group-hover/skill:opacity-100"
                          >&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: JOB MATCHING */}
        {activeStep === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 animate-in slide-in-from-right duration-500">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-10 rounded-[3rem] shadow-2xl shadow-slate-200 border border-slate-100">
                <div className="mb-10">
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Match Engine</h2>
                  <p className="text-slate-500 font-medium mt-2">Deploy your profile assets against a specific market opportunity.</p>
                </div>

                <textarea
                  value={jobText}
                  onChange={(e) => setJobText(e.target.value)}
                  placeholder="Paste the target Job Description here..."
                  className="w-full h-96 p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] focus:ring-4 focus:ring-blue-100 outline-none transition-all text-slate-700 resize-none font-medium leading-relaxed"
                />

                <div className="mt-12 flex flex-col md:flex-row items-center gap-12">
                  <div className="flex-1 w-full space-y-4">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decision Threshold</label>
                      <span className="text-lg font-black text-blue-600">{Math.round(threshold * 100)}%</span>
                    </div>
                    <input type="range" min="0" max="1" step="0.05" value={threshold} onChange={(e) => setThreshold(parseFloat(e.target.value))} className="w-full h-3 bg-slate-200 rounded-full appearance-none cursor-pointer accent-blue-600" />
                  </div>
                  <button
                    onClick={handleJobAnalysis}
                    disabled={loading || !jobText.trim()}
                    className="px-12 py-6 bg-slate-900 hover:bg-black text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-slate-300 transition-all flex items-center justify-center gap-4 active:scale-95 whitespace-nowrap"
                  >
                    Launch Analysis
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-slate-900 p-10 rounded-[3rem] text-white shadow-2xl sticky top-24 space-y-10">
                <h3 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  <span className="w-2 h-8 bg-blue-500 rounded-full"></span>
                  Active Intelligence
                </h3>
                <div className="space-y-6">
                  <div>
                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Candidate</label>
                    <p className="text-2xl font-black text-white mt-1">{profile?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Knowledge Points</label>
                    <p className="text-xl font-bold text-blue-400 mt-1">
                      {profile ? profile.skills.length : 0} Vectors Analyzed
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: RESULTS */}
        {activeStep === 3 && matchResult && (
          <div className="space-y-12 animate-in fade-in zoom-in duration-500">
            {/* Match Score UI */}
            <div className="bg-white rounded-[3.5rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3">
                <div className="p-16 flex flex-col items-center justify-center bg-slate-50 border-r border-slate-100 text-center">
                  <div className="relative mb-6">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle className="text-slate-200" strokeWidth="12" stroke="currentColor" fill="transparent" r="84" cx="96" cy="96" />
                      <circle
                        className={matchResult.match_score >= threshold ? 'text-blue-600' : 'text-amber-500'}
                        strokeWidth="12"
                        strokeDasharray={527.7}
                        strokeDashoffset={527.7 - (527.7 * matchResult.match_score)}
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="transparent"
                        r="84" cx="96" cy="96"
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-6xl font-black text-slate-900">{Math.round(matchResult.match_score * 100)}%</span>
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Semantic Fit</h3>
                </div>

                <div className="md:col-span-2 p-16 flex flex-col justify-between">
                  <div className="space-y-6">
                    <div className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-2xl text-xs font-black uppercase tracking-widest">Evaluated Role</div>
                    <h2 className="text-5xl font-black text-slate-900 tracking-tighter">{job?.title}</h2>
                    <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-2xl">Targeting {job?.seniority} level with a specific focus on {job?.domains?.join(', ')}.</p>
                  </div>

                  <div className="mt-12 flex gap-4">
                    <button onClick={() => setActiveStep(2)} className="px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-2xl transition-all">New Opportunity</button>
                    <button className="px-10 py-4 bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-all shadow-xl shadow-slate-200">Export Analysis Report</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="bg-white p-12 rounded-[3.5rem] shadow-xl shadow-slate-200 border border-slate-100">
                <SectionHeading>Match Attribution</SectionHeading>
                <div className="h-96 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 900 }} />
                      <Radar name="A" dataKey="A" stroke="#2563eb" fill="#3b82f6" fillOpacity={0.6} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-12 rounded-[3.5rem] shadow-xl shadow-slate-200 border border-slate-100 space-y-10">
                <SectionHeading>AI Insights</SectionHeading>
                <div className="space-y-8">
                  <div>
                    <h4 className="text-xs font-black text-blue-600 uppercase tracking-[0.2em] mb-4">Leverageable Strengths</h4>
                    <div className="space-y-3">
                      {matchResult.strengths?.map((s, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                          <span className="text-blue-500 font-black">✓</span>
                          <p className="text-sm font-bold text-slate-700">{s}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mb-4">Core Gaps</h4>
                    <div className="space-y-3">
                      {matchResult.gaps?.map((g, i) => (
                        <div key={i} className="flex items-start gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-100">
                          <span className="text-amber-500 font-black">!</span>
                          <p className="text-sm font-bold text-slate-700">{g}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tailored CV View */}
            {tailoredCV && (
              <div className="bg-white rounded-[4rem] shadow-2xl shadow-slate-200 overflow-hidden border border-slate-200">
                <div className="p-16 bg-slate-900 text-white flex flex-col md:flex-row items-center justify-between gap-10">
                  <div className="space-y-2">
                    <h2 className="text-4xl font-black tracking-tight">ATS Optimized View</h2>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Precision-Derived Experience</p>
                  </div>
                  <button onClick={() => window.print()} className="px-10 py-5 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black transition-all shadow-2xl shadow-blue-900">Print High-Res PDF</button>
                </div>

                <div id="cv-print-content" className="p-20 max-w-5xl mx-auto font-serif text-slate-900 space-y-16 bg-white">
                  <div className="text-center space-y-4 border-b-4 border-slate-900 pb-12">
                    <h1 className="text-7xl font-black uppercase tracking-tighter">{profile?.name}</h1>
                    <p className="text-2xl text-slate-500 font-bold tracking-widest uppercase italic">{job?.title}</p>
                  </div>

                  <section className="space-y-6">
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-900 pb-2 tracking-[0.3em]">Professional Summary</h3>
                    <p className="text-lg leading-relaxed text-justify text-slate-700 italic">{tailoredCV.professional_summary}</p>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-900 pb-2 tracking-[0.3em]">Expertise Map</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-y-6">
                      {tailoredCV.skills_section?.map((s, i) => (
                        <div key={i} className="text-base font-black flex items-center gap-4">
                          <div className="w-2 h-2 bg-blue-600 rotate-45"></div> {s}
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-12">
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-900 pb-2 tracking-[0.3em]">Career Progression</h3>
                    <div className="space-y-16">
                      {tailoredCV.experience_section?.map((exp, i) => (
                        <div key={i} className="space-y-4">
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-2xl font-black uppercase tracking-tight">{exp.company}</h4>
                            <span className="text-sm font-black text-slate-400">{exp.start_date} — {exp.end_date}</span>
                          </div>
                          <p className="text-lg font-black text-blue-600 italic">{exp.role}</p>
                          <ul className="space-y-4 pt-4">
                            {exp.key_contributions?.map((bullet, bi) => (
                              <li key={bi} className="text-base leading-relaxed flex items-start gap-6 text-slate-700 font-medium">
                                <span className="mt-2 text-slate-900 font-black text-[10px]">■</span> {bullet}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-8">
                    <h3 className="text-xs font-black uppercase border-b-2 border-slate-900 pb-2 tracking-[0.3em]">Education & Certifications</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase text-blue-600 tracking-widest">Formal Education</h4>
                        <ul className="space-y-3">
                          {tailoredCV.education_section?.map((edu, i) => (
                            <li key={i} className="text-base font-bold text-slate-800 flex items-start gap-4">
                              <span className="mt-2 w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0"></span>
                              {edu}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-black uppercase text-blue-600 tracking-widest">Licenses & Certifications</h4>
                        <ul className="space-y-3">
                          {tailoredCV.certifications_section?.map((cert, i) => (
                            <li key={i} className="text-base font-bold text-slate-800 flex items-start gap-4">
                              <span className="mt-2 w-1.5 h-1.5 bg-slate-300 rounded-full flex-shrink-0"></span>
                              {cert}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="p-16 text-center text-[10px] font-black uppercase tracking-[0.5em] text-slate-300">
        Engine Protocol: CV-ATS-INTEL-99 // 2024
      </footer>
    </div>
  );
};

export default App;
