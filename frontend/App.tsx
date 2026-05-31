import React, { useState, useEffect, useCallback } from 'react';
import { GameState, GamePhase } from './types';
import WelcomeScreen from './components/WelcomeScreen';
import InitialLoadingScreen from './components/InitialLoadingScreen';
import QuestionScreen from './components/QuestionScreen';
import ResultScreen from './components/ResultScreen';
import WebtoonListScreen from './components/WebtoonListScreen';
import InfoScreen from './components/InfoScreen'; // 🚨 추가: InfoScreen 임포트
import FinalLoadingScreen from './components/FinalLoadingScreen'; // 🚨 추가: FinalLoadingScreen 임포트
import LoadingSpinner from './components/LoadingSpinner';
import DynamicBackground from './components/DynamicBackground';
import { useParallax } from './hooks/useParallax';
import { useGameLogic } from './hooks/useGameLogic';
import NicknameInput from './NicknameInput';

const MAX_QUESTIONS = 5;

function App() {
  // 프리렌더 콘텐츠는 z-index로 이미 뒤에 숨겨져 있으므로 별도 처리 불필요

  const { coordsRef, requestPermission, permissionState, calibrate } = useParallax();
  const {
    gameState, gamePhase, error, isLoading, allWebtoons, candidateIds, userName,
    currentMessage, currentQuestion, currentOptions, questionCount, infoContent, nextCount, isFinalQuestion,
    finalResult, recommendationText, feedback, handleShowInfo,
    handleStart, handleAnswer, handleRestart, handleShowList, handlePreQuestionsComplete,
  } = useGameLogic(calibrate);

  const renderContent = () => {
    if(error && !isLoading) {
        return (
            <div className="text-center text-red-400 p-8 flex flex-col items-center gap-4">
                <p>{error}</p>
                <button onClick={handleRestart} className="system-button">
                    [ 다시 시작 ]
                </button>
            </div>
        );
    }

    switch (gameState) {
      case GameState.WELCOME:
        return <WelcomeScreen
                  onStart={handleStart}
                  onShowList={handleShowList} onShowInfo={handleShowInfo}
                  requestPermission={requestPermission} permissionState={permissionState}
                />;
      case GameState.INITIAL_LOADING:
        return <InitialLoadingScreen totalCount={allWebtoons.length} webtoons={allWebtoons} />;
      // 🚨 추가: 최종 로딩 상태일 때 FinalLoadingScreen을 렌더링합니다.
      case GameState.FINAL_LOADING:
        return <FinalLoadingScreen startCount={candidateIds?.length ?? 2} />;
      case GameState.QUESTIONS: {
        if (gamePhase === GamePhase.NICKNAME) {
          return <NicknameInput
                    question={currentQuestion}
                    message={currentMessage} // @ts-ignore
                    onSubmit={(nickname) => handleAnswer(nickname)}
                    isLoading={isLoading}
                  />;
        }
        // 🚨 수정: 로딩 중이거나 질문이 있을 때 항상 QuestionScreen을 렌더링하도록 변경
        // 이렇게 하면 QuestionScreen이 내부적으로 로딩 상태(피드백 화면 등)를 올바르게 처리할 수 있습니다.
        if (currentQuestion) {
            return (
                <QuestionScreen
                    userName={userName}
                    message={currentMessage}
                    question={currentQuestion}
                    options={currentOptions}
                    onAnswer={(option) => handleAnswer(option)} // @ts-ignore
                    questionCount={questionCount}
                    totalQuestions={MAX_QUESTIONS}
                    totalWebtoons={allWebtoons.length}
                    isFinalQuestion={isFinalQuestion}
                    candidateCount={candidateIds?.length ?? allWebtoons.length}
                    isLoading={isLoading}
                    feedback={feedback}
                />
            );
        }
        // 질문이 없는 로딩 상태 (예: 초기 질문 후 첫 AI 질문 대기)
        return <LoadingSpinner message="신호를 분석하는 중..." />;
      }
      case GameState.RESULT:
        return (
          <ResultScreen
            userName={userName}
            webtoon={finalResult!}
            recommendationText={recommendationText}
            onRestart={handleRestart} // @ts-ignore
            onShowList={handleShowList}
          />
        );
      case GameState.SHOW_LIST:
        // 🚨 수정: infoContent가 있으면 InfoScreen을, 없으면 WebtoonListScreen을 렌더링
        return infoContent
          ? <InfoScreen title={infoContent.title} content={infoContent.content} onBack={handleRestart} />
          : <WebtoonListScreen webtoons={allWebtoons} onBack={handleRestart} />;
      default:
        return null;
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gray-950 flex items-center justify-center p-4">
      <DynamicBackground 
        webtoons={candidateIds ? allWebtoons.filter(w => candidateIds.includes(w.id)) : []} 
        allWebtoons={allWebtoons} 
        gameState={gameState}
        parallaxCoordsRef={coordsRef}
        permissionState={permissionState}
      />
      <div className="relative z-10 w-full max-w-4xl mx-auto status-window">
        <div className="status-window-content">
          {renderContent()}
        </div>
      </div>
      {/* 🚨 추가: 제작자 정보 푸터 */}
      <footer className="absolute bottom-4 text-center text-xs">
        <p className="text-transparent bg-clip-text bg-gradient-to-r from-red-800 via-purple-600 to-purple-800 font-bold">
          제작자: 돌블 (dolveul) | dorubru0331@gmail.com
        </p>
      </footer>
    </div>
  );
}

export default App;