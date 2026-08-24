import React from 'react'

export default function ShinexLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M20 2C10.06 2 2 10.06 2 20s8.06 18 18 18 18-8.06 18-18S29.94 2 20 2zm0 4c3.5 0 6.7 1.2 9.24 3.2-1.4 2.2-4.1 3.6-7.24 3.6-4.6 0-8.4-3-9.6-7.1C14.4 4.6 17.1 4 20 4v2zm-9.2 5.9c1.7 4.6 6.1 7.9 11.2 7.9 3.7 0 7-1.7 9.2-4.4.6 1.4.9 3 .9 4.6 0 1.9-.4 3.6-1.2 5.2-2.1-2.6-5.3-4.3-8.9-4.3-5.4 0-9.9 3.7-11.2 8.7C9 27.4 8 23.8 8 20c0-3.7 1-7.2 2.8-10.1zm2.2 19.8c1.4-4 5.2-6.9 9.7-6.9 3 0 5.7 1.3 7.6 3.4C27.6 31.4 24 33.4 20 33.4c-3.1 0-6-1.2-8.1-3.2-.3-.3-.6-.6-.9-.9v.4z"
          fill="currentColor"
        />
      </svg>
      <span className="font-semibold text-lg tracking-tight" style={{ color: "#2F6F5E" }}>
        Shinex
      </span>
    </div>
  );
}
