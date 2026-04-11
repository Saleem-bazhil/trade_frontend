import React, { useState, useRef } from 'react';
import {
  UploadCloud, FileSpreadsheet, Download, CheckCircle,
  AlertCircle, X, Plus, Layers, Sparkles, ArrowRight
} from 'lucide-react';

const API_BASE = '/api';

const Spinner = () => (
  <svg className="spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" opacity="0.3" />
    <path d="M12 2v4" />
  </svg>
);

function App() {
  const [files, setFiles] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef(null);

  /* ─── Drag & drop handlers ─── */
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length > 0) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleFileChange = (e) => {
    if (e.target.files?.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const addFiles = (newFiles) => {
    setError(null);
    setResult(null);
    const valid = [];
    for (const f of newFiles) {
      if (!f.name.endsWith('.xlsx')) { setError(`"${f.name}" is not a valid .xlsx file.`); continue; }
      if (!files.some(ex => ex.name === f.name)) valid.push(f);
    }
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx) => { setFiles(prev => prev.filter((_, i) => i !== idx)); setResult(null); };
  const triggerFileInput = () => fileInputRef.current?.click();

  /* ─── Process ─── */
  const processFiles = async () => {
    if (files.length === 0) return;
    setProcessing(true);
    setError(null);

    const formData = new FormData();
    const isSingle = files.length === 1;

    if (isSingle) {
      formData.append('file', files[0]);
    } else {
      for (const f of files) formData.append('files', f);
    }

    const endpoint = isSingle
      ? `${API_BASE}/process-report`
      : `${API_BASE}/process-multiple`;

    try {
      const response = await fetch(endpoint, { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail || 'Failed to process the report');
      }

      const recordsProcessed = response.headers.get('X-Records-Processed');
      const recordsFiltered = response.headers.get('X-Records-Filtered');
      const fileStatsRaw = response.headers.get('X-File-Stats');
      const contentDisposition = response.headers.get('Content-Disposition');

      let fileStats = null;
      try { fileStats = fileStatsRaw ? JSON.parse(fileStatsRaw) : null; } catch {}

      let filename = `Trade_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`;
      if (contentDisposition?.includes('filename='))
        filename = contentDisposition.split('filename=')[1].replace(/"/g, '');

      const blob = await response.blob();
      setResult({
        downloadUrl: window.URL.createObjectURL(blob),
        filename,
        recordsProcessed: recordsProcessed || '0',
        recordsFiltered: recordsFiltered || '0',
        fileStats,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  /* ─── Render ─── */
  return (
    <>
      {/* Animated background */}
      <div className="bg-orbs">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
      </div>

      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 64px' }}>

        {/* ─── Header ─── */}
        <header style={{ textAlign: 'center', marginBottom: 40, maxWidth: 600 }} className="fade-up">
          <div style={{ marginBottom: 16 }}>
            <span className="subtitle-badge">
              <Sparkles size={14} />
              Automated Report Processing
            </span>
          </div>
          <h1 className="title-text" style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 900, lineHeight: 1.1, margin: '0 0 12px' }}>
            Trade Report Generator
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', lineHeight: 1.6, margin: 0 }}>
            Upload your Flex WIP Reports — we'll filter, combine, and generate a ready-to-use Trade Report with Pivot Table.
          </p>
        </header>

        {/* ─── Main Card ─── */}
        <div className="glass-card fade-up" style={{ width: '100%', maxWidth: 680, animationDelay: '0.1s' }}>
          <div style={{ padding: 'clamp(24px, 4vw, 44px)' }}>

            {/* Upload Zone */}
            <div
              className={`drop-zone ${files.length > 0 ? 'has-files' : ''} ${dragActive ? 'has-files' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileInput}
              style={{ padding: 'clamp(32px, 5vw, 52px) 24px', textAlign: 'center' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileChange}
                accept=".xlsx"
                multiple
                style={{ display: 'none' }}
              />

              {files.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="icon-pulse" style={{ display: 'inline-flex', marginBottom: 14 }}>
                    <Layers size={48} style={{ color: 'var(--pink-l)' }} />
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                    {files.length} file{files.length > 1 ? 's' : ''} selected
                  </span>
                  <span style={{ fontSize: '0.82rem', marginTop: 8, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Plus size={13} /> Click or drop to add more
                  </span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div className="icon-pulse" style={{ display: 'inline-flex', marginBottom: 16 }}>
                    <UploadCloud size={52} style={{ color: 'var(--pink-l)' }} />
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                    Drag & drop your Flex WIP Reports
                  </span>
                  <span style={{ fontSize: '0.85rem', marginTop: 8, color: 'var(--text-muted)' }}>
                    or click to browse &nbsp;·&nbsp; .xlsx files only &nbsp;·&nbsp; multiple files supported
                  </span>
                </div>
              )}
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {files.map((f, i) => (
                  <div key={i} className="file-chip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                      <FileSpreadsheet size={20} style={{ color: 'var(--pink)', flexShrink: 0 }} />
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>
                          {f.name}
                        </p>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(f.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button className="file-chip-remove" onClick={(e) => { e.stopPropagation(); removeFile(i); }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="error-banner fade-up" style={{ marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Action Button */}
            <div style={{ marginTop: 28, display: 'flex', justifyContent: 'center' }}>
              <button
                className="btn-primary"
                onClick={processFiles}
                disabled={files.length === 0 || processing}
                style={{ width: '100%', maxWidth: 400 }}
              >
                {processing ? (
                  <>
                    <Spinner />
                    <span style={{ marginLeft: 12 }}>Processing {files.length} Report{files.length > 1 ? 's' : ''}…</span>
                  </>
                ) : (
                  <>
                    {files.length > 1
                      ? `Generate & Combine (${files.length} files)`
                      : 'Generate Trade Report'}
                    <ArrowRight size={18} style={{ marginLeft: 10 }} />
                  </>
                )}
              </button>
            </div>

            {/* ─── Results ─── */}
            {result && !processing && (
              <div className="fade-up" style={{ animationDelay: '0.1s' }}>
                <hr className="divider" />

                {/* Success header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
                  <div className="success-badge">
                    <CheckCircle size={24} color="#fff" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                    {result.fileStats ? 'Reports Combined!' : 'Processing Complete!'}
                  </h3>
                </div>

                {/* Per-file breakdown */}
                {result.fileStats && (
                  <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {result.fileStats.map((stat, i) => (
                      <div key={i} className="file-chip" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <FileSpreadsheet size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {stat.filename}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: '0.78rem', flexShrink: 0 }}>
                          <span style={{ color: 'var(--text-muted)' }}>{stat.total} total</span>
                          <span style={{ color: 'var(--pink-l)', fontWeight: 700 }}>{stat.filtered} trade</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 24 }}>
                  <div className="stat-card">
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      Records Scanned
                    </span>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 6, color: 'var(--text-primary)' }}>
                      {Number(result.recordsProcessed).toLocaleString()}
                    </div>
                  </div>
                  <div className="stat-card accent">
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--pink-l)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                      Trade Records
                    </span>
                    <div style={{ fontSize: '2.2rem', fontWeight: 900, marginTop: 6, color: 'var(--pink-l)' }}>
                      {Number(result.recordsFiltered).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Download */}
                <a href={result.downloadUrl} download={result.filename} className="btn-download">
                  <Download size={20} style={{ marginRight: 12 }} />
                  Download {result.filename}
                </a>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <p style={{ marginTop: 36, fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Trade Report Generator &nbsp;·&nbsp; Flex WIP → Trade Report + Pivot Table
        </p>
      </div>
    </>
  );
}

export default App;
