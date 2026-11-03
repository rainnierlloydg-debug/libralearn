import { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileImage, Search, BookOpen, Sparkles, CheckCircle, X, ChevronRight, Eye, Edit, Save, Trash2, Plus, ExternalLink, RotateCcw, History, AlertCircle } from 'lucide-react';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

import Card from '../../components/ui/Card';

import { formatDate } from '../../utils/helpers';
import { useToast } from '../../contexts/useToast';
import './ai-catalog.css';

const STEPS = [
  { key: 'upload', label: 'Upload', icon: Upload },
  { key: 'extract', label: 'Extract', icon: Search },
  { key: 'verify', label: 'Verify Online', icon: BookOpen },
  { key: 'classify', label: 'Classify', icon: Sparkles },
  { key: 'review', label: 'Review', icon: Eye },
  { key: 'confirm', label: 'Confirm', icon: CheckCircle },
];

const STATUS_COLORS = {
  processing: 'info',
  needs_review: 'warning',
  draft: 'purple',
  confirmed: 'success',
  failed: 'danger',
};

const SOURCE_BADGES = {
  gemini: { variant: 'purple', label: 'Gemini', icon: Sparkles },
  ocr: { variant: 'purple', label: 'OCR', icon: Sparkles },
  open_library: { variant: 'primary', label: 'Open Library', icon: BookOpen },
  google_books: { variant: 'teal', label: 'Google Books', icon: ExternalLink },
  manual: { variant: 'secondary', label: 'Manual', icon: Edit },
};

