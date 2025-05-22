'use client';

import React, { useEffect, useRef, useState, MouseEvent as ReactMouseEvent, useImperativeHandle, forwardRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { MinusIcon, PlusIcon, ArrowPathIcon, InformationCircleIcon } from '@heroicons/react/24/outline'; // Added InformationCircleIcon

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface PdfPreviewerProps {
  file: File;
}

export interface PdfPreviewerRef {
  getPageAsBlob: (pageNum: number, outputScale?: number) => Promise<Blob | null>;
  getNumPages: () => number;
}

const PdfPreviewer = forwardRef<PdfPreviewerRef, PdfPreviewerProps>(({ file }, ref) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPagesState, setNumPagesState] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const pageContainerRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    // Reset state when file changes or is removed
    setPdfDoc(null);
    setNumPagesState(0);
    setScale(1.0);
    canvasRefs.current = [];
    pageContainerRefs.current = [];
    setIsDragging(false); // Reset dragging state
    setActiveDragIndex(null);

    if (!file) {
      return;
    }

    const loadPdf = async () => {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPagesState(pdf.numPages);
        // Initialize refs for the correct number of pages
        canvasRefs.current = Array(pdf.numPages).fill(null).map(() => React.createRef<HTMLCanvasElement>() as any);
        pageContainerRefs.current = Array(pdf.numPages).fill(null).map(() => React.createRef<HTMLDivElement>() as any);
      } catch (error) {
        console.error('Error loading PDF:', error);
        setPdfDoc(null); // Ensure pdfDoc is null on error
        setNumPagesState(0); // Ensure numPages is 0 on error
      }
    };
    loadPdf();
    // Cleanup function not strictly needed here for file prop as useEffect handles re-runs.
    // However, if there were subscriptions inside loadPdf, they'd be cleaned up.
  }, [file]); // Effect runs when 'file' prop changes
  
  const renderPage = async (pageNum: number, currentScale: number, targetCanvas?: HTMLCanvasElement) => {
    if (!pdfDoc) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      // Ensure viewport scale is at least a minimum value to prevent rendering issues
      const safeScale = Math.max(0.1, currentScale); 
      const viewport = page.getViewport({ scale: safeScale });
      const canvas = targetCanvas || canvasRefs.current[pageNum - 1];

      if (canvas) {
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          const renderContext = { canvasContext: context, viewport: viewport };
          await page.render(renderContext).promise;
          if (!targetCanvas) { // Only for visible canvases
            canvas.style.transform = `translate(0px, 0px)`; // Reset drag transform
            // Ensure canvas is visible; it might be hidden by parent `overflow:hidden` if not scaled correctly
            canvas.style.maxWidth = `${viewport.width}px`; 
            canvas.style.maxHeight = `${viewport.height}px`;
          }
        }
      }
    } catch (error) {
      console.error(`Error rendering page ${pageNum} for ${targetCanvas ? 'blob' : 'view'}:`, error);
    }
  };

  useEffect(() => {
    if (!pdfDoc || numPagesState === 0) return;
    for (let i = 1; i <= numPagesState; i++) renderPage(i, scale);
  }, [pdfDoc, numPagesState, scale]); // Re-render all pages if scale changes or new PDF loaded

  const handleZoomIn = () => setScale(prevScale => Math.min(prevScale + 0.2, 3.0));
  const handleZoomOut = () => setScale(prevScale => Math.max(prevScale - 0.2, 0.2));
  const handleResetZoom = () => setScale(1.0);

  useImperativeHandle(ref, () => ({
    getPageAsBlob: async (pageNum: number, outputScale: number = 2.0): Promise<Blob | null> => {
      if (!pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) return null;
      try {
        const offscreenCanvas = document.createElement('canvas');
        await renderPage(pageNum, outputScale, offscreenCanvas);
        return new Promise(resolve => offscreenCanvas.toBlob(resolve, 'image/png'));
      } catch (error) { console.error('Error getting page as blob:', error); return null; }
    },
    getNumPages: () => numPagesState,
  }));

  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>, index: number) => {
    const canvas = canvasRefs.current[index];
    const container = pageContainerRefs.current[index];
    if (!canvas || !container || (canvas.offsetWidth <= container.clientWidth && canvas.offsetHeight <= container.clientHeight)) return;
    
    setIsDragging(true);
    setActiveDragIndex(index);
    const transform = window.getComputedStyle(canvas).transform;
    let currentX = 0, currentY = 0;
    if (transform !== 'none') { const matrix = new DOMMatrix(transform); currentX = matrix.m41; currentY = matrix.m42; }
    setDragStartPos({ x: e.clientX - currentX, y: e.clientY - currentY });
    canvas.style.cursor = 'grabbing';
    container.style.cursor = 'grabbing'; // Also set on container for better UX
  };

  const handleMouseMove = (e: globalThis.MouseEvent) => {
    if (!isDragging || activeDragIndex === null) return;
    const canvas = canvasRefs.current[activeDragIndex];
    const pageContainer = pageContainerRefs.current[activeDragIndex];
    if (canvas && pageContainer) {
      e.preventDefault();
      let newX = e.clientX - dragStartPos.x, newY = e.clientY - dragStartPos.y;
      const maxOffsetX = Math.max(0, canvas.offsetWidth - pageContainer.clientWidth);
      const maxOffsetY = Math.max(0, canvas.offsetHeight - pageContainer.clientHeight);
      newX = Math.min(0, Math.max(-maxOffsetX, newX));
      newY = Math.min(0, Math.max(-maxOffsetY, newY));
      canvas.style.transform = `translate(${newX}px, ${newY}px)`;
    }
  };

  const handleMouseUp = () => {
    if (isDragging && activeDragIndex !== null) {
      const canvas = canvasRefs.current[activeDragIndex];
      const container = pageContainerRefs.current[activeDragIndex];
      if (canvas) canvas.style.cursor = 'grab';
      if (container) container.style.cursor = 'grab'; // Reset container cursor
      setIsDragging(false);
      setActiveDragIndex(null);
    }
  };
  
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mouseleave', handleMouseUp); // Handle mouse leaving window
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseleave', handleMouseUp);
    };
  }, [isDragging, dragStartPos]);

  // Loading and no file states
  if (!file) return <div className="alert alert-info shadow-lg justify-center"><div><InformationCircleIcon className="h-6 w-6 shrink-0"/><span>No PDF file selected for preview.</span></div></div>;
  if (!pdfDoc && file) return <div className="alert alert-info shadow-lg justify-center"><div><span className="loading loading-spinner"></span><span>Loading PDF preview...</span></div></div>;
  if (pdfDoc && numPagesState === 0 && file) return <div className="alert alert-warning shadow-lg justify-center"><div><InformationCircleIcon className="h-6 w-6 shrink-0"/><span>Could not load PDF (perhaps corrupted or empty).</span></div></div>;


  return (
    <div className="card w-full bg-base-200 shadow-inner print:shadow-none">
      <div className="card-body p-3 sm:p-4">
        {/* Controls Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-3 sm:mb-4 gap-2">
          <h3 className="text-md sm:text-lg font-semibold text-base-content truncate" title={file.name}>
            Preview: <span className="font-normal opacity-80">{file.name}</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="btn-group">
              <button onClick={handleZoomOut} className="btn btn-outline btn-primary btn-xs sm:btn-sm" disabled={scale <= 0.2} title="Zoom Out">
                <MinusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button onClick={handleResetZoom} className="btn btn-outline btn-primary btn-xs sm:btn-sm" title="Reset Zoom">
                <ArrowPathIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <button onClick={handleZoomIn} className="btn btn-outline btn-primary btn-xs sm:btn-sm" disabled={scale >= 3.0} title="Zoom In">
                <PlusIcon className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <span className="text-xs sm:text-sm text-base-content/80 ml-1">Scale: {scale.toFixed(1)}x</span>
          </div>
        </div>

        {/* Pages Display */}
        {numPagesState > 0 ? (
          <div className="space-y-4 sm:space-y-6">
            {Array.from(new Array(numPagesState), (el, index) => (
              <div key={`page_wrapper_${index + 1}`} className="bg-base-100 p-2 sm:p-3 rounded-lg shadow hover:shadow-lg transition-shadow duration-300 print:shadow-none print:border print:border-base-300">
                <div 
                  ref={el => pageContainerRefs.current[index] = el}
                  className="page-container relative bg-white shadow-sm rounded overflow-hidden border border-base-300 mx-auto cursor-grab active:cursor-grabbing"
                  // The container itself does not need dynamic width/height based on scale. 
                  // It should define a consistent viewport. Max-width can be useful.
                  style={{ width: '100%', maxWidth: '700px', minHeight: '200px' }} 
                >
                  <canvas
                    ref={el => canvasRefs.current[index] = el}
                    onMouseDown={(e) => handleMouseDown(e, index)}
                    // Canvas style: display block and margin auto for centering if its actual rendered size is less than container.
                    // width/height 100% makes it responsive to its direct parent if its content scales.
                    // However, PDF.js sets canvas actual width/height. We want it to be its natural size from PDF.js,
                    // and then let the overflow:hidden and dragging work.
                    style={{ display: 'block', margin: '0 auto' }} 
                  />
                </div>
                <div className="flex justify-between items-center mt-1 sm:mt-2 px-1 text-xs text-base-content/70">
                  <span>Page {index + 1} of {numPagesState}</span>
                  <span className="badge badge-ghost badge-sm">Status: Original</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="alert alert-info shadow-lg justify-center"><div><span className="loading loading-spinner"></span><span>Loading pages...</span></div></div>
        )}
      </div>
    </div>
  );
});

export default PdfPreviewer;
