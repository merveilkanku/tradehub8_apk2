
import React from 'react';

interface LogoProps {
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "h-10 w-auto", showText = true }) => {
  return (
    <div className={`flex items-center gap-3 select-none transition-all duration-300 ease-out hover:scale-110 hover:drop-shadow-[0_0_15px_rgba(124,58,237,0.6)] cursor-pointer group ${className}`}>
      {/* Reproduction vectorielle du logo géométrique */}
      <svg viewBox="0 0 100 100" className="h-full w-auto aspect-square overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Partie Jaune (Gauche) - Formes abstraites */}
        <path d="M 0 0 L 45 0 L 45 45 L 0 0 Z" fill="#fbbf24" className="transition-transform duration-500 group-hover:-translate-x-1 group-hover:-translate-y-1" />
        <path d="M 0 100 L 45 100 L 45 55 L 0 100 Z" fill="#fbbf24" className="transition-transform duration-500 group-hover:-translate-x-1 group-hover:translate-y-1" />
        
        {/* Partie Violette (Droite) - Chevron stylisé */}
        <path d="M 45 0 L 100 50 L 45 100 L 70 50 Z" fill="#7c3aed" style={{filter: 'url(#glow)'}} className="transition-transform duration-500 group-hover:translate-x-1" />
        
        {/* Accent de profondeur */}
        <path d="M 45 0 L 70 50 L 45 100 L 35 50 Z" fill="#5b21b6" opacity="0.3" className="transition-transform duration-500 group-hover:translate-x-1" />
      </svg>
      
      {showText && (
        <div className="flex flex-col justify-center">
          <h1 className="font-orbitron font-black text-2xl tracking-tighter leading-none text-[#5b21b6] dark:text-[#8b5cf6] transition-colors group-hover:text-[#7c3aed]">
            Trade<span className="text-[#fbbf24]">Hub</span>
          </h1>
        </div>
      )}
    </div>
  );
};
