
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { MoveHorizontal } from 'lucide-react';

interface ComparisonSliderProps {
  originalImage: string;
  enhancedImage: string;
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({ originalImage, enhancedImage }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isResizing, setIsResizing] = useState(false);

  // Measure container width to ensure inner image matches outer image dimensions
  useLayoutEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    
    // Use ResizeObserver for robust width tracking
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    window.addEventListener('resize', updateWidth);
    return () => {
      window.removeEventListener('resize', updateWidth);
      observer.disconnect();
    };
  }, []);

  const handleMouseDown = () => setIsResizing(true);
  const handleMouseUp = () => setIsResizing(false);

  const handleMove = (clientX: number) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isResizing) handleMove(e.clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleMouseUp);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden bg-white rounded-lg cursor-col-resize group touch-none border border-sky-200"
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      {/* Layer 1: Enhanced (Background) - "New 4K" */}
      <div 
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          backgroundImage: `url(${enhancedImage})`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Label for Enhanced */}
      <div className="absolute top-4 right-4 bg-sky-500 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full shadow-lg z-10 pointer-events-none border border-sky-400">
        NEW 4K QUALITY
      </div>

      {/* Layer 2: Original (Foreground - Clipped) - "Old" */}
      <div 
        className="absolute top-0 bottom-0 left-0 overflow-hidden border-r-2 border-white shadow-2xl z-20"
        style={{ width: `${sliderPosition}%` }}
      >
        <div 
          className="h-full pointer-events-none"
          style={{ 
            width: containerWidth > 0 ? `${containerWidth}px` : '100vw',
            backgroundImage: `url(${originalImage})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <div className="absolute inset-0 bg-sky-900/10 pointer-events-none"></div>
      </div>

       {/* Label for Original */}
       <div 
         className="absolute top-4 left-4 bg-white text-sky-800 text-[10px] md:text-xs font-bold px-3 py-1 rounded-full shadow-lg z-30 pointer-events-none border border-sky-100"
         style={{ opacity: sliderPosition > 15 ? 1 : 0 }}
        >
        OLD QUALITY
      </div>

      {/* Slider Handle */}
      <div 
        className="absolute top-0 bottom-0 w-1 bg-transparent cursor-col-resize z-40 flex items-center justify-center"
        style={{ left: `${sliderPosition}%` }}
      >
        <div className={`
            w-8 h-8 -ml-4 bg-white rounded-full shadow-lg flex items-center justify-center text-sky-500 border border-sky-200
            transition-transform duration-200 ease-out
            ${isResizing ? 'scale-110 ring-4 ring-sky-200' : 'scale-100 hover:scale-110'}
        `}>
            <MoveHorizontal size={16} />
        </div>
      </div>
    </div>
  );
};
