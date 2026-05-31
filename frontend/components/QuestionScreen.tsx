import React, { useState, useEffect, useRef } from 'react';
import { QuestionOption } from '../types';
import LoadingSpinner from './LoadingSpinner';

interface QuestionScreenProps {
  userName: string;
  message: string;
  question: string;
  options: QuestionOption[];
  onAnswer: (option: QuestionOption) => void;
  questionCount: number;
  totalQuestions: number;
  totalWebtoons: number; // 🚨 추가: 전체 웹툰 수를 받습니다.
  candidateCount: number;
  isFinalQuestion: boolean; // 🚨 수정: 마지막 질문 여부를 직접 받습니다.
  isLoading: boolean;
  feedback: { comments: string[]; startCount: number; targetCount: number; } | null;
}

const useAnimatedCounter = (start: number, end: number) => {
    const [count, setCount] = useState(start);

    useEffect(() => {
        if (start === end) return; // 카운트 변화가 없으면 애니메이션 실행 안함
        // 🚨 수정: 카운트다운 지속 시간을 4초 -> 8초로 늘려 속도를 2배 늦춥니다.
        const duration = 8000;
        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;
            const percentage = Math.min(progress / duration, 1);
            const currentVal = Math.floor(start - (start - end) * percentage);
            setCount(currentVal);

            if (progress < duration) {
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setCount(end); // 애니메이션이 끝나면 최종값으로 설정
            }
        };

        animationFrameId = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationFrameId);
    }, [start, end]);

    return count;
};

