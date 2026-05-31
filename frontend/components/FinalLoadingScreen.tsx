import React, { useState, useEffect } from 'react';

const useFinalCounter = (start: number) => {
  const [count, setCount] = useState(start);

  useEffect(() => {
    if (start <= 1) {
      setCount(1);
      return;
    }

    const duration = 2500;
    const totalSteps = start - 1;
    const stepTime = duration / totalSteps;

    const timer = setInterval(() => {
      setCount(prevCount => {
        if (prevCount <= 1) {
          clearInterval(timer);
          return 1;
        }
        return prevCount - 1;
      });
    }, stepTime);

    return () => clearInterval(timer);
  }, [start]);

  return count;
};

const FinalLoadingScreen: React.FC<{ startCount: number }> = ({ startCount }) => {
  const animatedCount = useFinalCounter(startCount);

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[60vh] text-white animate-fade-in">
      <h2 className="font-orbitron text-lg text-cyan-400 tracking-widest mb-4">[ 최종 후보 분석 ]</h2>
      <p className="text-7xl font-black font-orbitron text-purple-400 mb-4">{animatedCount}</p>
      <p className="text-lg text-gray-300 italic animate-pulse">최적의 웹툰을 선정하는 중...</p>
    </div>
  );
};

export default FinalLoadingScreen;