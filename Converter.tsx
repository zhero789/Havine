
import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import { ArrowLeft, Upload, Sparkles, FileText, CheckCircle, AlertCircle, X, Layers, Trash2, Loader2, SkipBack, SkipForward, Image as ImageIcon, Info, Grid, Zap, MonitorPlay, FileSpreadsheet, FileArchive, File as FileIcon, Download, ChevronDown, MoveHorizontal, Lock, Unlock, Maximize2, FolderOpen, Video, RefreshCw, Save } from 'lucide-react';
import { analyzeContent } from '../services/gemini';
import { upscaleTo4KLocal, getImageDimensions, resizeImageCustom } from '../services/imageProcessor';
import { generateUniversalExport } from '../utils/pdfGenerator';
import { AnalysisResult, MediaItem, FileType, ExportFormat } from '../types';
import { ComparisonSlider } from './ComparisonSlider';

interface ConverterProps {
  onBack: () => void;
}

export const Converter: React.FC<ConverterProps> = ({ onBack }) => {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [viewMode, setViewMode] = useState<'upload' | 'studio' | 'result'>('upload');
  
  // Studio State
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('PDF');
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  
  // Enhancement / Resize State
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [enhancedItems, setEnhancedItems] = useState<Record<string, string>>({}); 
  const [showComparison, setShowComparison] = useState(false);
  
  // Manual Resize State
  const [showResizeModal, setShowResizeModal] = useState(false);
  const [resizeDims, setResizeDims] = useState({ w: 0, h: 0 });
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [originalDims, setOriginalDims] = useState({ w: 0, h: 0 });

  const selectedItem = items.find(i => i.id === selectedItemId) || items[0];
  const enhancedVersion = selectedItemId ? enhancedItems[selectedItemId] : null;

  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CHANGED: Added video/* to accepted types
  const PHOTO_TYPES = "image/*,video/*";
  const FILE_TYPES = ".pdf,.doc,.docx,.txt,.rtf,.odt,.md,.xls,.xlsx,.csv,.zip,.rar,.7z,.epub,.mobi,.azw,.xml,.json,.log,.mp4,.webm,.ogg";

  useEffect(() => {
    if (items.length > 0 && !selectedItemId) {
      setSelectedItemId(items[0].id);
    }
  }, [items, selectedItemId]);

  useEffect(() => {
    if ((selectedItem?.type === FileType.IMAGE || selectedItem?.type === FileType.VIDEO) && (enhancedVersion || selectedItem.previewUrl)) {
      const url = enhancedVersion || selectedItem.previewUrl;
      getImageDimensions(url).then(dims => {
        setResizeDims({ w: dims.width, h: dims.height });
        setOriginalDims({ w: dims.width, h: dims.height });
        if (dims.height > 0) setAspectRatio(dims.width / dims.height);
      });
      
      if (enhancedVersion) {
         setShowComparison(true);
      } else {
         setShowComparison(false);
      }
    }
  }, [selectedItem, enhancedVersion]);

  const handleDimChange = (dimension: 'w' | 'h', value: string) => {
    const val = parseInt(value) || 0;
    if (dimension === 'w') {
      setResizeDims(prev => ({
        w: val,
        h: maintainAspect ? Math.round(val / aspectRatio) : prev.h
      }));
    } else {
       setResizeDims(prev => ({
        w: maintainAspect ? Math.round(val * aspectRatio) : prev.w,
        h: val
      }));
    }
  };

  const handleManualResize = async () => {
    if (!selectedItemId || !selectedItem) return;
    setIsUpscaling(true);
    try {
      const sourceUrl = enhancedVersion || selectedItem.previewUrl;
      const resizedUrl = await resizeImageCustom(sourceUrl, resizeDims.w, resizeDims.h);
      
      setEnhancedItems(prev => ({
        ...prev,
        [selectedItemId]: resizedUrl
      }));
      setShowComparison(true);
      setShowResizeModal(false); 
    } catch (e) {
      console.error("Resize error", e);
      setError("Failed to resize image.");
    } finally {
      setIsUpscaling(false);
    }
  };

  const handleDownloadItem = () => {
    if (!selectedItem) return;
    const url = enhancedVersion || selectedItem.previewUrl;
    if (!url) return;

    const link = document.createElement('a');
    link.href = url;
    
    let filename = selectedItem.file.name;
    if (enhancedVersion) {
        const parts = filename.split('.');
        const ext = parts.pop();
        filename = `${parts.join('.')}_edited.${ext || 'jpg'}`;
    }
    
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const determineFileType = (file: File): { type: FileType, ext: string } => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'tiff'].includes(ext)) return { type: FileType.IMAGE, ext };
    if (['mp4', 'webm', 'ogg', 'mov', 'avi'].includes(ext)) return { type: FileType.VIDEO, ext }; 
    if (['txt', 'md', 'csv', 'json', 'xml', 'log', 'rtf'].includes(ext)) return { type: FileType.TEXT, ext };
    if (['doc', 'docx', 'odt', 'pages', 'pdf'].includes(ext)) return { type: FileType.DOCUMENT, ext };
    if (['xls', 'xlsx', 'ods', 'numbers'].includes(ext)) return { type: FileType.SPREADSHEET, ext };
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { type: FileType.ARCHIVE, ext };
    
    return { type: FileType.UNKNOWN, ext };
  };

  const generateVideoThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      
      const fileUrl = URL.createObjectURL(file);
      video.src = fileUrl;

      video.onloadeddata = () => {
         video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                // Sky Blue overlay
                ctx.fillStyle = 'rgba(14, 165, 233, 0.3)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Play Button - White
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(canvas.width/2, canvas.height/2, Math.min(canvas.width, canvas.height) * 0.15, 0, Math.PI * 2);
                ctx.fill();
                // Arrow - Sky Blue
                ctx.fillStyle = '#0ea5e9';
                const s = Math.min(canvas.width, canvas.height) * 0.1; 
                ctx.beginPath();
                ctx.moveTo(canvas.width/2 - s/2, canvas.height/2 - s);
                ctx.lineTo(canvas.width/2 + s, canvas.height/2);
                ctx.lineTo(canvas.width/2 - s/2, canvas.height/2 + s);
                ctx.fill();

                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                URL.revokeObjectURL(fileUrl);
                resolve(dataUrl);
            } else {
                resolve('');
            }
        } catch (e) {
            console.error("Frame capture error", e);
            resolve('');
        }
      };
      
      video.onerror = () => {
          URL.revokeObjectURL(fileUrl);
          resolve('');
      };
    });
  };

  const processFile = async (file: File): Promise<MediaItem | null> => {
    return new Promise(async (resolve) => {
      const id = Math.random().toString(36).substr(2, 9);
      const { type, ext } = determineFileType(file);
      
      try {
        if (type === FileType.IMAGE) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id,
              file,
              previewUrl: e.target?.result as string,
              type,
              extension: ext
            });
          };
          reader.readAsDataURL(file);
        } else if (type === FileType.VIDEO) {
          const thumb = await generateVideoThumbnail(file);
          resolve({
             id,
             file,
             previewUrl: thumb,
             type: FileType.VIDEO,
             extension: ext
          });
        } else if (type === FileType.TEXT) {
          const reader = new FileReader();
          reader.onload = (e) => {
            resolve({
              id,
              file,
              previewUrl: '', 
              textContent: e.target?.result as string,
              type,
              extension: ext
            });
          };
          reader.readAsText(file);
        } else {
          resolve({
            id,
            file,
            previewUrl: '',
            type,
            extension: ext
          });
        }
      } catch (e) {
        console.error("Error processing file", file.name, e);
        resolve(null);
      }
    });
  };

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setIsProcessing(true);
    const files = Array.from(fileList);
    setUploadProgress({ current: 0, total: files.length });

    try {
      const newItems: MediaItem[] = [];
      const batchSize = 10;
      
      if (items.length + files.length > 300) {
         setError(`Batch limit reached. You can only add ${300 - items.length} more files (Max 300 total).`);
         setIsProcessing(false);
         return;
      }

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const processedBatch = await Promise.all(batch.map(processFile));
        processedBatch.forEach(item => {
          if (item) newItems.push(item);
        });
        
        setUploadProgress({ current: Math.min(i + batchSize, files.length), total: files.length });
        await new Promise(r => setTimeout(r, 10));
      }

      const allItems = [...items, ...newItems];
      setItems(allItems);
      if (!selectedItemId && newItems.length > 0) {
        setSelectedItemId(newItems[0].id);
      }
      setViewMode('studio');
    } catch (e) {
      setError("An error occurred while processing files.");
    } finally {
      setIsProcessing(false);
    }
  };

  const removeItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id);
    setItems(newItems);
    
    const newEnhanced = { ...enhancedItems };
    delete newEnhanced[id];
    setEnhancedItems(newEnhanced);

    if (newItems.length === 0) {
      setViewMode('upload');
    } else if (selectedItemId === id) {
      setSelectedItemId(newItems[0].id);
    }
  };

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === items.length - 1) return;

    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const handleExport = async () => {
    if (items.length === 0) return;
    setIsGenerating(true);
    setShowFormatMenu(false);

    try {
      const exportItems = items.map(item => ({
        ...item,
        previewUrl: enhancedItems[item.id] || item.previewUrl
      }));
      await generateUniversalExport(exportItems, exportFormat);
    } catch (e) {
      console.error(e);
      setError("Failed to generate export.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIAnalyze = async () => {
    if (items.length === 0) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const imageItems = items.filter(i => i.type === FileType.IMAGE);
      if (imageItems.length === 0) {
        throw new Error("Analysis requires at least one image.");
      }
      
      const analysis = await analyzeContent(imageItems);
      setResult(analysis);
      setViewMode('result');
    } catch (err: any) {
      setError(err.message || "Failed to analyze files.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpscale = async () => {
    if (!selectedItemId || !selectedItem || (selectedItem.type !== FileType.IMAGE && selectedItem.type !== FileType.VIDEO)) return;
    
    setIsUpscaling(true);
    setError(null);
    try {
      const upscaledData = await upscaleTo4KLocal(selectedItem.previewUrl);
      setEnhancedItems(prev => ({
        ...prev,
        [selectedItemId]: upscaledData
      }));
      setShowComparison(true);
    } catch (e: any) {
      console.error("Upscale failed", e);
      setError("Enhancement failed. Try a smaller image.");
    } finally {
      setIsUpscaling(false);
    }
  };

  // Uniform Sky Blue Icons
  const renderFileIcon = (item: MediaItem, size = 24) => {
    const iconClass = "text-sky-500";
    switch (item.type) {
      case FileType.IMAGE: return <ImageIcon size={size} className={iconClass} />;
      case FileType.VIDEO: return <Video size={size} className={iconClass} />;
      case FileType.TEXT: return <FileText size={size} className={iconClass} />;
      case FileType.SPREADSHEET: return <FileSpreadsheet size={size} className={iconClass} />;
      case FileType.DOCUMENT: return <FileIcon size={size} className={iconClass} />;
      case FileType.ARCHIVE: return <FileArchive size={size} className={iconClass} />;
      default: return <FileIcon size={size} className={iconClass} />;
    }
  };

  const renderMainPreview = () => {
    if (!selectedItem) return <div className="text-sky-300">Select an item</div>;

    if (selectedItem.type === FileType.IMAGE || selectedItem.type === FileType.VIDEO) {
      return (
        <div className="relative w-full h-full flex items-center justify-center p-4">
            {showComparison && enhancedVersion ? (
                <ComparisonSlider 
                    originalImage={selectedItem.previewUrl} 
                    enhancedImage={enhancedVersion} 
                />
            ) : (
                <div className="relative max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden border border-sky-100 bg-white">
                    <img 
                        src={enhancedVersion || selectedItem.previewUrl} 
                        className="max-w-full max-h-full object-contain" 
                        alt="" 
                    />
                    {selectedItem.type === FileType.VIDEO && !enhancedVersion && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="bg-white/80 rounded-full p-4 backdrop-blur-sm shadow-lg border border-sky-200">
                                <Video className="text-sky-500" size={48} />
                            </div>
                        </div>
                    )}
                </div>
            )}
            {!showComparison && enhancedVersion && (
                <div className="absolute top-6 right-6 bg-sky-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg border border-sky-400">
                  ENHANCED
                </div>
            )}
        </div>
      );
    }

    if (selectedItem.type === FileType.TEXT && selectedItem.textContent) {
      return (
        <div className="w-full h-full bg-white rounded-lg shadow-lg p-8 overflow-auto border border-sky-100 mx-4 my-4">
           <pre className="font-mono text-sm text-sky-800 whitespace-pre-wrap">
             {selectedItem.textContent}
           </pre>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
         {/* SKY ICON, WHITE/SKY BG */}
         <div className="w-32 h-32 bg-sky-50 rounded-full flex items-center justify-center mb-6 shadow-md border border-sky-100">
            {renderFileIcon(selectedItem, 64)}
         </div>
         <h3 className="text-2xl font-bold text-sky-600 mb-2">{selectedItem.file.name}</h3>
         <p className="text-sky-400 mb-6 uppercase tracking-widest text-sm font-semibold">{selectedItem.extension} FILE</p>
         <div className="bg-sky-50 text-sky-600 px-6 py-3 rounded-lg text-sm border border-sky-100 shadow-sm">
            Preview not available. File included in export.
         </div>
      </div>
    );
  };

  const renderUploadView = () => (
     <div 
      className={`
        flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl transition-colors m-8 bg-white
        ${isDragOver ? 'border-sky-500 bg-sky-50' : 'border-sky-200 hover:border-sky-500'}
      `}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragOver(false); handleFiles(e.dataTransfer.files); }}
    >
      {isProcessing ? (
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-sky-500 animate-spin mx-auto mb-6" />
          <h3 className="text-xl font-bold text-sky-600 mb-2">Processing Files...</h3>
          <p className="text-sky-400">
             {uploadProgress.total > 0 
               ? `Preparing ${uploadProgress.current} of ${uploadProgress.total} items` 
               : 'Analyzing content...'}
          </p>
          {uploadProgress.total > 0 && (
             <div className="w-64 h-2 bg-sky-100 rounded-full mt-6 mx-auto overflow-hidden">
                <div 
                  className="h-full bg-sky-500 transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                ></div>
             </div>
          )}
        </div>
      ) : (
        <>
          {/* UPLOAD ICON: Sky Icon, White/Sky BG */}
          <div className="w-24 h-24 bg-sky-50 text-sky-500 rounded-full flex items-center justify-center mb-8 shadow-md border border-sky-100">
            <Upload size={48} />
          </div>
          <h3 className="text-3xl font-bold text-sky-600 mb-3">Add Files to Studio</h3>
          <p className="text-sky-400 mb-10 text-center max-w-md font-medium">
            Drag & drop images, videos, or documents here.
            <br/><span className="text-xs text-sky-500 mt-2 block font-bold tracking-wide uppercase">(Supports up to 300 files)</span>
          </p>
          
          <div className="flex flex-col gap-4 w-full max-w-xs items-center">
            <input 
              ref={photoInputRef}
              type="file" 
              multiple
              accept={PHOTO_TYPES}
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />
            <input 
              ref={fileInputRef}
              type="file" 
              multiple
              accept={FILE_TYPES}
              style={{ display: 'none' }}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
            />

            <Button 
                onClick={() => photoInputRef.current?.click()}
                className="w-full py-4 text-lg justify-center shadow-lg shadow-sky-200 bg-sky-500 text-white hover:bg-sky-600"
                icon={<ImageIcon size={24} />}
            >
                Add Photos / Videos
            </Button>
            
            <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-sky-500 hover:text-sky-600 hover:bg-sky-50 text-sm font-bold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors border-2 border-transparent hover:border-sky-200"
            >
                <FolderOpen size={18} /> Add Documents
            </button>
          </div>
        </>
      )}
    </div>
  );

  const renderResizeModal = () => {
    if (!showResizeModal) return null;

    return (
      <div className="fixed inset-0 bg-sky-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 border border-sky-100">
          <div className="p-4 border-b border-sky-100 flex items-center justify-between bg-white">
             <div className="flex items-center gap-2">
                <MoveHorizontal className="text-sky-500" size={20} />
                <h3 className="font-bold text-sky-700">Custom Resize</h3>
             </div>
             <button onClick={() => setShowResizeModal(false)} className="text-sky-400 hover:text-sky-700 transition-colors">
                <X size={20} />
             </button>
          </div>
          
          <div className="p-6">
             <div className="flex justify-center mb-6">
                <div className="w-32 h-32 bg-sky-50 rounded-lg overflow-hidden border border-sky-100 shadow-inner">
                   <img src={enhancedVersion || selectedItem?.previewUrl} className="w-full h-full object-contain" alt="Preview"/>
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-xs font-bold text-sky-400 uppercase mb-1 block">Width (px)</label>
                  <input 
                    type="number" 
                    className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-lg font-mono text-sky-700 bg-white transition-colors"
                    value={resizeDims.w || ''}
                    onChange={(e) => handleDimChange('w', e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-sky-400 uppercase mb-1 block">Height (px)</label>
                  <input 
                    type="number" 
                    className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 outline-none text-lg font-mono text-sky-700 bg-white transition-colors"
                    value={resizeDims.h || ''}
                    onChange={(e) => handleDimChange('h', e.target.value)}
                  />
                </div>
             </div>

             <div className="flex items-center justify-between mb-8">
                <button 
                  onClick={() => setMaintainAspect(!maintainAspect)}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${maintainAspect ? 'text-sky-600' : 'text-sky-400'}`}
                >
                   {maintainAspect ? <Lock size={16} /> : <Unlock size={16} />}
                   {maintainAspect ? 'Ratio Locked' : 'Ratio Unlocked'}
                </button>
                
                <button 
                  onClick={() => setResizeDims(originalDims)}
                  className="text-sm text-sky-400 hover:text-sky-600 underline"
                >
                  Reset
                </button>
             </div>

             <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setShowResizeModal(false)}>
                   Cancel
                </Button>
                <Button 
                   variant="primary" 
                   className="flex-1" 
                   onClick={handleManualResize}
                   disabled={isUpscaling || (resizeDims.w === originalDims.w && resizeDims.h === originalDims.h)}
                   isLoading={isUpscaling}
                >
                  Apply
                </Button>
             </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStudioView = () => (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
      
      {/* TOOLBAR: White/Sky */}
      <div className="bg-white border-b border-sky-100 h-16 flex items-center justify-between px-6 flex-shrink-0 z-20 shadow-sm">
         <div className="flex items-center gap-4 text-sm text-sky-400">
             <div className="flex items-center gap-2 text-sky-600 font-medium">
               <Layers size={18} className="text-sky-600" /> 
               {items.length} Files
             </div>
             {Object.keys(enhancedItems).length > 0 && (
                <div className="flex items-center gap-1.5 text-sky-600 bg-sky-50 px-3 py-1 rounded-full text-xs font-bold border border-sky-200">
                  <Zap size={12} fill="currentColor" />
                  {Object.keys(enhancedItems).length} EDITED
                </div>
             )}
         </div>
         <div className="flex items-center gap-3">
             <input 
                ref={photoInputRef}
                type="file" 
                multiple
                accept={PHOTO_TYPES}
                style={{ display: 'none' }}
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />
              <input 
                ref={fileInputRef}
                type="file" 
                multiple
                accept={FILE_TYPES}
                style={{ display: 'none' }}
                onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
              />

            <button 
              onClick={() => photoInputRef.current?.click()}
              disabled={isProcessing}
              className="text-sm font-bold text-sky-600 hover:bg-sky-50 border border-sky-200 px-4 py-2 rounded-lg transition-colors flex items-center shadow-sm"
            >
              {isProcessing ? <Loader2 size={16} className="animate-spin mr-2"/> : <ImageIcon size={16} className="mr-2" />} 
              + Media
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="text-sm font-bold text-sky-500 hover:bg-sky-50 border border-sky-200 px-4 py-2 rounded-lg transition-colors flex items-center shadow-sm"
            >
              <FolderOpen size={16} className="mr-2" /> 
              + Files
            </button>
         </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
         
         <div className="w-72 bg-white border-r border-sky-100 flex flex-col flex-shrink-0">
            <div className="p-4 border-b border-sky-100 bg-white text-xs font-bold text-sky-400 uppercase tracking-wider flex justify-between items-center">
              <span>Collection</span>
              <Grid size={14} />
            </div>
            <div className="flex-1 overflow-y-auto studio-scroll p-3 space-y-2 bg-white">
               {items.map((item, index) => (
                 <div 
                   key={item.id}
                   onClick={() => setSelectedItemId(item.id)}
                   className={`
                     group relative flex items-start p-2 rounded-xl cursor-pointer transition-all border
                     ${selectedItemId === item.id 
                       ? 'bg-sky-50 border-sky-200 ring-1 ring-sky-100 shadow-sm' 
                       : 'bg-transparent border-transparent hover:bg-sky-50 hover:border-sky-100'}
                   `}
                 >
                    {/* LIST ICON: Sky Icon, White/Sky BG */}
                    <div className="w-12 h-12 bg-sky-50 rounded-lg overflow-hidden flex-shrink-0 relative border border-sky-100 flex items-center justify-center shadow-sm">
                       {item.type === FileType.IMAGE || item.type === FileType.VIDEO ? (
                         <img src={item.previewUrl} className="w-full h-full object-cover" alt="" />
                       ) : (
                         renderFileIcon(item, 20)
                       )}
                       
                       {enhancedItems[item.id] && (
                         <div className="absolute top-0 right-0 bg-sky-500 w-3 h-3 rounded-bl-lg z-10"></div>
                       )}
                    </div>
                    <div className="ml-3 flex-1 min-w-0">
                       <div className={`text-xs font-semibold truncate mb-0.5 ${selectedItemId === item.id ? 'text-sky-700' : 'text-sky-600'}`}>
                          {item.file.name}
                       </div>
                       <div className="text-[10px] text-sky-400 flex items-center gap-2">
                          <span className="bg-sky-50 px-1.5 py-0.5 rounded text-sky-500 font-mono">{index + 1}</span>
                          <span className="uppercase tracking-wider font-bold text-sky-300">{item.extension}</span>
                       </div>
                    </div>
                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 bg-white shadow-lg rounded-md border border-sky-100 z-20">
                       <button onClick={(e) => { e.stopPropagation(); moveItem(index, 'up') }} disabled={index===0} className="p-1.5 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30 rounded-t-md text-sky-400"><SkipBack size={12} className="rotate-90" /></button>
                       <button onClick={(e) => { e.stopPropagation(); removeItem(item.id) }} className="p-1.5 hover:bg-red-50 hover:text-red-600 text-sky-400"><Trash2 size={12} /></button>
                       <button onClick={(e) => { e.stopPropagation(); moveItem(index, 'down') }} disabled={index===items.length-1} className="p-1.5 hover:bg-sky-50 hover:text-sky-600 disabled:opacity-30 rounded-b-md text-sky-400"><SkipForward size={12} className="rotate-90" /></button>
                    </div>
                 </div>
               ))}
            </div>
         </div>

         <div className="flex-1 bg-white flex flex-col relative overflow-hidden">
            <div className="flex-1 flex items-center justify-center p-8 overflow-hidden bg-sky-50/50">
               {renderMainPreview()}
            </div>
            
            {(selectedItem?.type === FileType.IMAGE || selectedItem?.type === FileType.VIDEO) && enhancedVersion && (
               <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/90 backdrop-blur-md rounded-full px-5 py-2.5 shadow-xl flex gap-6 border border-sky-200 z-10">
                  <button 
                    onClick={() => setShowComparison(true)}
                    className={`text-xs font-bold flex items-center gap-2 ${showComparison ? 'text-sky-500' : 'text-sky-400 hover:text-sky-500'}`}
                  >
                    <MonitorPlay size={16} /> Compare
                  </button>
                  <div className="w-px bg-sky-200"></div>
                  <button 
                    onClick={() => setShowComparison(false)}
                    className={`text-xs font-bold flex items-center gap-2 ${!showComparison ? 'text-sky-500' : 'text-sky-400 hover:text-sky-500'}`}
                  >
                    <ImageIcon size={16} /> View Final
                  </button>
               </div>
            )}
         </div>

         <div className="w-80 bg-white border-l border-sky-100 flex flex-col flex-shrink-0">
             <div className="p-4 border-b border-sky-100 bg-white text-xs font-bold text-sky-400 uppercase tracking-wider flex items-center gap-2">
               <Info size={14} /> Properties & Tools
             </div>
             <div className="p-5 space-y-8 flex-1 overflow-y-auto studio-scroll">
                {selectedItem ? (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-bold text-sky-400 block mb-1 uppercase">Filename</label>
                        <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-sky-700 break-all leading-tight flex-1">{selectedItem.file.name}</div>
                            {/* DOWNLOAD BUTTON */}
                            <button 
                              onClick={handleDownloadItem} 
                              className="text-sky-400 hover:text-sky-600 p-1.5 rounded-md hover:bg-sky-50 transition-colors"
                              title="Download this file"
                            >
                               <Save size={16} />
                            </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-sky-400 block mb-1 uppercase">Details</label>
                        <div className="flex items-center gap-2">
                           <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-sky-50 text-xs text-sky-500 font-mono border border-sky-200">
                             {(selectedItem.file.size / 1024).toFixed(1)} KB
                           </div>
                           <div className="inline-flex items-center px-2.5 py-1 rounded-md bg-sky-50 text-xs text-sky-500 font-bold uppercase border border-sky-200">
                             {selectedItem.extension}
                           </div>
                        </div>
                      </div>
                    </div>
                    
                    {(selectedItem.type === FileType.IMAGE || selectedItem.type === FileType.VIDEO) && (
                      <div className="space-y-4 pt-4 border-t border-sky-100">
                        <label className="text-xs font-bold text-sky-600 uppercase block">Enhancements</label>
                        
                        <div className="p-4 bg-sky-50/50 rounded-xl border border-sky-100 shadow-sm">
                           <div className="flex items-center gap-2 mb-2">
                              <Zap size={16} className="text-sky-500" fill="currentColor" />
                              <span className="text-sm font-bold text-sky-700">4K Upscale</span>
                           </div>
                           <p className="text-xs text-sky-400 mb-4 leading-snug">
                             Boost resolution to 3840px using local AI.
                           </p>
                           <Button 
                             variant="primary" 
                             size="sm" 
                             className="w-full"
                             onClick={handleUpscale}
                             isLoading={isUpscaling}
                             disabled={isUpscaling}
                           >
                             Run Upscaler
                           </Button>
                        </div>

                        <div className="p-4 bg-white rounded-xl border border-sky-100">
                           <div className="flex items-center gap-2 mb-2">
                              <MoveHorizontal size={16} className="text-sky-500" />
                              <span className="text-sm font-bold text-sky-700">Resize</span>
                           </div>
                           <p className="text-xs text-sky-400 mb-4">
                             {originalDims.w} x {originalDims.h} px
                           </p>
                           <Button 
                             variant="secondary"
                             size="sm" 
                             className="w-full"
                             onClick={() => setShowResizeModal(true)}
                           >
                             <Maximize2 size={14} className="mr-2" /> Custom Dimensions
                           </Button>
                        </div>

                      </div>
                    )}
                    
                    {enhancedItems[selectedItem.id] && (
                       <Button 
                         variant="outline" 
                         size="sm" 
                         className="w-full border-dashed border-sky-300 text-sky-500 hover:text-sky-600"
                         onClick={() => {
                           const newEnhanced = {...enhancedItems};
                           delete newEnhanced[selectedItem.id];
                           setEnhancedItems(newEnhanced);
                           setResizeDims(originalDims);
                         }}
                       >
                         <RefreshCw size={14} className="mr-2" /> Reset Changes
                       </Button>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-sky-400">
                    <Info size={32} className="mb-2" />
                    <p className="text-sm">No Item Selected</p>
                  </div>
                )}
             </div>
             
             <div className="p-5 border-t border-sky-100 bg-white space-y-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="relative">
                   <button 
                     onClick={() => setShowFormatMenu(!showFormatMenu)}
                     className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-sky-200 rounded-lg text-sm font-medium text-sky-600 hover:bg-sky-50 transition-all mb-3 shadow-sm"
                   >
                      <span className="flex items-center">
                         <span className="text-sky-400 mr-2 text-xs uppercase font-bold">Format</span> 
                         {exportFormat}
                      </span>
                      <ChevronDown size={16} className="text-sky-400" />
                   </button>
                   
                   {showFormatMenu && (
                     <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-sky-100 rounded-xl shadow-xl z-50 overflow-hidden py-1">
                        {(['PDF', 'DOCX', 'TXT', 'ZIP'] as ExportFormat[]).map(format => (
                           <button 
                             key={format}
                             className={`w-full text-left px-4 py-2 text-sm hover:bg-sky-50 hover:text-sky-600 transition-colors ${exportFormat === format ? 'bg-sky-50 text-sky-700 font-bold' : 'text-sky-500'}`}
                             onClick={() => { setExportFormat(format); setShowFormatMenu(false); }}
                           >
                             {format}
                           </button>
                        ))}
                     </div>
                   )}

                   <Button 
                       variant="primary" 
                       className="w-full justify-center py-3 text-base"
                       onClick={handleExport} 
                       isLoading={isGenerating}
                       disabled={isGenerating || items.length === 0}
                   >
                     <Download size={18} className="mr-2" />
                     Export Files
                   </Button>
                </div>
                
                {items.some(i => i.type === FileType.IMAGE) && (
                  <Button 
                     variant="secondary" 
                     className="w-full justify-center"
                     onClick={handleAIAnalyze} 
                     disabled={isAnalyzing || isGenerating || items.length === 0}
                     isLoading={isAnalyzing}
                  >
                     <Sparkles size={16} className="mr-2" /> 
                     Generate AI Summary
                  </Button>
                )}
             </div>
         </div>

      </div>
      {renderResizeModal()}
    </div>
  );

  const renderResultView = () => (
     <div className="flex-1 overflow-y-auto p-6 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-sky-100 rounded-2xl shadow-xl p-10">
                {/* TOOLBAR: White/Sky */}
                <div className="flex items-center justify-between mb-10 pb-6 border-b border-sky-50">
                  <div>
                    <div className="flex items-center gap-2 text-sky-500 mb-2">
                        <Sparkles size={20} />
                        <span className="text-xs font-bold uppercase tracking-wider">AI Insight Report</span>
                    </div>
                    <h2 className="text-3xl font-bold text-sky-800">Analysis Results</h2>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setViewMode('studio')}>
                       Back to Studio
                    </Button>
                    <Button onClick={() => {
                        if (result && items.length > 0) {
                          const combinedContent = `SUMMARY\n\n${result.summary}\n\nKEY POINTS\n\n${result.keyPoints.map(p => `• ${p}`).join('\n')}\n\nDETAILED REPORT\n\n${result.content}`;
                          generateUniversalExport([{
                            id: 'report',
                            file: new File([""], "report"),
                            previewUrl: enhancedItems[items[0].id] || items[0].previewUrl,
                            type: FileType.IMAGE,
                            extension: 'jpg'
                          } as MediaItem], 'PDF'); 
                        }
                    }} icon={<FileText size={18} />}>
                      Download PDF
                    </Button>
                  </div>
                </div>

                {result && (
                  <div className="prose max-w-none text-sky-600 space-y-8">
                    <div>
                      <h3 className="text-4xl font-bold text-sky-800 font-serif mb-2">{result.title}</h3>
                      <div className="h-1 w-20 bg-sky-500 rounded-full"></div>
                    </div>

                    <div className="bg-sky-50 rounded-2xl p-8 border border-sky-100">
                      <label className="block text-xs font-bold text-sky-700 uppercase tracking-widest mb-4">
                          Executive Summary
                      </label>
                      <p className="text-sky-800 leading-relaxed text-lg font-light">{result.summary}</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Key Findings</label>
                      <ul className="grid gap-4 sm:grid-cols-2">
                        {result.keyPoints.map((point, i) => (
                          <li key={i} className="flex items-start bg-white p-4 rounded-xl border border-sky-100 shadow-sm">
                            <CheckCircle size={20} className="text-sky-500 mr-3 mt-0.5 flex-shrink-0" />
                            <span className="text-sky-700 font-medium">{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-sky-400 uppercase tracking-widest mb-4">Full Report</label>
                      <div className="whitespace-pre-wrap leading-loose text-sky-600 font-serif text-lg pl-6 border-l-4 border-sky-200">
                        {result.content}
                      </div>
                    </div>
                  </div>
                )}
          </div>
        </div>
     </div>
  );

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {viewMode !== 'studio' && (
        // TOOLBAR: White/Sky
        <div className="p-4 border-b border-sky-100 flex items-center justify-between bg-white z-20 shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={onBack} icon={<ArrowLeft size={16} />}>
              Home
            </Button>
            <div className="h-6 w-px bg-sky-200"></div>
            <h2 className="text-lg font-bold text-sky-700 flex items-center gap-2">
              <Sparkles className="text-sky-500" size={20} />
              {viewMode === 'upload' && 'Start Conversion'}
              {viewMode === 'result' && 'Report Preview'}
            </h2>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex flex-col overflow-hidden bg-white">
         {error && (
            <div className="absolute top-6 left-0 right-0 z-50 flex justify-center px-4">
              <div className="bg-white text-red-600 px-4 py-3 rounded-lg text-sm flex items-center shadow-lg border border-red-100 max-w-lg w-full animate-in slide-in-from-top-4">
                <AlertCircle size={18} className="mr-3 flex-shrink-0" />
                <span className="flex-1 font-medium">{error}</span>
                <button onClick={() => setError(null)} className="ml-3 hover:text-slate-900"><X size={16} /></button>
              </div>
            </div>
         )}
         
         {viewMode === 'upload' && renderUploadView()}
         {viewMode === 'studio' && renderStudioView()}
         {viewMode === 'result' && renderResultView()}
      </div>
    </div>
  );
};