const QuestionScreen: React.FC<QuestionScreenProps> = ({
  userName,
  message,
  question,
  options,
  onAnswer,
  questionCount,
  totalQuestions,
  totalWebtoons, // 🚨 추가
  isFinalQuestion, // 🚨 수정
  candidateCount,
  isLoading,
  feedback,
}) => {
  // 🚨 수정: 애니메이션 시작/종료 값을 feedback 상태에서 가져옵니다.
  const animatedCount = useAnimatedCounter(
    feedback ? feedback.startCount : candidateCount, 
    feedback ? feedback.targetCount : candidateCount
  );
  const showFeedback = isLoading && feedback;

  // 🚨 수정: 게이지 로직을 '남은 웹툰 수' 기준으로 변경합니다.
  // (전체 웹툰 수 - 현재 후보 수) / (전체 웹툰 수 - 1)
  // 분모에서 1을 빼는 이유는 최종 1개가 남았을 때 100%를 만들기 위함입니다.
  const calculateProgress = (count: number) => 
    totalWebtoons > 1 ? ((totalWebtoons - count) / (totalWebtoons - 1)) * 100 : 0;

  const currentProgress = calculateProgress(candidateCount);
  const nextProgress = feedback ? calculateProgress(feedback.targetCount) : currentProgress;
  const isInitialLoading = isLoading && !question && !feedback;
  
  const [visibleComments, setVisibleComments] = useState<string[]>([]);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showFeedback && feedback?.comments) {
        setVisibleComments([]);
        let delay = 500; // Initial delay before the first comment
        const timeouts = feedback.comments.map((comment) => {
            const timeoutId = setTimeout(() => {
                setVisibleComments(prev => [...prev, comment]);
            }, delay);
            // 🚨 수정: 성좌 멘트 표시 간격을 1.8초 ~ 4.0초 사이로 더 길게 조정합니다.
            delay += 1800 + Math.random() * 2200;
            return timeoutId;
        });
        return () => timeouts.forEach(clearTimeout);
    }
  }, [showFeedback, feedback]);

  useEffect(() => {
    if (chatAreaRef.current) {
        chatAreaRef.current.scrollTo({ top: chatAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [visibleComments]);

  return (
    <div className="p-4 md:p-6 flex flex-col min-h-[70vh] animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-cyan-700/50 pb-3 mb-4 font-orbitron">
        <div className="text-left">
          <p className="text-sm text-white/60 tracking-wider">USER</p>
          <p className="text-md sm:text-lg font-bold text-white">{userName}</p>
        </div>
        <div className="text-right">
          {isFinalQuestion ? (
            <>
              <p className="text-sm text-white/60 tracking-wider">최종 필터링</p>
              <p className="text-lg sm:text-xl font-bold text-purple-400 animate-pulse">알고리즘 분기</p>
            </>
          ) : (
            <>
              <p className="text-sm text-white/60 tracking-wider">인생웹툰 후보</p>
              <p className="text-lg sm:text-xl font-bold text-purple-300 transition-all duration-500">{animatedCount}</p>
            </>
          )}
        </div>
      </div>
      
      {/* Progress Bar */}
       <div className="w-full bg-black/30 h-1.5 mb-6 relative overflow-hidden border border-white/20">
        {/* 🚨 수정: 게이지 애니메이션 지속 시간을 500ms에서 8000ms(8초)로 늘려 훨씬 느리게 만듭니다. */}
        <div 
            className="bg-gradient-to-r from-cyan-500 to-purple-500 h-full transition-all duration-[8000ms] ease-out" 
            style={{ width: `${showFeedback ? nextProgress : currentProgress}%` }}
        ></div>
      </div>
      
      {/* Main Content */}
      <div className={`flex-grow flex flex-col text-center ${showFeedback || isInitialLoading ? 'justify-start' : 'justify-center'}`}>
        {isInitialLoading ? (
            <div className="pt-20">
                <LoadingSpinner message="첫 번째 신호를 수신하는 중..." />
            </div>
        ) : showFeedback ? (
            <div className="w-full flex flex-col items-center pt-8 pb-4 px-2 animate-fade-in">
                <div className="relative flex flex-col items-center justify-center flex-shrink-0">
                    <div className="relative flex items-center justify-center">
                        <svg className="animate-spin h-16 w-16 sm:h-20 sm:w-20 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="absolute text-2xl sm:text-3xl font-orbitron font-bold text-purple-300">
                            {animatedCount}
                        </span>
                    </div>
                    <p className="mt-3 font-orbitron text-white/80 text-sm tracking-wider">[ 후보 압축 중 ]</p>
                </div>
                <div className="mt-4 text-center w-full max-w-lg flex flex-col items-center">
                    <div className="chat-container">
                        <div className="chat-messages-area flex flex-col items-start" ref={chatAreaRef}>
                            {visibleComments.length === 0 && (
                                <div className="chat-placeholder">
                                    <p>[ 방관자들의 반응을 기다리는 중... ]</p>
                                </div>
                            )}
                            {visibleComments.map((comment, index) => {
                                const match = comment.match(/^(『.*?』)(.*)$/);
                                const observer = match ? match[1] : null;
                                const messageText = match ? match[2].trim() : comment;

                                return (
                                    <div 
                                        key={index} 
                                        className={'chat-bubble chat-bubble-left animate-chat-message'}
                                        style={{ wordBreak: 'keep-all' }} // 🚨 수정: 한글 단어 중간에 잘리는 현상 방지
                                    >
                                        <p className="text-md text-left">
                                            {observer && <span className="observer-name">{observer}</span>}
                                            {messageText}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="chat-input-fake">
                            <p>[ 관측 전용 채널 ]</p>
                        </div>
                    </div>
                </div>
            </div>
        ) : (
            <div className="animate-fade-in">
                <div className="system-panel mb-6">
                    {/* 🚨 수정: 모바일에서 줄바꿈이 자연스럽도록 flex-wrap 적용 및 폰트 크기 조정 */}
                    <div className="flex flex-wrap justify-between items-center gap-x-4 gap-y-2 mb-4">
                        {isFinalQuestion ? (
                            <p className="text-purple-300 italic text-sm sm:text-base animate-pulse"> &gt; 최종 분석 단계입니다. 당신의 선택이 추천 알고리즘을 완성합니다.</p>
                        ) : (
                            <p className="text-white/80 italic text-sm sm:text-base"> &gt; {message}</p>
                        )}
                        {isFinalQuestion && <span className="text-purple-400 font-bold text-sm animate-pulse">[ 마지막 질문 ]</span>}
                    </div>
                    <div className="title-line my-4"></div>
                    <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-relaxed">{question}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 w-full max-w-3xl mx-auto">
                    {(options || []).map((option, index) => (
                    <button
                        key={index}
                        onClick={() => onAnswer(option)}
                        className="system-button text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isLoading}
                    >
                        {option.text}
                    </button>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default React.memo(QuestionScreen);