import { useState, useRef } from 'react';
import { FileText, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDocumentRAG } from '@/hooks/useDocumentRAG';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DocumentUploadProps {
  conversationId?: string;
  onDocumentProcessed?: (content: string, fileName: string) => void;
  disabled?: boolean;
}

const SUPPORTED_TYPES = [
'application/pdf',
'text/plain',
'text/csv',
'text/markdown',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];


const SUPPORTED_EXTENSIONS = ['pdf', 'txt', 'csv', 'md', 'docx'];

export function DocumentUpload({ conversationId, onDocumentProcessed, disabled }: DocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<{name: string;status: 'uploading' | 'done' | 'error';}[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { uploadDocument, isProcessing } = useDocumentRAG();
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase();

      if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
        toast({
          title: 'Unsupported File',
          description: `${file.name} is not supported. Use PDF, TXT, CSV, MD, or DOCX.`,
          variant: 'destructive'
        });
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {// 10MB limit
        toast({
          title: 'File Too Large',
          description: `${file.name} exceeds 10MB limit.`,
          variant: 'destructive'
        });
        continue;
      }

      setUploadedFiles((prev) => [...prev, { name: file.name, status: 'uploading' }]);

      try {
        const result = await uploadDocument(file, conversationId);

        if (result) {
          setUploadedFiles((prev) =>
          prev.map((f) => f.name === file.name ? { ...f, status: 'done' } : f)
          );

          onDocumentProcessed?.(result.fullText, result.fileName);

          toast({
            title: 'Document Processed',
            description: `${file.name} ready (${result.totalChunks} chunks)`
          });
        } else {
          throw new Error('Processing failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        setUploadedFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: 'error' } : f)
        );
        toast({
          title: 'Upload Failed',
          description: `Failed to process ${file.name}`,
          variant: 'destructive'
        });
      }
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const removeFile = (fileName: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.txt,.csv,.md,.docx"
        multiple
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isProcessing} />

      
      <Button
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || isProcessing}
        className="gap-2">

        {isProcessing ?
        <Loader2 className="h-4 w-4 animate-spin" /> :

        <Upload className="h-4 w-4" />
        }
        Upload Document
      </Button>

      {uploadedFiles.length > 0 &&
      <div className="flex flex-wrap gap-2 mt-2">
          {uploadedFiles.map((file, idx) =>
        <div
          key={`${file.name}-${idx}`}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm",
            file.status === 'uploading' && "bg-muted text-muted-foreground",
            file.status === 'done' && "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
            file.status === 'error' && "bg-destructive/20 text-destructive"
          )}>

              {file.status === 'uploading' ?
          <Loader2 className="h-3 w-3 animate-spin" /> :

          <FileText className="h-3 w-3" />
          }
              <span className="max-w-[150px] truncate">{file.name}</span>
              {file.status !== 'uploading' &&
          <button
            onClick={() => removeFile(file.name)}
            className="hover:opacity-70">

                  <X className="h-3 w-3" />
                </button>
          }
            </div>
        )}
        </div>
      }

      <p className="text-xs text-muted-foreground px-px py-px mx-[2px] my-[2px]">
        Supports PDF, TXT, CSV, MD, DOCX (max 10MB)
      </p>
    </div>);

}