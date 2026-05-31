import React, { useState, useEffect } from 'react';
import { Webtoon } from '../types';

interface InitialLoadingScreenProps {
  totalCount: number;
  webtoons: Webtoon[];
}

const useAnimatedCounter = (end: number, duration: number) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0) return;
    let startTime: number | null = null;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      const currentVal = Math.floor(end * percentage);
      setCount(currentVal);

      if (progress < duration) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [end, duration]);

  return count;
};

const useRollingWebtoons = (webtoons: Webtoon[], duration: number) => {
  const [currentTitle, setCurrentTitle] = useState('');

  useEffect(() => {
    if (webtoons.length === 0) return;

    // 🚨 수정: 각 웹툰 제목이 표시되는 간격을 10배로 늘려 롤링 속도를 2배 더 늦춥니다.
    const intervalTime = Math.max(50, (duration / webtoons.length) * 10);
    let index = 0;
    const intervalId = setInterval(() => {
      setCurrentTitle(webtoons[index % webtoons.length].title);
      index++;
    }, intervalTime);

    return () => clearInterval(intervalId);
  }, [webtoons, duration]);

  return currentTitle;
};

// 🚨 추가: CSS 파일 없이 애니메이션을 적용하기 위한 스타일 컴포넌트
const AnimationStyle = () => (
  <style>{`
    @keyframes slide-down-in-out {
      0% {
        opacity: 0;
        transform: translateY(-50%);
      }
      20%, 80% {
        opacity: 1;
        transform: translateY(0);
      }
      100% {
        opacity: 0;
        transform: translateY(50%);
      }
    }
  `}</style>
);

const InitialLoadingScreen: React.FC<InitialLoadingScreenProps> = ({ totalCount, webtoons }) => {
  const animationDuration = 8000; // 🚨 수정: 카운트업 속도를 4초 -> 8초로 변경하여 2배 더 느리게 합니다.
  const animatedCount = useAnimatedCounter(totalCount, animationDuration);
  const rollingTitle = useRollingWebtoons(webtoons, animationDuration);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] text-white animate-fade-in">
      <AnimationStyle />
      <h2 className="font-orbitron text-lg text-cyan-400 tracking-widest mb-4">[ 게이트 동기화 중 ]</h2>
      <p className="text-7xl font-black font-orbitron text-purple-400 mb-4">{animatedCount.toLocaleString()}</p>
      <p className="text-lg text-gray-300 italic animate-pulse mb-8">분석할 웹툰 데이터를 불러옵니다...</p>

      {/* 🚨 추가: 웹툰 제목 롤링 효과 */}
      <div className="w-full max-w-md h-10 flex items-center justify-center overflow-hidden relative mt-4">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-950 to-transparent"></div>
        <div className="relative h-full w-full flex items-center justify-center">
          {/* 🚨 수정: key 변경 시 애니메이션을 다시 트리거하고, 올바른 애니메이션 이름을 사용합니다. */}
          <p
            key={rollingTitle}
            className="text-cyan-200/80 text-sm truncate absolute"
            style={{ animation: `slide-down-in-out ${Math.max(50, (animationDuration / (webtoons.length || 1)) * 10) / 1000}s ease-in-out forwards` }}
          >
            {rollingTitle}
          </p>
        </div>
      </div>
    </div>
  );
};

export default InitialLoadingScreen;