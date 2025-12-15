
import React, { useEffect, useState, useRef } from 'react';
import { Button } from './Button';
import { ArrowLeft, Upload, FileText, Image as ImageIcon, FileCode, AlertCircle, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, FileArchive, FolderOpen, Video } from 'lucide-react';
// @ts-ignore
import * as pdfjsLibModule from 'pdfjs-dist';

// --- PDF.js Initialization Logic ---
let pdfjsLib: any = pdfjsLibModule;

if (pdfjsLibModule.default && (pdfjsLibModule.default.GlobalWorkerOptions || pdfjsLibModule.default.getDocument)) {
  pdfjsLib = pdfjsLibModule.default;
}

const WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

try {
    if (pdfjsLib.GlobalWorkerOptions) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_URL;
    }
} catch (e) {
    console.error("Failed to set worker source", e);
}

interface PDFViewerProps {
  onBack: () => void;
  initialFile?: File | null;
}

export const PDFViewer: React.FC<PDFViewerProps> = ({ onBack, initialFile }) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileObj, setFileObj] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'pdf' | 'image' | 'video' | 'text' | 'unknown'>('unknown');
  const [textContent, setTextContent] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // PDF Engine State
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.0);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile);
    }
  }, [initialFile]);

  useEffect(() => {
    if (pdfDoc && fileType === 'pdf') {
      renderPage(pageNum);
    }
  }, [pdfDoc, pageNum, scale]);

  const loadFile = (file: File) => {
    setLoading(true);
    setError(null);
    setFileObj(file);
    
    setPdfDoc(null);
    setPageNum(1);
    setNumPages(0);
    
    const mime = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // 1. PDF HANDLING
    if (mime.includes('pdf') || ext === 'pdf') {
      setFileType('pdf');
      const reader = new FileReader();
      reader.onload = async (e) => {
        if (e.target?.result) {
          try {
            const typedarray = new Uint8Array(e.target.result as ArrayBuffer);
            const loadingTask = pdfjsLib.getDocument({
                data: typedarray,
                cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
                cMapPacked: true,
            });

            const doc = await loadingTask.promise;
            
            setPdfDoc(doc);
            setNumPages(doc.numPages);
            setLoading(false);
          } catch (err: any) {
            console.error("PDF Load Error:", err);
            let errorMessage = err.message || "Unknown error";
            if (errorMessage.includes("fake worker")) {
                errorMessage = "PDF Worker failed to initialize.";
            }
            setError(`Failed to load PDF: ${errorMessage}`);
            setLoading(false);
          }
        }
      };
      reader.readAsArrayBuffer(file);
      return; 
    }

    // 2. OTHER FILES
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    if (mime.includes('image') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) {
      setFileType('image');
      setLoading(false);
    } else if (mime.includes('video') || ['mp4','webm','ogg','mov','mkv'].includes(ext)) {
      setFileType('video');
      setLoading(false);
    } else if (
      mime.includes('text') || 
      ['txt','md','json','xml','css','js','ts','csv','log','rtf'].includes(ext)
    ) {
      setFileType('text');
      const reader = new FileReader();
      reader.onload = (e) => {
        setTextContent(e.target?.result as string || '');
        setLoading(false);
      };
      reader.readAsText(file);
    } else {
      setFileType('unknown');
      setLoading(false);
    }
  };

  const renderPage = async (num: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    if (renderTaskRef.current) {
        await renderTaskRef.current.cancel();
    }

    try {
        const page = await pdfDoc.getPage(num);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');
        
        if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };
            
            const renderTask = page.render(renderContext);
            renderTaskRef.current = renderTask;
            await renderTask.promise;
        }
    } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
            console.error("Render error", err);
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadFile(file);
      e.target.value = ''; 
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-sky-500">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mb-4"></div>
          <p className="font-medium text-sky-400">Securely Opening File...</p>
        </div>
      );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4 border border-red-100">
                  <AlertCircle className="text-red-600" size={32} />
                </div>
                <h3 className="text-xl font-bold text-sky-800">Error Opening File</h3>
                <p className="text-sky-400 mt-2 mb-6">{error}</p>
                <Button onClick={() => document.getElementById('viewer-upload')?.click()}>Try Another File</Button>
            </div>
        );
    }

    if (!fileObj) {
      return (
        <div className="text-center p-12">
          {/* Sky Icon, White/Sky BG */}
          <div className="w-24 h-24 bg-sky-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-md border border-sky-100">
            <FolderOpen className="text-sky-500" size={48} />
          </div>
          <h3 className="text-2xl font-bold text-sky-600 mb-2">No File Selected</h3>
          <p className="text-sky-400 mb-8 max-w-sm mx-auto">
            Securely view PDFs, videos, images, code, or text documents directly in your browser.
          </p>
          <label className="cursor-pointer inline-block">
            {/* Strictly hide inputs using inline styles */}
            <input 
              id="viewer-upload"
              type="file" 
              style={{ display: 'none' }} 
              onChange={handleFileChange}
            />
            <span className="px-8 py-3.5 bg-sky-500 text-white rounded-xl shadow-lg shadow-sky-200 hover:bg-sky-600 transition-all inline-flex items-center font-bold text-lg">
              <Upload size={24} className="mr-2" />
              Open Document
            </span>
          </label>
        </div>
      );
    }

    switch (fileType) {
      case 'pdf':
        return (
          <div className="w-full h-full bg-sky-50 flex flex-col items-center overflow-auto py-8">
            <div className="bg-white shadow-2xl transition-all duration-200 origin-top ring-1 ring-black/5">
                <canvas ref={canvasRef} className="block" />
            </div>
          </div>
        );
      case 'image':
        return (
          <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-sky-50">
            <img src={fileUrl!} alt="Preview" className="max-w-full max-h-full object-contain shadow-lg rounded-lg border border-sky-100 bg-white" />
          </div>
        );
      case 'video':
        return (
            <div className="w-full h-full flex items-center justify-center overflow-auto p-4 bg-sky-50">
                <div className="relative w-full max-w-4xl shadow-2xl rounded-2xl overflow-hidden bg-black border border-sky-200">
                    <video 
                        src={fileUrl!} 
                        controls 
                        autoPlay 
                        className="w-full h-full object-contain max-h-[80vh]" 
                    />
                </div>
            </div>
        );
      case 'text':
        return (
          <div className="w-full h-full overflow-auto bg-sky-50 p-12 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-sky-100">
              <pre className="whitespace-pre-wrap font-mono text-sm text-sky-700 leading-relaxed">
                {textContent}
              </pre>
            </div>
          </div>
        );
      default:
        return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-white">
            <div className="w-24 h-24 bg-sky-50 rounded-2xl flex items-center justify-center mb-6 border border-sky-100 shadow-sm">
               <FileArchive size={48} className="text-sky-500" />
            </div>
            <h3 className="text-xl font-bold text-sky-700 mb-2">{fileObj?.name}</h3>
            <p className="text-sky-400 mb-6">
              Preview not available for <b>{fileObj?.name.split('.').pop()?.toUpperCase()}</b> files.
            </p>
            <a 
              href={fileUrl!} 
              download={fileObj?.name}
              className="inline-flex items-center px-6 py-3 bg-sky-500 text-white rounded-lg hover:bg-sky-600 shadow-md"
            >
              <Download size={20} className="mr-2" /> Download File
            </a>
          </div>
        );
    }
  };

  const getIcon = () => {
    switch(fileType) {
      case 'image': return <ImageIcon size={20} className="text-sky-500" />;
      case 'video': return <Video size={20} className="text-sky-500" />;
      case 'text': return <FileCode size={20} className="text-sky-500" />;
      default: return <FileText size={20} className="text-sky-500" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* TOOLBAR: White/Sky */}
      <div className="p-4 border-b border-sky-100 flex items-center justify-between bg-white flex-shrink-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft size={16} />}>
            Back
          </Button>
          <div className="h-6 w-px bg-sky-200"></div>
          <h2 className="text-lg font-bold text-sky-700 flex items-center gap-2 truncate max-w-[150px] sm:max-w-md">
            {getIcon()}
            {fileObj?.name || 'Secure Viewer'}
          </h2>
        </div>
        
        {/* PDF Controls */}
        {fileType === 'pdf' && numPages > 0 && (
            <div className="hidden sm:flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-100">
                <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition-colors disabled:opacity-30"><ChevronLeft size={18} /></button>
                <span className="text-sm font-mono font-medium text-sky-600 w-16 text-center">{pageNum} / {numPages}</span>
                <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition-colors disabled:opacity-30"><ChevronRight size={18} /></button>
                <div className="w-px h-5 bg-sky-300 mx-2"></div>
                <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition-colors"><ZoomOut size={16} /></button>
                <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1.5 text-sky-600 hover:text-sky-800 hover:bg-sky-100 rounded transition-colors"><ZoomIn size={16} /></button>
            </div>
        )}

        <label className="cursor-pointer">
            {/* Strictly hide inputs using inline styles */}
           <input 
             id="viewer-upload-header"
             type="file" 
             style={{ display: 'none' }}
             onChange={handleFileChange}
           />
           <div className="text-sm text-sky-500 font-bold hover:bg-sky-50 px-3 py-2 rounded-lg transition-colors flex items-center gap-2 border border-transparent hover:border-sky-100">
             <Upload size={18} />
             <span className="hidden sm:inline">Open New</span>
           </div>
         </label>
      </div>
      
      {/* Mobile PDF Controls Toolbar */}
      {fileType === 'pdf' && numPages > 0 && (
        <div className="sm:hidden flex items-center justify-between px-4 py-2 bg-white border-b border-sky-100">
             <div className="flex items-center gap-2">
                 <button onClick={() => setPageNum(p => Math.max(1, p - 1))} disabled={pageNum <= 1} className="p-1.5 bg-sky-50 rounded border border-sky-100 shadow-sm hover:bg-sky-50"><ChevronLeft size={16} className="text-sky-600" /></button>
                 <span className="text-xs font-mono font-medium text-sky-600">{pageNum} / {numPages}</span>
                 <button onClick={() => setPageNum(p => Math.min(numPages, p + 1))} disabled={pageNum >= numPages} className="p-1.5 bg-sky-50 rounded border border-sky-100 shadow-sm hover:bg-sky-50"><ChevronRight size={16} className="text-sky-600" /></button>
             </div>
             <div className="flex items-center gap-2">
                 <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} className="p-1.5 bg-sky-50 rounded border border-sky-100 shadow-sm hover:bg-sky-50"><ZoomOut size={16} className="text-sky-600" /></button>
                 <button onClick={() => setScale(s => Math.min(3.0, s + 0.1))} className="p-1.5 bg-sky-50 rounded border border-sky-100 shadow-sm hover:bg-sky-50"><ZoomIn size={16} className="text-sky-600" /></button>
             </div>
        </div>
      )}

      <div className="flex-1 bg-sky-50 relative overflow-hidden flex items-center justify-center">
        {renderContent()}
      </div>
    </div>
  );
};
