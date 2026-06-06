import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

export const CombIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="2" y="12" width="20" height="5" rx="1"/>
    <line x1="5" y1="12" x2="5" y2="7"/>
    <line x1="8" y1="12" x2="8" y2="7"/>
    <line x1="11" y1="12" x2="11" y2="7"/>
    <line x1="14" y1="12" x2="14" y2="7"/>
    <line x1="17" y1="12" x2="17" y2="7"/>
    <line x1="20" y1="12" x2="20" y2="7"/>
  </svg>
);

export const RazorIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <rect x="3" y="9" width="18" height="7" rx="1.5"/>
    <path d="M9 9V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    <line x1="8" y1="12.5" x2="16" y2="12.5"/>
  </svg>
);

export const NailsIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M6 21V13a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v8"/>
    <line x1="4" y1="21" x2="20" y2="21"/>
    <rect x="7" y="5" width="2" height="4" rx="1"/>
    <rect x="11" y="3" width="2" height="6" rx="1"/>
    <rect x="15" y="5" width="2" height="4" rx="1"/>
  </svg>
);

export const WomanFaceIcon: React.FC<IconProps> = ({ size = 24, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="12" cy="13" r="7"/>
    <circle cx="9.5" cy="11.5" r="0.5" fill="currentColor" stroke="none"/>
    <circle cx="14.5" cy="11.5" r="0.5" fill="currentColor" stroke="none"/>
    <path d="M9 16a4 4 0 0 0 6 0"/>
    <path d="M7.5 6C9 4 15 4 16.5 6c1 1 1 2 0 3-2-2-8-2-9 0-1-1-1-2 0-3z"/>
    <line x1="12" y1="6" x2="12" y2="9"/>
  </svg>
);
