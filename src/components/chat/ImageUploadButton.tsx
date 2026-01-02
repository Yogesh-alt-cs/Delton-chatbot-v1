import { useRef, useState } from 'react';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MessageImage } from '@/lib/types';

interface ImageUploadButtonProps {
  images: MessageImage[];
  onImagesChange: (images: MessageImage[]) => void;
  disabled?: boolean;
  maxImages?: number;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export function ImageUploadButton({ 
  images, 
  onImagesChange, 
  disabled,
  maxImages = 4 
}: ImageUploadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Extract just the base64 part without the data URI prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsLoading(true);

    try {
      const newImages: MessageImage[] = [];

      for (const file of files) {
        if (!ACCEPTED_TYPES.includes(file.type)) {
          console.warn(`Skipped ${file.name}: unsupported type`);
          continue;
        }
        if (file.size > MAX_FILE_SIZE) {
          console.warn(`Skipped ${file.name}: file too large`);
          continue;
        }
        if (images.length + newImages.length >= maxImages) {
          break;
        }

        const base64 = await convertToBase64(file);
        const url = URL.createObjectURL(file);
        
        newImages.push({
          url,
          base64,
          mimeType: file.type,
        });
      }

      onImagesChange([...images, ...newImages]);
    } catch (error) {
      console.error('Error processing images:', error);
    } finally {
      setIsLoading(false);
      // Reset input
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const removeImage = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onImagesChange(newImages);
  };

  return (
    <div className="flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {images.map((image, index) => (
            <div 
              key={index} 
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-border"
            >
              <img 
                src={image.url} 
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(index)}
                className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-background/80 hover:bg-background"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-11 w-11 shrink-0 rounded-xl transition-all",
          images.length >= maxImages && "opacity-50"
        )}
        onClick={handleClick}
        disabled={disabled || isLoading || images.length >= maxImages}
      >
        {isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <ImagePlus className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
