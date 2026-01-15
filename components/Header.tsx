import React from 'react';

export const Header: React.FC = () => {
  return (
    <div className="h-16 bg-gradient-to-r from-purple-950 to-dark-bg flex items-center px-6 border-b border-purple-900 shrink-0">
       <div className="flex items-center gap-4">
         <svg width="40" height="40" viewBox="0 0 100 100" className="text-lavender-100 fill-current">
            {/* Letter K stylized as a cat */}
            <path d="M 20 10 L 20 90 L 35 90 L 35 60 L 60 90 L 80 90 L 50 50 L 80 10 L 60 10 L 35 40 L 35 30 L 35 10 Z" />
            <path d="M 20 10 Q 10 5 15 20 Z" /> {/* Ear */}
            <path d="M 35 90 Q 50 100 60 85" fill="none" stroke="currentColor" strokeWidth="3" /> {/* Tail hint */}
         </svg>
         <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Katje JSON Schemes</h1>
            <p className="text-xs text-purple-300 uppercase tracking-widest">Knowledge And Technology Joyfully Engaged</p>
         </div>
       </div>
    </div>
  );
};