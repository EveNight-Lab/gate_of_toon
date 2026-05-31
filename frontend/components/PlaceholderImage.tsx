
import React from 'react';

interface PlaceholderImageProps {
  text: string;
  className?: string;
  backgroundColor?: string;
  showUpdateNotice?: boolean;
}

const PlaceholderImage: React.FC<PlaceholderImageProps> = ({ text, className, backgroundColor, showUpdateNotice = false }) => {
  return (
    <div 
      className={`w-full h-full flex items-center justify-center text-center p-2 overflow-hidden border border-cyan-900/50 ${!backgroundColor ? 'bg-black/40' : ''} ${className}`}
      style={{ backgroundColor }}
    >
      <div className="flex flex-col items-center">
        <span className="text-cyan-400/90 font-semibold text-sm md:text-base">{text}</span>
        {showUpdateNotice && <span className="text-cyan-600/80 text-xs mt-1">(업데이트 예정)</span>}
      </div>
    </div>
  );
};

export default PlaceholderImage;
