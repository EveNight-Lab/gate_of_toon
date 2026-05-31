

import React, { useState, useEffect, useCallback } from 'react';
import { Webtoon } from '../types';
import html2canvas from 'html2canvas';
import PlaceholderImage from './PlaceholderImage';

const useTypingEffect = (text: string, speed = 30, onComplete?: () => void) => {
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      onComplete?.();
      return;
    }
    
    // 🚨 핵심 수정: setInterval 대신 재귀적인 setTimeout을 사용하여 React 렌더링과 충돌을 피합니다.
    let currentIndex = 0;
    setDisplayText('');

    const typeCharacter = () => {
      if (currentIndex < text.length) {
        setDisplayText(prev => prev + text.charAt(currentIndex));
        currentIndex++;
        setTimeout(typeCharacter, speed);
      } else {
        // 🚨 추가: 애니메이션 완료 후, 최종 텍스트가 원본과 일치하도록 강제로 설정합니다.
        // 이는 혹시 모를 누락을 방지하는 안전 장치입니다.
        setDisplayText(text);
        onComplete?.();
      }
    };

    typeCharacter();
  }, [text, speed, onComplete]);

  return displayText;
};

const Counter: React.FC<{ end: number }> = ({ end }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const duration = 2000;
    
    if (end === 0) return;
    const stepTime = Math.max(1, Math.floor(duration / end));

    const timer = setInterval(() => {
      start += Math.max(1, Math.ceil(end / (duration / stepTime)));
      if (start > end) start = end;
      setCount(start);
      if (start === end) {
        clearInterval(timer);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [end]);

  return <span className="font-black text-4xl sm:text-5xl text-purple-400 font-orbitron">{count.toLocaleString()}</span>;
};


const ResultScreen: React.FC<{
  userName: string;
  webtoon: Webtoon;
  recommendationText: string;
  onRestart: () => void;
  onShowList: () => void;
}> = ({ userName, webtoon, recommendationText, onRestart, onShowList }) => {
  const [startTyping, setStartTyping] = useState(false);
  const [typingCompleted, setTypingCompleted] = useState(false);
  const [displayLifeCount, setDisplayLifeCount] = useState((webtoon.lifeCount || 1) - 1);

  const handleTypingComplete = useCallback(() => {
    setTypingCompleted(true);
    // 타이핑이 끝나면 실제 lifeCount로 상태를 업데이트하여 카운터 애니메이션을 다시 트리거합니다.
    setTimeout(() => {
      setDisplayLifeCount(webtoon.lifeCount);
    }, 300); // 약간의 딜레이 후 카운트업 시작
  }, [webtoon.lifeCount]);

  const typedRecommendation = useTypingEffect(startTyping ? recommendationText : '', 30, handleTypingComplete);

  // 🚨 복원: 결과 카드 이미지로 저장하는 함수
  const handleSaveImage = useCallback(() => {
    const elementToCapture = document.getElementById('result-card');
    if (elementToCapture) {
      html2canvas(elementToCapture, {
        backgroundColor: '#030712', // 배경색을 어둡게 설정
        useCORS: true,
      }).then(canvas => {
        const link = document.createElement('a');
        link.download = `게이트오브툰_추천결과_${webtoon.title}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    }
  }, [webtoon.title]);

  // 🚨 복원: 테스트 링크 공유하기 함수 (Web Share API 사용)
  const handleShare = useCallback(async () => {
    const shareData = {
      title: '게이트 오브 툰: AI 웹툰 추천',
      text: `${userName}님에게 AI가 추천하는 인생 웹툰은? 지금 바로 확인해보세요!`,
      url: window.location.origin, // 사이트의 기본 주소를 공유합니다.
    };
    try {
      await navigator.share(shareData);
    } catch (err) {
      console.error('Share failed:', err);
    }
  }, [userName]);

  useEffect(() => {
    const timer = setTimeout(() => {
        setStartTyping(true);
    }, 1000); // Start typing after the box has revealed
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="p-4 md:p-6 flex flex-col items-center text-center">
      <div className="reveal">
        <h2 className="font-orbitron text-lg text-cyan-200 tracking-widest">[ 최종 분석 완료 ]</h2>
        <div className="title-line my-2"></div>
        <p className="text-white mt-2 mb-6">{userName}님을 위한 분석 결과입니다.</p>
      </div>
      
      <div id="result-card" className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-5 gap-6 system-panel reveal delay-200 p-4 md:p-6">
        {/* 🚨 수정: 썸네일 공간을 줄이고 정보 영역을 넓혔습니다. */}
        <div className="md:col-span-1 flex items-center justify-center">
          <div className="p-1 border-2 border-purple-500/50 w-full" style={{aspectRatio: '3 / 4'}}>
            <PlaceholderImage text={webtoon.title} showUpdateNotice={true} />
          </div>
        </div>
        
        {/* Right side: Info */}
        <div className="md:col-span-4 text-left flex flex-col justify-center">
          <div className="reveal delay-400">
            <div className="mb-4">
              <p className="font-orbitron text-sm text-cyan-300">TITLE</p>
              <h1 className="text-2xl sm:text-3xl font-black">{webtoon.title}</h1>
            </div>
            <div className="mb-6">
              <p className="font-orbitron text-sm text-cyan-300">AUTHOR</p>
              <p className="text-white text-lg">{webtoon.author}</p>
            </div>
          </div>
          <div className="p-4 bg-black/30 border-l-2 border-cyan-500 reveal delay-600">
            <p className="font-orbitron text-sm text-cyan-300">SYSTEM ANALYSIS</p>
            <p className="text-white leading-relaxed italic mt-2">
              "{typedRecommendation}"
              {!startTyping ? '' : <span className="typing-cursor"></span>}
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-4xl mt-6 reveal delay-800">
        <a
          href={webtoon.url}
          target="_blank"
          rel="noopener noreferrer"
          className="system-button w-full max-w-md mx-auto block text-center bg-cyan-600/20 hover:bg-cyan-500/30 border-cyan-500 text-cyan-100 transform hover:scale-105"
        >
          [ 이 웹툰 바로 보러가기 ]
        </a>
      </div>

      <div className="w-full max-w-4xl system-panel mt-6 reveal delay-1000">
        {typingCompleted ? (
          <div className="flex flex-col items-center justify-center animate-fade-in">
            <p className="text-white/90 mb-2">{`${userName}님은 이 웹툰이 인생 웹툰인`}</p>
            <div className="flex items-baseline justify-center gap-2">
              <Counter key={displayLifeCount} end={displayLifeCount} /> 
              <p className="text-purple-300 text-xl font-bold">번째 사용자입니다.</p>
            </div>
          </div>
      ) : ( // 타이핑이 완료되기 전에는 아무것도 표시하지 않습니다.
        <div className="h-[66px]">&nbsp;</div> // 높이를 유지하여 레이아웃이 흔들리지 않도록 합니다.
        )}
      </div>

      {/* 🚨 수정: '결과 저장'과 '공유하기' 버튼을 포함한 4개 버튼 레이아웃으로 복원 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8 w-full max-w-2xl reveal delay-1200">
        <button onClick={handleSaveImage} className="system-button w-full">
          [ 결과 저장 ]
        </button>
        <button onClick={handleShare} className="system-button w-full">
          [ 공유하기 ]
        </button>
        <button onClick={onRestart} className="system-button w-full">
          [ 분석 재시작 ]
        </button>
        <button onClick={onShowList} className="system-button w-full">
          [ 데이터베이스 조회 ]
        </button>
      </div>
    </div>
  );
};

export default React.memo(ResultScreen);