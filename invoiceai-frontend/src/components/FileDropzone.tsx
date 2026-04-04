import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import type { FileRejection } from 'react-dropzone';
import { UploadCloud, XCircle, File, Loader2 } from 'lucide-react';
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

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpeg', '.jpg'],
      'image/png': ['.png']
    },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: isUploading
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

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors duration-200 flex flex-col items-center justify-center min-h-[300px]
            ${isUploading ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : ''}
            ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'}
            ${fileError ? 'border-red-400 bg-red-50' : ''}
          `}
        >
          <input {...getInputProps()} />
          <UploadCloud className={`h-16 w-16 mb-4 ${isDragActive ? 'text-blue-500' : 'text-gray-400'} ${fileError ? 'text-red-400' : ''}`} />
          <p className="text-lg font-medium text-gray-700">
            {isDragActive ? 'Drop invoice here...' : 'Drag invoice here or click to browse'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Supports PDF, JPG, JPEG, and PNG up to 20MB
          </p>
          
          {fileError && (
            <div className="mt-4 flex items-center text-red-600 bg-red-100 px-3 py-2 rounded-md">
              <XCircle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">{fileError}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl p-6 bg-white shadow-sm flex flex-col min-h-[300px]">
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="p-4 bg-blue-50 rounded-full mb-4">
              <File className="h-12 w-12 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 text-lg truncate max-w-sm text-center">
              {selectedFile.name}
            </h4>
            <p className="text-sm text-gray-500 mt-1">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-100">
            <Button 
              className="flex-1" 
              onClick={handleClear}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" 
              onClick={handleUploadSubmit}
              disabled={isUploading}
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                'Process Invoice'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};