import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { UploadCloud, XCircle, FileIcon as FilePdf, Image as FileImage, Loader2 } from 'lucide-react';
import { Button } from './ui/button';

interface FileDropzoneProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ onUpload, isUploading }) => {
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    setFileError(null);
    
    if (rejectedFiles.length > 0) {
      const error = rejectedFiles[0].errors[0];
      if (error.code === 'file-too-large') {
        setFileError('File exceeds the 20MB limit.');
      } else if (error.code === 'file-invalid-type') {
        setFileError('Invalid file type. Please upload a PDF, JPG, or PNG.');
      } else {
        setFileError(error.message);
      }
      return;
    }

    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: isUploading,
    noClick: true, // we handle click via the Browse Files button
  });

  const handleUploadSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileError(null);
  };

  const isPDF = selectedFile?.type === 'application/pdf';

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`relative border-2 rounded-2xl p-10 text-center transition-colors duration-200 flex flex-col items-center justify-center min-h-[320px] shadow-sm
            ${isDragActive ? 'border-blue-400 bg-blue-50 border-solid' : 'border-ink-300 bg-ink-50 border-dashed'}
            ${fileError ? 'border-red-400 bg-red-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`h-12 w-12 mb-5 transition-colors ${isDragActive ? 'text-blue-500' : 'text-ink-400'} ${fileError ? 'text-red-400' : ''}`} />
          
          <h3 className="text-xl font-medium text-ink-700 tracking-tight">
            {isDragActive ? 'Release to upload' : 'Drop your invoice here'}
          </h3>
          <p className="text-sm text-ink-500 mt-1 font-medium">
            PDF, JPG, PNG up to 20MB
          </p>
          
          {!isDragActive && (
            <div className="flex items-center w-48 mt-6 mb-6">
              <div className="flex-1 border-t border-ink-300"></div>
              <span className="px-3 text-xs font-bold uppercase text-ink-400 tracking-wider">OR</span>
              <div className="flex-1 border-t border-ink-300"></div>
            </div>
          )}

          {!isDragActive && (
            <Button 
               variant="outline" 
               type="button" 
               onClick={open} 
               className="bg-white hover:bg-ink-50 text-ink-700 border-ink-300 shadow-sm font-semibold px-6"
            >
               Browse Files
            </Button>
          )}
          
          {fileError && (
            <div className="absolute bottom-4 flex items-center text-red-600 bg-red-100 px-4 py-2 flex-row rounded-lg border border-red-200 shadow-sm animate-in zoom-in fade-in">
              <XCircle className="h-4 w-4 mr-2 shrink-0" />
              <span className="text-xs font-bold">{fileError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-ink-200 rounded-2xl p-8 bg-white shadow-sm flex flex-col min-h-[320px] relative overflow-hidden">
          
          {/* Uploading Top progress strip animated */}
          {isUploading && (
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-ink-100 overflow-hidden">
                <div className="h-full bg-blue-500 w-[50%] animate-[slide_1.5s_ease-in-out_infinite] rounded-full"></div>
             </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center fade-in animate-in duration-300 mt-2">
            <div className={`p-5 rounded-full mb-5 ring-4 ${isPDF ? 'bg-red-50 text-red-500 ring-red-50/50' : 'bg-blue-50 text-blue-500 ring-blue-50/50'}`}>
              {isPDF ? <FilePdf className="h-10 w-10" /> : <FileImage className="h-10 w-10" />}
            </div>
            <h4 className="font-bold text-ink-900 text-lg max-w-sm truncate text-center mb-1 tracking-tight" title={selectedFile.name}>
              {selectedFile.name}
            </h4>
            <p className="text-sm font-semibold text-ink-400">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>

            {isUploading && (
               <div className="flex items-center justify-center gap-2 mt-6 animate-pulse">
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  <span className="text-sm font-bold text-blue-700 tracking-tight">Uploading & Processing...</span>
               </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 mt-8 pt-6 border-t border-ink-100">
            <Button 
              variant="ghost"
              className="flex-1 text-ink-500 hover:text-ink-900 hover:bg-ink-100 font-bold" 
              onClick={handleClear}
              disabled={isUploading}
            >
              Change File
            </Button>
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-md font-bold" 
              onClick={handleUploadSubmit}
              disabled={isUploading}
            >
              Upload & Process
            </Button>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
};