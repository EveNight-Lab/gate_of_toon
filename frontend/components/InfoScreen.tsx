import React from 'react';

interface InfoScreenProps {
  title: string;
  content: string;
  onBack: () => void;
}

const InfoScreen: React.FC<InfoScreenProps> = ({ title, content, onBack }) => {
  // content 문자열을 줄바꿈 기준으로 분리하여 각 줄을 <p> 태그로 렌더링합니다.
  const contentLines = content.trim().split('\n').map((line, index) => {
    const trimmedLine = line.trim();
    if (trimmedLine === '') {
      return <br key={index} />;
    }
    // 🚨 수정: 특정 제목 스타일을 중앙 정렬하고 강조합니다.
    if (trimmedLine.startsWith('【') || trimmedLine.startsWith('\'게이트 오브 툰\'')) {
      return <p key={index} className="text-center font-bold text-lg mb-4 text-cyan-300">{trimmedLine}</p>;
    }
    if (trimmedLine.startsWith('게이트 오브 툰은')) {
      return <p key={index} className="text-center text-sm text-white/80 mb-6">{trimmedLine}</p>;
    }
    return <p key={index} className="mb-2 last:mb-0">{trimmedLine}</p>;
  });

  return (
    // 🚨 수정: 헤더와 리스트 컨테이너를 분리하여 z-index 문제를 근본적으로 해결합니다.
    <div className="flex flex-col max-h-[80vh] animate-fade-in">
      {/* Header */}
      <div className="flex-shrink-0 flex justify-between items-center p-4 md:p-6 border-b-2 border-cyan-400/50 bg-gray-950/80 backdrop-blur-sm">
        <h1 className="text-lg sm:text-xl font-bold font-orbitron text-white">{`< ${title} />`}</h1>
        <button onClick={onBack} className="system-button py-2 px-3 sm:text-base">
          [ 뒤로가기 ]
        </button>
      </div>
      {/* Content */}
      <div className="flex-grow overflow-y-auto p-4 md:p-6">
        <div className="text-white leading-relaxed whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
          {contentLines}
        </div>
      </div>
    </div>
  );
};

export default React.memo(InfoScreen);