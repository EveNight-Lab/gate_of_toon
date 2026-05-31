import React from 'react';
import { Webtoon } from '../types';

interface WebtoonListScreenProps {
  webtoons: Webtoon[];
  onBack: () => void;
}

const WebtoonListScreen: React.FC<WebtoonListScreenProps> = ({ webtoons, onBack }) => {
  const sortedWebtoons = [...webtoons].sort((a, b) => a.title.localeCompare(b.title, 'ko'));

  return (
    // 🚨 수정: 헤더와 리스트 컨테이너를 분리하여 z-index 문제를 근본적으로 해결합니다.
    <div className="flex flex-col max-h-[80vh] animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 flex justify-between items-center p-4 md:p-6 border-b-2 border-cyan-400/50">
        <h1 className="text-xl sm:text-2xl font-bold font-orbitron text-white">{'< WEBTOON DATABASE />'}</h1>
        <button onClick={onBack} className="system-button py-2 px-3 sm:px-4 text-sm sm:text-base">
          [ 메인으로 ]
        </button>
      </div>
      {/* List Content */}
      <div className="flex-grow overflow-y-auto p-4 md:p-6">
        <div className="flex flex-col gap-2">
        {sortedWebtoons.map((webtoon) => (
          <a
            key={webtoon.id}
            href={webtoon.url}
            target="_blank"
            rel="noopener noreferrer"
            className="system-button flex flex-wrap justify-between items-center text-left p-3"
          >
            <div className="flex-grow pr-4">
              <h2 className="text-md font-bold text-white">{webtoon.title}</h2>
              <p className="text-sm text-white/80 ">{webtoon.author}</p>
            </div>
            <div className="flex-shrink-0 flex flex-wrap gap-1 justify-end mt-2 sm:mt-0">
              {webtoon.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-xs bg-black/40 text-cyan-200 px-2 py-0.5">#{tag}</span>
              ))}
            </div>
          </a>
        ))}
      </div>
      </div>
    </div>
  );
};

export default React.memo(WebtoonListScreen);