function AiCatalogPage() {

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [extractedData, setExtractedData] = useState({});
  const [openLibraryData, setOpenLibraryData] = useState(null);
  const [googleBooksData, setGoogleBooksData] = useState(null);
  const [finalMetadata, setFinalMetadata] = useState({});
  const [reviewData, setReviewData] = useState({});
  const [manualEditFields, setManualEditFields] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDrafts, setShowDrafts] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [jobsError, setJobsError] = useState('');
  const fileInputRef = useRef(null);
  const reviewFieldRefs = useRef({});
  const wizardRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    return () => { if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await api.get('/ai-catalog');
      if (response.data.success) {
        setJobs(response.data.data.data);
        setJobsError('');
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
      setJobsError('Recent jobs could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Defer network setup and cancel it if this view changes before it starts.
    const timer = setTimeout(() => {
      fetchJobs();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchJobs]);

  const selectFile = (file) => {
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        setErrors({ general: 'Choose a JPG, PNG, or WebP image.' });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ general: 'Choose an image up to 5 MB.' });
        return;
      }
      setUploadedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setErrors({});
      setCurrentStep(0);
    }
  };

  const startProcessing = async () => {
    if (!uploadedFile) return;

    const formData = new FormData();
    formData.append('image', uploadedFile);

    setProcessing(true);
    setErrors({});
    try {
      const response = await api.post('/ai-catalog', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (response.data.success) {
        setCurrentStep(1);
        setActiveJob(response.data.data);
        pollJobStatus(response.data.data.id);
      }
    } catch (err) {
      setErrors({ general: err.response?.data?.message || 'Failed to start processing. Please try again.' });
    } finally {
      setProcessing(false);
    }
  };

  const pollJobStatus = async (jobId) => {
    const poll = async () => {
      try {
        const response = await api.get(`/ai-catalog/${jobId}`);
        if (response.data.success) {
          const job = response.data.data;
          setActiveJob(job);
          updateWizardFromJob(job);
          if (job.status === 'needs_review' || job.status === 'draft') {
            setCurrentStep(4); // Review step
            fetchJobs();
          } else if (job.status === 'processing') {
            setTimeout(poll, 2000);
          } else if (job.status === 'failed') {
            setErrors({ general: job.error_message || 'Catalog processing failed. Retry the job from Recent Jobs.' });
          }
        }
      } catch (err) {
        console.error('Polling failed:', err);
        setTimeout(poll, 5000);
      }
    };
    poll();
  };

  const updateWizardFromJob = (job) => {
    setExtractedData(job.extracted_metadata || {});
    setOpenLibraryData(job.open_library_result || null);
    setGoogleBooksData(job.google_books_result || null);
    setFinalMetadata(job.final_metadata || {});
    setReviewData({ ...(job.final_metadata || job.extracted_metadata || {}) });
  };

  const handleReviewFieldChange = (field, value) => {
    setReviewData((prev) => ({ ...prev, [field]: value }));
  };

  const handleManualEntry = (field) => {
    const value = reviewData[field.key] ?? finalMetadata[field.key] ?? extractedData[field.key] ?? '';
    setManualEditFields((prev) => ({ ...prev, [field.key]: true }));
    setReviewData((prev) => ({
      ...prev,
      [field.key]: value === 'Not detected' ? '' : value,
    }));
    reviewFieldRefs.current[field.key]?.focus();
  };

  const handleSaveDraft = async () => {
    if (!activeJob) return;
    setSaving(true);
    try {
      await api.post(`/ai-catalog/${activeJob.id}/draft`, { final_metadata: reviewData });
      setActiveJob((prev) => prev ? { ...prev, status: 'draft', final_metadata: reviewData } : null);
      toast.success('Draft saved successfully.');
      fetchJobs();
    } catch {
      toast.error('Failed to save draft. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async () => {
    if (!activeJob) return;
    if (!reviewData.title || !reviewData.author) {
      setErrors({ general: 'Title and author are required' });
      return;
    }
    setConfirming(true);
    try {
      const response = await api.post(`/ai-catalog/${activeJob.id}/confirm`, reviewData);
      if (response.data.success) {
        toast.success('Book added to catalog successfully.');
        fetchJobs();
        setCurrentStep(5);
      }
    } catch (err) {
      setErrors({ general: err.response?.data?.message || 'Failed to confirm' });
    } finally {
      setConfirming(false);
    }
  };

  const resetWizard = () => {
    setActiveJob(null);
    setCurrentStep(0);
    setUploadedFile(null);
    setPreviewUrl(null);
    setExtractedData({});
    setOpenLibraryData(null);
    setGoogleBooksData(null);
    setFinalMetadata({});
    setReviewData({});
    setManualEditFields({});
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const retryJob = async (jobId) => {
    try {
      await api.post(`/ai-catalog/${jobId}/retry`);
      fetchJobs();
    } catch {
      toast.error('Failed to retry job. Please try again.');
    }
  };

  const deleteJob = async (jobId) => {
    if (!confirm('Delete this job?')) return;
    try {
      await api.delete(`/ai-catalog/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete job');
    }
  };

  const getFieldSource = (field) => {
    if (!finalMetadata) return 'manual';
    const ol = openLibraryData?.docs?.[0];
    const gb = googleBooksData?.items?.[0]?.volumeInfo;

    if (ol && ol[field] && finalMetadata[field] === ol[field]) return 'open_library';
    if (gb && gb[field] && finalMetadata[field] === gb[field]) return 'google_books';
    if (extractedData[field] && finalMetadata[field] === extractedData[field]) return 'ocr';
    return 'manual';
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return StepUpload();
      case 1: return <StepExtract />;
      case 2: return <StepVerify />;
      case 3: return <StepClassify />;
      case 4: return StepReview();
      case 5: return <StepConfirm />;
      default: return StepUpload();
    }
  };

  function StepUpload() {
    return (
      <div className="ai-upload-layout">
        <div className="ai-upload-guide">
          <span className="ai-eyebrow"><Sparkles size={14} /> AI-ASSISTED CATALOGING</span>
          <h2>From book cover<br />to catalog entry.</h2>
          <p>Upload a cover and let AI suggest the book details. You can review and edit everything before adding it to your library.</p>
          <ul className="ai-upload-tips">
            <li><CheckCircle size={17} /> Use a clear, well-lit photo.</li>
            <li><CheckCircle size={17} /> Keep the title and author visible.</li>
            <li><CheckCircle size={17} /> Review the details before confirming.</li>
          </ul>
          <div className="ai-upload-note"><Eye size={18} /><p>You stay in control. Books are added only after you confirm.</p></div>
        </div>
        <div className="ai-upload-panel">
          <div className={`ai-dropzone ${dragging ? 'is-dragging' : ''} ${previewUrl ? 'has-preview' : ''}`}
            onDragOver={(event) => { event.preventDefault(); if (!processing) setDragging(true); }}
            onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
            onDrop={(event) => { event.preventDefault(); setDragging(false); if (!processing) selectFile(event.dataTransfer.files[0]); }}>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
              aria-label="Choose a book cover" className="sr-only" tabIndex={-1} disabled={processing}
              onChange={(event) => { selectFile(event.target.files[0]); event.target.value = ''; }} />
            {previewUrl ? <>
              <img src={previewUrl} alt="Selected book cover" className="ai-cover-preview" />
              <strong className="ai-upload-filename">{uploadedFile?.name}</strong>
              <p>Ready to extract book details</p>
              <div className="ai-upload-file-actions">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={processing}><Upload size={15} /> Change image</Button>
                <Button variant="secondary" size="sm" onClick={() => { setUploadedFile(null); setPreviewUrl(null); setErrors({}); }} disabled={processing}><X size={15} /> Remove</Button>
              </div>
            </> : <>
              <div className="ai-upload-icon"><FileImage size={32} /></div>
              <h3>Upload a book cover</h3>
              <p>Drag and drop your image here, or browse your files.</p>
              <Button onClick={() => fileInputRef.current?.click()}><Upload size={18} /> Choose image</Button>
              <span className="ai-upload-formats">JPG, PNG or WebP · Up to 5 MB</span>
            </>}
          </div>
          {errors.general && <p className="ai-catalog-error" role="alert"><AlertCircle size={17} />{errors.general}</p>}
          {previewUrl && <Button className="ai-start-button" onClick={startProcessing} loading={processing} disabled={!uploadedFile || processing}>
            <Sparkles size={18} /> Extract book details <ChevronRight size={17} />
          </Button>}
        </div>
      </div>
    );
  }
  function StepExtract() {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center animate-pulse">
          <Search className="w-12 h-12 text-primary-600" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Extracting Information</h3>
        <p className="text-[var(--text-muted)] mb-6">Reading text from the book cover using OCR...</p>
        {errors.general && <div className="ai-processing-error" role="alert"><p>{errors.general}</p><Button variant="secondary" onClick={resetWizard}><Upload size={16} /> Try another upload</Button></div>}
        <div className="max-w-md mx-auto space-y-4">
          {Object.entries(extractedData).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg">
              <span className="text-sm text-[var(--text-muted)] capitalize">{key.replace(/_/g, ' ')}</span>
              <span className="font-medium text-[var(--text)] truncate max-w-[200px]">{value || 'Not detected'}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function StepVerify() {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center animate-pulse">
          <BookOpen className="w-12 h-12 text-primary-600" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Verifying Online</h3>
        <p className="text-[var(--text-muted)] mb-6">Searching Open Library and Google Books...</p>
        <div className="max-w-md mx-auto space-y-4">
          {openLibraryData && (
            <Card className="p-3 border-primary-200">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="primary"><BookOpen className="w-3 h-3 mr-1" /> Open Library</Badge>
                <Badge variant={openLibraryData.docs?.length ? 'success' : 'warning'} className="text-xs">
                  {openLibraryData.docs?.length ? `${openLibraryData.docs.length} matches` : 'No matches'}
                </Badge>
              </div>
              {openLibraryData.docs?.[0] && (
                <p className="text-sm text-[var(--text-muted)]">{openLibraryData.docs[0].title}</p>
              )}
            </Card>
          )}
          {googleBooksData && (
            <Card className="p-3 border-teal-200">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="teal"><ExternalLink className="w-3 h-3 mr-1" /> Google Books</Badge>
                <Badge variant={googleBooksData.items?.length ? 'success' : 'warning'} className="text-xs">
                  {googleBooksData.items?.length ? `${googleBooksData.items.length} matches` : 'No matches'}
                </Badge>
              </div>
              {googleBooksData.items?.[0]?.volumeInfo && (
                <p className="text-sm text-[var(--text-muted)]">{googleBooksData.items[0].volumeInfo.title}</p>
              )}
            </Card>
          )}
        </div>
      </div>
    );
  }

  function StepClassify() {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center animate-pulse">
          <Sparkles className="w-12 h-12 text-primary-600" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Classifying Book</h3>
        <p className="text-[var(--text-muted)] mb-6">Organizing into genres and subjects...</p>
        <div className="max-w-md mx-auto space-y-3">
          <Card className="p-3">
            <p className="text-sm text-[var(--text-muted)]">Suggested Genre</p>
            <Badge variant="primary" className="text-base">{finalMetadata.genre || 'Not detected'}</Badge>
          </Card>
          <Card className="p-3">
            <p className="text-sm text-[var(--text-muted)]">Suggested Subject</p>
            <Badge variant="accent" className="text-base">{finalMetadata.subject || 'Not detected'}</Badge>
          </Card>
        </div>
      </div>
    );
  }

  function StepReview() {
    const fields = [
      { key: 'title', label: 'Title', required: true },
      { key: 'author', label: 'Author', required: true },
      { key: 'isbn', label: 'ISBN' },
      { key: 'publisher', label: 'Publisher' },
      { key: 'publication_date', label: 'Publication Date', type: 'date' },
      { key: 'edition', label: 'Edition' },
      { key: 'language', label: 'Language' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'genre', label: 'Genre' },
      { key: 'subject', label: 'Subject' },
      { key: 'shelf', label: 'Shelf' },
      { key: 'library_section', label: 'Library Section' },
    ];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-[var(--text)]">Review & Edit Information</h3>
          <Button variant="secondary" onClick={handleSaveDraft} loading={saving} disabled={confirming}>
            <Save className="w-4 h-4" /> Save Draft
          </Button>
        </div>

        {errors.general && <p className="text-red-600 text-sm mb-4">{errors.general}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {fields.map((field) => {
            const fieldValue = reviewData[field.key] ?? finalMetadata[field.key] ?? extractedData[field.key] ?? '';
            const value = fieldValue === 'Not detected' ? '' : fieldValue;
            const source = getFieldSource(field.key);
            const sourceInfo = SOURCE_BADGES[source] || SOURCE_BADGES.manual;
            const isNotDetected = !value;

            return (
              <div key={field.key} className={`${isNotDetected ? 'border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10' : ''} p-3 rounded-lg`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <label htmlFor={`ai-field-${field.key}`} className="label mb-0 flex-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                  {source === 'manual' ? (
                    <button
                      type="button"
                      onClick={() => handleManualEntry(field)}
                      className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      aria-label={`Enter ${field.label} manually`}
                      title={`Enter ${field.label} manually`}
                      aria-pressed={Boolean(manualEditFields[field.key])}
                    >
                      <Edit className="w-3 h-3" />
                      {manualEditFields[field.key] ? 'Editing' : 'Manual'}
                    </button>
                  ) : (
                    <Badge variant={sourceInfo.variant} className="text-xs flex-shrink-0">
                      {sourceInfo.icon && <sourceInfo.icon className="w-3 h-3 mr-1" />}
                      {sourceInfo.label}
                    </Badge>
                  )}
                </div>
                {field.type === 'textarea' ? (
                  <textarea
                    id={`ai-field-${field.key}`}
                    ref={(element) => { reviewFieldRefs.current[field.key] = element; }}
                    readOnly={source === 'manual' && !manualEditFields[field.key]}
                    value={value}
                    onChange={(e) => handleReviewFieldChange(field.key, e.target.value)}
                    className={`input min-h-[80px] resize-y ${isNotDetected ? 'border-amber-300' : ''}`}
                    placeholder={isNotDetected ? 'Not detected - please enter manually' : ''}
                  />
                ) : field.type === 'date' ? (
                  <input
                    id={`ai-field-${field.key}`}
                    ref={(element) => { reviewFieldRefs.current[field.key] = element; }}
                    readOnly={source === 'manual' && !manualEditFields[field.key]}
                    type="date"
                    value={value}
                    onChange={(e) => handleReviewFieldChange(field.key, e.target.value)}
                    className={`input ${isNotDetected ? 'border-amber-300' : ''}`}
                  />
                ) : (
                  <input
                    id={`ai-field-${field.key}`}
                    ref={(element) => { reviewFieldRefs.current[field.key] = element; }}
                    readOnly={source === 'manual' && !manualEditFields[field.key]}
                    type="text"
                    value={value}
                    onChange={(e) => handleReviewFieldChange(field.key, e.target.value)}
                    className={`input ${isNotDetected ? 'border-amber-300' : ''}`}
                    placeholder={isNotDetected ? 'Not detected' : ''}
                  />
                )}
                {isNotDetected && (
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    ⚠ Not detected - please enter manually
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t-[var(--border)] flex justify-end gap-2">
          <Button variant="secondary" onClick={resetWizard} disabled={confirming || saving}><Upload size={16} /> Start new upload</Button>
          <Button onClick={handleConfirm} loading={confirming} disabled={saving || !reviewData.title || !reviewData.author}>
            <CheckCircle className="w-4 h-4" /> Confirm & Add to Catalog
          </Button>
        </div>
      </div>
    );
  }

  function StepConfirm() {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Book Added Successfully!</h3>
        <p className="text-[var(--text-muted)] mb-6">The book has been added to the GSA library catalog.</p>
        <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={() => { resetWizard(); setShowDrafts(true); }}>
            <Plus className="w-4 h-4" /> Catalog Another
          </Button>
          <Button onClick={() => { resetWizard(); window.location.href = '/librarian/books'; }}>
            View in Catalog
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-heading font-bold text-[var(--text)]">AI Book Cataloging</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[...Array(3)].map((_, i) => <Card key={i} className="p-6 animate-pulse"><div className="h-8 bg-[var(--surface-2)] rounded" /></Card>)}
        </div>
      </div>
    );
  }

  return (
    <div className="ai-catalog-page">
      <div className="ai-catalog-heading">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">AI Book Cataloging</h1>
          <p className="text-[var(--text-muted)]">Turn a cover photo into a library-ready book entry.</p>
        </div>
        {jobs.length > 0 && (
          <Button variant="secondary" aria-expanded={showDrafts} aria-controls="ai-recent-jobs" onClick={() => setShowDrafts(!showDrafts)}>
            <History className="w-4 h-4" />
            {showDrafts ? 'Hide' : 'Show'} Recent Jobs
          </Button>
        )}
      </div>

      {/* Wizard */}
      <Card className="ai-wizard-card">
        <div ref={wizardRef} className="ai-wizard-anchor" tabIndex={-1} />
        {/* Stepper */}
        <ol className="ai-progress" aria-label="Cataloging progress">
          {STEPS.map((step, index) => (
            <li key={step.key} className={`ai-progress-step ${index < currentStep ? 'is-complete' : index === currentStep ? 'is-current' : ''}`} aria-current={index === currentStep ? 'step' : undefined}>
              <div className="ai-progress-icon">
                {index < currentStep ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <p>{step.label}<small>{index === currentStep ? 'Current step' : index < currentStep ? 'Complete' : `Step ${index + 1}`}</small></p>
            </li>
          ))}
        </ol>

        <div className="ai-wizard-content">{renderStep()}</div>
      </Card>

      {/* Recent Jobs */}
      {showDrafts && (
        <Card className="ai-jobs-card" id="ai-recent-jobs">
          <div className="ai-jobs-heading">
            <div><h2><History size={19} /> Recent cataloging jobs</h2><p>Review suggestions, continue a draft, or retry a failed upload.</p></div>
            <span className="ai-jobs-count">{jobs.length > 10 ? 'Latest 10 jobs' : `${jobs.length} job${jobs.length === 1 ? '' : 's'}`}</span>
          </div>
          {jobsError && <div className="ai-jobs-empty" role="alert"><p>{jobsError}</p><Button variant="secondary" onClick={fetchJobs}><RotateCcw size={16} /> Try again</Button></div>}
          {!jobsError && jobs.length === 0 ? <div className="ai-jobs-empty"><FileImage size={30} /><h3>No cataloging jobs yet</h3><p>Upload your first book cover to get started.</p></div> : !jobsError && <div className="ai-jobs-scroll" role="region" aria-label="Recent cataloging jobs" tabIndex={0}>
            <table className="ai-jobs-table">
              <caption className="sr-only">Recent book cover uploads and their cataloging status</caption>
              <thead>
                <tr className="border-b-[var(--border)]">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Image</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Author</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Confidence</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Created</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-[var(--text-muted)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 10).map((job) => (
                  <tr key={job.id} className="border-b-[var(--border)] hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-3">
                      {job.uploaded_image && (
                        <div className="relative flex w-16 h-20 items-center justify-center rounded bg-[var(--surface-2)]">
                          <FileImage className="w-5 h-5 text-[var(--text-faint)]" aria-hidden="true" />
                          <img
                            src={job.uploaded_image_url}
                            alt=""
                            onError={(event) => { event.currentTarget.hidden = true; }}
                            className="absolute inset-0 w-full h-full object-cover rounded"
                          />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[job.status] || 'info'} className={`ai-job-status status-${job.status}`}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 ai-job-title">
                      {job.final_metadata?.title || job.extracted_metadata?.title || 'Not detected'}
                    </td>
                    <td className="px-4 py-3">
                      {job.final_metadata?.author || job.extracted_metadata?.author || 'Not detected'}
                    </td>
                    <td className="px-4 py-3">
                      {job.confidence != null ? `${job.confidence}%` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.status === 'needs_review' && (
                          <Button size="sm" variant="primary" onClick={() => { setErrors({}); setManualEditFields({}); setActiveJob(job); updateWizardFromJob(job); setCurrentStep(4); wizardRef.current?.focus(); wizardRef.current?.scrollIntoView({ block: 'start' }); }}>
                            <Eye size={15} /> Review
                          </Button>
                        )}
                        {job.status === 'draft' && (
                          <Button size="sm" variant="secondary" onClick={() => { setErrors({}); setManualEditFields({}); setActiveJob(job); updateWizardFromJob(job); setCurrentStep(4); wizardRef.current?.focus(); wizardRef.current?.scrollIntoView({ block: 'start' }); }}>
                            <Edit size={15} /> Continue
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button size="sm" variant="secondary" onClick={() => retryJob(job.id)}>
                            <RotateCcw size={15} /> Retry
                          </Button>
                        )}
                        {['confirmed', 'failed'].includes(job.status) && (
                          <Button size="sm" variant="secondary" className="ai-delete-job" aria-label={`Delete job: ${job.final_metadata?.title || job.extracted_metadata?.title || 'Untitled book'}`} onClick={() => deleteJob(job.id)}>
                            <Trash2 className="w-4 h-4" /> Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
        </Card>
      )}
    </div>
  );
}

export default AiCatalogPage;
