import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, X, Loader2, Trash2, MessageCircle, Search, File, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDocumentRAG } from '@/hooks/useDocumentRAG';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'csv', 'md', 'docx'];

const FILE_ICONS: Record<string, string> = {
  pdf: '📄',
  txt: '📝',
  csv: '📊',
  md: '📋',
  docx: '📃',
};

export default function Documents() {
  const navigate = useNavigate();
  const { uploadDocument, loadDocuments, deleteDocument, documents, isProcessing } = useDocumentRAG();
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<{ name: string; status: 'uploading' | 'done' | 'error' }[]>([]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const processFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
      toast({ title: 'Unsupported File', description: `${file.name} is not supported. Use PDF, TXT, CSV, MD, or DOCX.`, variant: 'destructive' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File Too Large', description: `${file.name} exceeds 10MB limit.`, variant: 'destructive' });
      return;
    }

    setUploadingFiles(prev => [...prev, { name: file.name, status: 'uploading' }]);

    try {
      const result = await uploadDocument(file);
      if (result) {
        setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'done' } : f));
        toast({ title: 'Document Processed', description: `${file.name} ready (${result.totalChunks} chunks)` });
        await loadDocuments();
      } else {
        throw new Error('Processing failed');
      }
    } catch {
      setUploadingFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: 'error' } : f));
      toast({ title: 'Upload Failed', description: `Failed to process ${file.name}`, variant: 'destructive' });
    }
  }, [uploadDocument, loadDocuments, toast]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) await processFile(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) await processFile(file);
  };

  const handleDeleteDoc = async (fileName: string) => {
    const success = await deleteDocument(fileName);
    if (success) toast({ title: 'Deleted', description: `${fileName} removed.` });
    else toast({ title: 'Error', description: 'Failed to delete document.', variant: 'destructive' });
  };

  const filteredDocs = documents.filter(d =>
    d.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="flex h-14 items-center gap-3 px-4 glass-panel-strong safe-top shrink-0 z-10 border-b border-border/20">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold text-sm">Documents</span>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Upload Area */}
        <motion.div
          ref={dropRef}
          className={cn(
            "glass-panel rounded-3xl p-8 text-center cursor-pointer transition-all border-dashed border-2",
            isDragging ? "border-primary/40 glass-glow" : "border-border/20 hover:border-border/40"
          )}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <motion.div
            className="flex flex-col items-center gap-3"
            animate={isDragging ? { scale: 1.05 } : { scale: 1 }}
          >
            <div className="h-14 w-14 rounded-2xl glass-panel flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">Drop files here or tap to upload</p>
              <p className="text-xs text-muted-foreground mt-1">PDF, TXT, CSV, MD, DOCX — Max 10MB</p>
            </div>
          </motion.div>

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt,.csv,.md,.docx"
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={isProcessing}
          />
        </motion.div>

        {/* Uploading files */}
        <AnimatePresence>
          {uploadingFiles.filter(f => f.status === 'uploading').length > 0 && (
            <motion.div
              className="space-y-2"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              {uploadingFiles.filter(f => f.status === 'uploading').map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="glass-panel rounded-2xl px-4 py-3 flex items-center gap-3">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground">Processing...</span>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search */}
        {documents.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              className="pl-10 rounded-2xl glass-input border-border/20 h-11"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        {/* Document List */}
        <div className="space-y-2">
          <AnimatePresence>
            {filteredDocs.map((doc, index) => {
              const ext = doc.fileType?.toLowerCase() || doc.fileName.split('.').pop()?.toLowerCase() || 'txt';
              return (
                <motion.div
                  key={doc.id}
                  className="glass-panel rounded-2xl p-4 group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl glass-panel flex items-center justify-center text-lg shrink-0">
                      {FILE_ICONS[ext] || '📄'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{doc.fileName}</p>
                      <p className="text-xs text-muted-foreground">
                        {ext.toUpperCase()} • {format(new Date(doc.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                        onClick={() => navigate(`/chat?doc=${encodeURIComponent(doc.fileName)}`)}
                        title="Ask Delton about this document"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => handleDeleteDoc(doc.fileName)}
                        title="Delete document"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {documents.length === 0 && (
            <div className="text-center py-12">
              <File className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No documents yet. Upload one to get started.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
