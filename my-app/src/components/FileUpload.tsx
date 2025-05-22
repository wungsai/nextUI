'use client';

import React, { useState, ChangeEvent, useRef } from 'react';
import PdfPreviewer, { PdfPreviewerRef } from './PdfPreviewer';
import { ArrowDownTrayIcon, PhotoIcon, InformationCircleIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface FileUploadProps {
  newFilenameBase?: string;
}

interface AlertState {
  message: string;
  type: 'success' | 'error' | 'info';
  visible: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ newFilenameBase }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileToPreview, setFileToPreview] = useState<File | null>(null);
  const [pageNumberToDownload, setPageNumberToDownload] = useState<string>('1');
  const pdfPreviewerRef = useRef<PdfPreviewerRef>(null);
  const [alert, setAlert] = useState<AlertState>({ message: '', type: 'info', visible: false });

  const showAlert = (message: string, type: 'success' | 'error' | 'info' = 'info', duration: number = 4000) => {
    setAlert({ message, type, visible: true });
    // Clear existing timeouts if any
    const timerId = setTimeout(() => {
      setAlert(prev => (prev.message === message ? { ...prev, visible: false } : prev));
    }, duration);
    return () => clearTimeout(timerId); // Cleanup function for useEffect if used there
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      const pdfFiles = filesArray.filter(file => file.type === 'application/pdf');
      setSelectedFiles(pdfFiles);

      if (pdfFiles.length > 0) {
        const firstFile = pdfFiles[0];
        setFileToPreview(firstFile);
        setPageNumberToDownload('1');
        showAlert(`Previewing: ${firstFile.name}`, 'info');
      } else {
        setFileToPreview(null);
        showAlert('No PDF files selected.', 'info');
      }
    }
  };

  const handleDownloadPdf = () => {
    if (!fileToPreview) {
      showAlert('No PDF file selected for download.', 'error');
      return;
    }
    const filename = `${newFilenameBase || fileToPreview.name.replace(/\.pdf$/i, '')}.pdf`;
    const url = URL.createObjectURL(fileToPreview);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showAlert(`Successfully downloaded: ${filename}`, 'success');
  };

  const handleDownloadPageAsImage = async () => {
    if (!fileToPreview || !pdfPreviewerRef.current) {
      showAlert('No PDF file selected or previewer not ready.', 'error');
      return;
    }
    const pageNum = parseInt(pageNumberToDownload, 10);
    const totalPages = pdfPreviewerRef.current.getNumPages();
    if (isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
      showAlert(`Please enter a valid page number (1-${totalPages}).`, 'error');
      return;
    }
    try {
      const blob = await pdfPreviewerRef.current.getPageAsBlob(pageNum, 2.0);
      if (blob) {
        const filename = `${newFilenameBase || fileToPreview.name.replace(/\.pdf$/i, '')}_page_${pageNum}.png`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showAlert(`Downloaded page ${pageNum} as: ${filename}`, 'success');
      } else {
        showAlert('Could not generate page image. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error downloading page as image:', error);
      showAlert('An error occurred while generating the page image.', 'error');
    }
  };
  
  return (
    <div className="space-y-6 sm:space-y-8"> {/* Adjusted spacing for responsiveness */}
      {/* Alert Area: Positioned at the top, full-width within its relative container */}
      {alert.visible && (
         <div className={`alert shadow-lg ${alert.type === 'success' ? 'alert-success' : alert.type === 'error' ? 'alert-error' : 'alert-info'} transition-opacity duration-300 ease-in-out`}>
          <div className="flex-1"> {/* Ensure icon and text are on the same line and take up space */}
            {alert.type === 'success' && <CheckCircleIcon className="h-6 w-6 mr-2 flex-shrink-0" />}
            {alert.type === 'error' && <ExclamationTriangleIcon className="h-6 w-6 mr-2 flex-shrink-0" />}
            {alert.type === 'info' && <InformationCircleIcon className="h-6 w-6 mr-2 flex-shrink-0" />}
            <span className="text-sm sm:text-base">{alert.message}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setAlert(prev => ({ ...prev, visible: false }))}>Close</button>
        </div>
      )}

      <div className="card w-full bg-base-100 shadow-xl">
        <div className="card-body p-5 sm:p-8"> {/* Responsive padding */}
          <h2 className="card-title text-lg sm:text-xl mb-3 sm:mb-4">1. Select PDF Files</h2>
          <input
            id="file-upload"
            name="file-upload"
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            className="file-input file-input-bordered file-input-primary w-full text-sm sm:text-base"
          />
          {selectedFiles.length > 0 && (
            <div className="mt-4 sm:mt-5">
              <h3 className="text-sm sm:text-md font-semibold text-base-content/90 mb-2">Selected files (click to preview):</h3>
              <div className="max-h-32 sm:max-h-40 overflow-y-auto rounded-md border border-base-300 bg-base-200 p-2 space-y-1">
                {selectedFiles.map((file) => ( // Removed index as key if file.name is unique enough, or use new Date().getTime() + index for more robustness
                  <div 
                      key={file.name + file.lastModified} // Better key
                      className={`p-2 rounded-md hover:bg-base-300/70 cursor-pointer text-xs sm:text-sm truncate ${file === fileToPreview ? 'font-semibold text-primary bg-primary/10 ring-1 ring-primary' : 'text-base-content'}`}
                      onClick={() => { setFileToPreview(file); setPageNumberToDownload('1'); showAlert(`Previewing: ${file.name}`, 'info', 2000); }}
                      title={file.name} // Show full name on hover
                  >
                    {file.name} <span className="text-xs opacity-70">({Math.round(file.size / 1024)} KB)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {fileToPreview && (
        <>
          <div className="card w-full bg-base-100 shadow-xl">
            <div className="card-body p-5 sm:p-8">
              <h2 className="card-title text-lg sm:text-xl mb-3 sm:mb-4">2. Download Options</h2>
              <div className="space-y-3 sm:space-y-4">
                <button
                  onClick={handleDownloadPdf}
                  disabled={!fileToPreview}
                  className="btn btn-success w-full text-sm sm:text-base"
                >
                  <ArrowDownTrayIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Download PDF {newFilenameBase ? `as "${newFilenameBase}.pdf"` : `(${fileToPreview.name})`}
                </button>
                {/* Responsive flex layout for download page section */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-3">
                  <input
                    type="number"
                    min="1"
                    max={pdfPreviewerRef.current?.getNumPages() || 1}
                    value={pageNumberToDownload}
                    onChange={(e) => setPageNumberToDownload(e.target.value)}
                    className="input input-bordered input-sm w-full sm:w-24 text-center text-sm sm:text-base"
                    disabled={!fileToPreview}
                    placeholder="Page #"
                  />
                  <button
                    onClick={handleDownloadPageAsImage}
                    disabled={!fileToPreview || !pageNumberToDownload}
                    className="btn btn-info flex-grow text-sm sm:text-base" 
                  >
                    <PhotoIcon className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                    Download Page {pageNumberToDownload} as Image
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card w-full bg-base-100 shadow-xl mt-6 sm:mt-8"> {/* Consistent margin */}
            <div className="card-body p-2 sm:p-4"> {/* Reduced padding for previewer card as it has its own internal padding */}
              <h2 className="card-title text-lg sm:text-xl mb-2 sm:mb-3 text-center">3. PDF Preview</h2>
              <PdfPreviewer ref={pdfPreviewerRef} file={fileToPreview} />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FileUpload;
