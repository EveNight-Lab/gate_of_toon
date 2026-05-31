import React, { useState, useEffect, useRef } from 'react';

interface NicknameInputProps {
  question: string;
  message: string;
  onSubmit: (nickname: string) => void;
  isLoading: boolean;
}

const NicknameInput: React.FC<NicknameInputProps> = ({ question, message, onSubmit, isLoading }) => {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && !isLoading) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-8 text-center min-h-[60vh] text-white animate-fade-in">
      <div className="system-panel w-full max-w-sm">
        <p className="text-gray-300 italic mb-4 text-md sm:text-base">&gt; {message}</p>
        <div className="title-line my-4"></div>
        <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-relaxed mb-6">{question}</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input ref={inputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="[ 닉네임 입력 ]" className="w-full system-input" required disabled={isLoading} />
          <button type="submit" className="w-full system-button" disabled={isLoading}>[ 확인 ]</button>
        </form>
      </div>
    </div>
  );
};

export default NicknameInput;