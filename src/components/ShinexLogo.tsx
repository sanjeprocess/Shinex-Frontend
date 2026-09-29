import React from 'react'

export default function ShinexLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src="/shinex_logo.png"
        alt="Shinex"
        className="h-8 w-auto object-contain"
        style={{ maxWidth: '100px' }}
      />
    </div>
  )
}
