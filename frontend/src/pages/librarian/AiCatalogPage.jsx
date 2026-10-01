import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileImage, Search, BookOpen, Sparkles, CheckCircle,
  AlertCircle, X, ChevronRight, ChevronDown, Eye, Edit, Save, Download,
  Image, Loader2, Trash2, Plus, ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../utils/api';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { formatDate } from '../../utils/helpers';

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
  ocr: { variant: 'purple', label: 'OCR', icon: Sparkles },
  open_library: { variant: 'primary', label: 'Open Library', icon: BookOpen },
  google_books: { variant: 'teal', label: 'Google Books', icon: ExternalLink },
  manual: { variant: 'secondary', label: 'Manual', icon: Edit },
};

function AiCatalogPage() {
  const { user } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDrafts, setShowDrafts] = useState(true);
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const response = await api.get('/ai-catalog');
      if (response.data.success) {
        setJobs(response.data.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
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
    if (job.extracted_metadata) setExtractedData(job.extracted_metadata);
    if (job.open_library_result) setOpenLibraryData(job.open_library_result);
    if (job.google_books_result) setGoogleBooksData(job.google_books_result);
    if (job.final_metadata) {
      setFinalMetadata(job.final_metadata);
      setReviewData({ ...job.final_metadata });
    }
  };

  const handleReviewFieldChange = (field, value) => {
    setReviewData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveDraft = async () => {
    if (!activeJob) return;
    setSaving(true);
    try {
      await api.post(`/ai-catalog/${activeJob.id}/draft`, { final_metadata: reviewData });
      setActiveJob((prev) => prev ? { ...prev, status: 'draft', final_metadata: reviewData } : null);
      alert('Draft saved successfully!');
    } catch (err) {
      alert('Failed to save draft');
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
        alert('Book added to catalog successfully!');
        fetchJobs();
        resetWizard();
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
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const retryJob = async (jobId) => {
    try {
      await api.post(`/ai-catalog/${jobId}/retry`);
      fetchJobs();
    } catch (err) {
      alert('Failed to retry job');
    }
  };

  const deleteJob = async (jobId) => {
    if (!confirm('Delete this job?')) return;
    try {
      await api.delete(`/ai-catalog/${jobId}`);
      setJobs((prev) => prev.filter((j) => j.id !== jobId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete job');
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
      case 0: return <StepUpload />;
      case 1: return <StepExtract />;
      case 2: return <StepVerify />;
      case 3: return <StepClassify />;
      case 4: return <StepReview />;
      case 5: return <StepConfirm />;
      default: return <StepUpload />;
    }
  };

  function StepUpload() {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Upload className="w-12 h-12 text-primary-600" />
        </div>
        <h3 className="text-xl font-semibold text-[var(--text)] mb-2">Upload Book Cover</h3>
        <p className="text-[var(--text-muted)] mb-6 max-w-md mx-auto">
          Upload a clear photo of the book cover. Supported formats: JPG, PNG, WebP (max 5MB)
        </p>
        <div className="max-w-md mx-auto">
          <label className="relative cursor-pointer">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="sr-only"
            />
            <div className={`border-2 border-dashed rounded-xl p-8 transition-colors ${
              previewUrl ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-[var(--border)] hover:border-primary-300'
            }`}>
              {previewUrl ? (
                <div className="relative">
                  <img src={previewUrl} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                  <button
                    type="button"
                    onClick={() => { setUploadedFile(null); setPreviewUrl(null); setCurrentStep(0); }}
                    className="absolute top-2 right-2 btn-ghost p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <FileImage className="w-12 h-12 mx-auto text-[var(--text-faint)] mb-3" />
                  <p className="text-[var(--text-muted)]">Click to upload or drag and drop</p>
                  <p className="text-xs text-[var(--text-faint)] mt-1">JPG, PNG, WebP • Max 5MB</p>
                </>
              )}
            </div>
          </label>
        </div>
        {previewUrl && (
          <>
            {errors.general && <p className="mt-4 text-sm text-red-600">{errors.general}</p>}
            <Button className="mt-6 w-full md:w-auto" size="lg" onClick={startProcessing} loading={processing} disabled={!uploadedFile || processing}>
            Start Processing
            <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
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
        {errors.general && <p className="text-sm text-red-600 mb-4">{errors.general}</p>}
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
          <Button variant="secondary" onClick={handleSaveDraft} loading={saving}>
            <Save className="w-4 h-4" /> Save Draft
          </Button>
        </div>

        {errors.general && <p className="text-red-600 text-sm mb-4">{errors.general}</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
          {fields.map((field) => {
            const value = reviewData[field.key] || finalMetadata[field.key] || extractedData[field.key] || '';
            const source = getFieldSource(field.key);
            const sourceInfo = SOURCE_BADGES[source] || SOURCE_BADGES.manual;
            const isNotDetected = !value || value === 'Not detected';

            return (
              <div key={field.key} className={`${isNotDetected ? 'border-2 border-dashed border-amber-300 bg-amber-50 dark:bg-amber-900/10' : ''} p-3 rounded-lg`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <label className="label mb-0 flex-1">{field.label} {field.required && <span className="text-red-500">*</span>}</label>
                  <Badge variant={sourceInfo.variant} className="text-xs flex-shrink-0">
                    {sourceInfo.icon && <sourceInfo.icon className="w-3 h-3 mr-1" />}
                    {sourceInfo.label}
                  </Badge>
                </div>
                {field.type === 'textarea' ? (
                  <textarea
                    value={reviewData[field.key] || value}
                    onChange={(e) => handleReviewFieldChange(field.key, e.target.value)}
                    className={`input min-h-[80px] resize-y ${isNotDetected ? 'border-amber-300' : ''}`}
                    placeholder={isNotDetected ? 'Not detected - please enter manually' : ''}
                  />
                ) : field.type === 'date' ? (
                  <input
                    type="date"
                    value={reviewData[field.key] || value}
                    onChange={(e) => handleReviewFieldChange(field.key, e.target.value)}
                    className={`input ${isNotDetected ? 'border-amber-300' : ''}`}
                  />
                ) : (
                  <input
                    type="text"
                    value={reviewData[field.key] || value}
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
          <Button variant="secondary" onClick={() => setCurrentStep(3)}><ChevronRight className="w-4 h-4" /> Back</Button>
          <Button onClick={handleConfirm} loading={confirming} disabled={!reviewData.title || !reviewData.author}>
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text)]">AI Book Cataloging</h1>
          <p className="text-[var(--text-muted)]">Upload a book cover to automatically catalog using AI/OCR</p>
        </div>
        {showDrafts && jobs.length > 0 && (
          <Button variant="secondary" onClick={() => setShowDrafts(!showDrafts)}>
            <ChevronDown className="w-4 h-4" />
            {showDrafts ? 'Hide' : 'Show'} Recent Jobs
          </Button>
        )}
      </div>

      {/* Wizard */}
      <Card className="p-6">
        {/* Stepper */}
        <div className="stepper mb-8">
          {STEPS.map((step, index) => (
            <div key={step.key} className="stepper-step flex-1">
              <div className={`stepper-icon ${index < currentStep ? 'completed' : index === currentStep ? 'active' : 'pending'}`}>
                {index < currentStep ? <CheckCircle className="w-5 h-5" /> : <step.icon className="w-5 h-5" />}
              </div>
              <p className="stepper-label">{step.label}</p>
            </div>
          ))}
        </div>

        {renderStep()}
      </Card>

      {/* Recent Jobs */}
      {showDrafts && (
        <Card>
          <div className="p-4 border-b-[var(--border)] flex items-center justify-between">
            <h3 className="font-semibold text-[var(--text)]">Recent AI Cataloging Jobs</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
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
                        <img src={`/storage/${job.uploaded_image}`} alt="" className="w-16 h-20 object-cover rounded" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_COLORS[job.status] || 'info'}>
                        {job.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {job.final_metadata?.title || job.extracted_metadata?.title || 'Not detected'}
                    </td>
                    <td className="px-4 py-3">
                      {job.final_metadata?.author || job.extracted_metadata?.author || 'Not detected'}
                    </td>
                    <td className="px-4 py-3">
                      {job.confidence ? `${job.confidence}%` : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-muted)]">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {job.status === 'needs_review' && (
                          <Button size="sm" variant="primary" onClick={() => { setActiveJob(job); updateWizardFromJob(job); setCurrentStep(4); }}>
                            Review
                          </Button>
                        )}
                        {job.status === 'draft' && (
                          <Button size="sm" variant="secondary" onClick={() => { setActiveJob(job); updateWizardFromJob(job); setCurrentStep(4); }}>
                            Continue
                          </Button>
                        )}
                        {job.status === 'failed' && (
                          <Button size="sm" variant="ghost" onClick={() => retryJob(job.id)}>
                            Retry
                          </Button>
                        )}
                        {['confirmed', 'failed'].includes(job.status) && (
                          <Button size="sm" variant="ghost" onClick={() => deleteJob(job.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

export default AiCatalogPage;
