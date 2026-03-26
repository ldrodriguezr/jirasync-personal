import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({ label, error, className = '', id, ...props }: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...props}
        className={`w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 bg-white
          placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400 ${error ? 'border-red-400' : ''} ${className}`}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function Textarea({ label, className = '', id, ...props }: TextareaProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...props}
        className={`w-full rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 bg-white
          placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
          resize-y min-h-[80px] ${className}`}
      />
    </div>
  );
}
