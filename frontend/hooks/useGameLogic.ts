import { useState, useEffect, useCallback } from 'react';
// 🚨 수정: FinalRecommendationResponse 타입을 제거하고, types.ts에 새로 정의된 GeminiServiceResponse를 임포트합니다.
import { GameState, Webtoon, ChatHistory, QuestionOption, QuestionResponse, GamePhase, GeminiServiceResponse } from '../types';
import { getNextQuestion, fetchAllWebtoons } from '../services/geminiService';

const MAX_QUESTIONS = 5;

// 🚨 부활: 닉네임 및 사전 질문 데이터
const NICKNAME_QUESTION = {
  question: "당신의 닉네임을 알려주세요.",
  message: "분석을 시작하기 전, 당신을 어떻게 불러드리면 될까요?",
  options: [], 
};

const SPEED_QUESTION = {
  question: "몇 개의 질문을 통해 인생 웹툰을 추천받고 싶으신가요?",
  message: "원하는 추천 깊이에 맞춰 질문 개수를 선택해주세요.",
  options: [
    { text: "5개 (빠르고 직관적인 추천)", score: 5 },
    { text: "7개 (적당하고 밸런스 있는 추천)", score: 7 },
    { text: "10개 (매우 신중하고 꼼꼼한 추천)", score: 10 },
  ],
};

export const useGameLogic = (calibrate: () => void) => {
  const [gameState, setGameState] = useState<GameState>(GameState.WELCOME);
  // 🚨 GamePhase의 초기값을 PRE_QUESTIONS로 변경할 수 있으나, App.tsx의 분기 처리를 위해 NICKNAME 유지
  const [gamePhase, setGamePhase] = useState<GamePhase>(GamePhase.NICKNAME); 
  const [userName, setUserName] = useState<string>('');
  
  // 🚨 핵심 수정: 백엔드와 세션을 유지하기 위한 sessionId 상태 추가
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [allWebtoons, setAllWebtoons] = useState<Webtoon[]>([]);
  const [candidateIds, setCandidateIds] = useState<string[] | null>(null);
  
  // 🚨 핵심 수정: 백엔드가 미리 계산해준 다음 후보 수를 저장할 상태
  const [nextCount, setNextCount] = useState<number | null>(null);
  
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [currentOptions, setCurrentOptions] = useState<QuestionOption[]>([]);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  
  const [finalResult, setFinalResult] = useState<Webtoon | null>(null);
  const [recommendationText, setRecommendationText] = useState<string>('');

  const [totalScore, setTotalScore] = useState<number>(0); // 사전 질문 점수
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 🚨 핵심 수정: 백엔드가 미리 보내준 성좌 코멘트를 저장할 상태
  const [preFetchedComments, setPreFetchedComments] = useState<string[]>([]);

  // 🚨 추가: 현재 질문이 마지막 질문인지 여부를 저장하는 상태
  const [isFinalQuestion, setIsFinalQuestion] = useState(false);

  // 🚨 추가: 사용 방법/안내 사항 화면을 위한 상태
  const [infoContent, setInfoContent] = useState<{ title: string; content: string; } | null>(null);

  const [feedback, setFeedback] = useState<{ comments: string[]; startCount: number; targetCount: number; } | null>(null);

  useEffect(() => {
    const loadWebtoons = async () => {
      setIsLoading(true);
      try {
        const webtoons = await fetchAllWebtoons();
        setAllWebtoons(webtoons);
        // 초기 candidateIds는 API 호출 시점에 설정
      } catch (err) {
        setError('웹툰 목록을 불러오는 데 실패했습니다. 서버 상태를 확인해주세요.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    loadWebtoons();
  }, []);

  const handleNextQuestion = useCallback((questionData: QuestionResponse) => {
    // 🚨 핵심 수정: 다음 질문을 표시하기 직전에, 후보자 목록을 업데이트합니다.
    // fetchNextStep에서 받아온 newCandidateIds가 여기서 적용됩니다.
    if (questionData.newCandidateIds) {
      setCandidateIds(questionData.newCandidateIds);
    }

    // 🚨 수정: 새로운 질문이 도착할 때마다 자이로스코프 기준점을 재설정합니다.
    calibrate();

    setCurrentMessage(questionData.message || '');
    setCurrentQuestion(questionData.question);
    setCurrentOptions(questionData.options);
    // 🚨 수정: 다음 질문이 세팅된 후, 피드백 화면을 제거합니다.
    // 약간의 딜레이를 주어 화면 전환이 자연스럽게 합니다.
    setTimeout(() => {
      setFeedback(null);
    }, 500);
    setGamePhase(GamePhase.CONTENT_QUESTIONS); 
    setQuestionCount(prev => prev + 1); // AI 질문 카운트 시작
  }, []);

  const fetchNextStep = useCallback(async (message: string | QuestionOption, currentSessionId: string | null) => {
    setIsLoading(true);
    setError(null);
try {
  const payload = {
    sessionId: currentSessionId,
    message,
  };
  // 🚨 디버깅용: 백엔드로 보내는 요청을 콘솔에 출력합니다.
  console.log("[백엔드 요청]", payload);

  const result = await getNextQuestion(payload);
  // 🚨 디버깅용: 백엔드로부터 받은 응답을 콘솔에 출력합니다.
  console.log("[백엔드 응답]", result);

  // 🚨 핵심 수정: 백엔드로부터 받은 sessionId를 상태에 저장합니다.
  setSessionId(result.sessionId);

  // ✅ 타입 분기: 최종 추천인지, 다음 질문인지 구분
  if (result.isFinal === true) {
    // ---------- [최종 추천 단계] ----------
    const { finalWebtoonData, message: recommendationReason } = result;
    const webtoonId = finalWebtoonData.id;

    if (webtoonId) {
      const finalWebtoon = allWebtoons.find((w) => w.id === webtoonId);
      // 🚨 수정: 백엔드에서 받은 최종 추천 데이터를 기반으로 finalResult를 구성합니다.
      // 🚨 수정: 백엔드에서 받은 최신 lifeCount를 finalWebtoon 객체에 업데이트합니다.
      if (finalWebtoon) {
        // 🚨 핵심 수정: 백엔드에서 받은 데이터(finalWebtoonData)와 프론트엔드가 가진 기존 데이터(finalWebtoon)를 병합합니다.
        // 이렇게 하면 title, reason, lifeCount 등은 최신 정보로 업데이트되고,
        // author, summary, url 등 기존 정보는 유지됩니다.
        const updatedFinalWebtoon = { 
          ...finalWebtoon, 
          ...finalWebtoonData 
        };
        setFinalResult(updatedFinalWebtoon);
      } else {
        // allWebtoons 목록에 해당 웹툰이 없는 경우, 백엔드 데이터만으로 finalResult를 구성합니다.
        // 🚨 수정: allWebtoons에 없더라도 백엔드 데이터로 finalResult를 구성합니다.
        // 이렇게 하면 author, summary 등 일부 정보는 누락되지만 화면이 깨지지는 않습니다.
        setFinalResult({
          ...finalWebtoonData,
          author: 'N/A',
          tags: [],
          summary: 'N/A',
          url: '#',
        } as Webtoon);
      }
      // 🚨 수정: finalWebtoonData.reason이 있으면 우선적으로 사용하고, 없으면 result.message를 사용합니다.
      setRecommendationText(finalWebtoonData.reason || recommendationReason || "이 웹툰을 추천합니다!");
      setGameState(GameState.RESULT);
    } else {
      setError("최종 추천 웹툰의 ID가 응답에서 누락되었습니다.");
      setGameState(GameState.WELCOME);
    }
  } else {
    // ---------- [다음 질문 단계] ----------
    if (result.newCandidateIds) {
      // 🚨 핵심 수정: 백엔드 응답이 오면 feedback 상태의 targetCount를 업데이트하여 카운트다운 애니메이션을 시작합니다.
      setFeedback(prevFeedback => {
        if (!prevFeedback) return null; // 피드백 상태가 아니면 아무것도 안함
        return {
          ...prevFeedback,
          targetCount: result.newCandidateIds.length,
        };
      });

    }

    // 🚨 핵심 수정: 백엔드가 보내준 다음 후보 수를 상태에 저장합니다.
    if (result.nextCandidateCount !== undefined) {
      setNextCount(result.nextCandidateCount);
    }

    if (result.message) {
      const modelEntry: ChatHistory = {
        role: "model",
        parts: [{ text: result.message }],
      };
      setHistory((prev) => [...prev, modelEntry]);
    }

    // 🚨 핵심 수정: 백엔드가 미리 보내준 comments를 상태에 저장합니다.
    if (result.comments) {
      setPreFetchedComments(result.comments);
    }

    // 🚨 추가: 백엔드에서 받은 마지막 질문 여부를 상태에 저장합니다.
    setIsFinalQuestion(result.isLastQuestion ?? false);

    if (result.nextQuestion) {
      handleNextQuestion({
        // 🚨 수정: 백엔드 응답 구조 변경에 따라 nextQuestion 객체를 직접 사용합니다.
        // comments 필드는 더 이상 사용하지 않습니다.
        // filterRate는 nextQuestion과 같은 레벨에 있으므로, 여기서 설정합니다.
        // 이 부분은 백엔드 응답 구조에 따라 조정될 수 있습니다.
        // 현재는 nextQuestion에 필요한 데이터만 전달합니다.
        ...result.nextQuestion,
        message: result.message,
        newCandidateIds: result.newCandidateIds, // 🚨 핵심 수정: 다음 후보 ID 목록을 handleNextQuestion으로 전달
      });
    }

    // 🚨 수정: 함수형 업데이트를 사용하여 stale state 문제를 해결합니다.
    // 첫 AI 질문을 받아온 직후(currentHistory가 비어있을 때)에는
    // 현재 상태가 INITIAL_LOADING일 경우 QUESTIONS로 변경합니다.
    setGameState(prevGameState =>
      history.length === 0 && prevGameState === GameState.INITIAL_LOADING
        ? GameState.QUESTIONS 
        : prevGameState
    );

    if (result.nextQuestion) {
      handleNextQuestion({
        ...result.nextQuestion,
        message: result.message, // 🚨 수정: message를 올바르게 전달
        isLastQuestion: result.isLastQuestion, // 🚨 추가: isLastQuestion 플래그 전달
        newCandidateIds: result.newCandidateIds,
      });
    }

  }
} catch (error) {
  console.error("추천 로직 처리 중 오류 발생:", error);
  setError("AI 추천 로직 처리 중 문제가 발생했습니다.");
  setGameState(GameState.WELCOME); // 🚨 수정: 에러 발생 시 Welcome 화면으로 이동
} finally {
      setIsLoading(false);
    }
  }, [allWebtoons, handleNextQuestion, setFeedback, history]);
  
  const handleStart = useCallback(() => {
    // 닉네임 질문으로 시작
    setCurrentMessage(NICKNAME_QUESTION.message);
    setCurrentQuestion(NICKNAME_QUESTION.question);
    setCurrentOptions([]);
    setGamePhase(GamePhase.NICKNAME);
    setGameState(GameState.QUESTIONS);
  }, []);

  const handlePreQuestionsComplete = useCallback((name: string, finalScore: number) => {
    setUserName(name);
    setTotalScore(finalScore);

    setGameState(GameState.INITIAL_LOADING);
    // 상태 초기화
    setCurrentQuestion('');
    setCurrentOptions([]);
    setCurrentMessage('');
    setQuestionCount(0); // AI 질문 카운트 리셋
    
    // 🚨 [리팩토링] filterRate 관리 주체를 백엔드로 이전합니다.
    // 이제 프론트엔드는 filterRate를 계산하지 않고, 닉네임과 사전 질문 총점(totalScore)만 전달합니다.
    // 백엔드가 totalScore를 기반으로 filterRate를 결정하고 관리합니다.
    const messagePayload = JSON.stringify({ nickname: name, totalScore: finalScore });
    // 🚨 수정: API 요청 방식 변경에 따라 sessionId와 message만 전달합니다.
    fetchNextStep(messagePayload, null); // 첫 호출 시 sessionId는 null
  }, [fetchNextStep, calibrate]);

  const handleAnswer = useCallback(async (answer: string | QuestionOption) => {
    const answerText = typeof answer === 'string' ? answer : answer.text;

    if (gamePhase === GamePhase.NICKNAME) {
      setUserName(answerText);
      // 닉네임 입력 후, 질문 개수 선택 질문으로 전환
      setCurrentMessage(SPEED_QUESTION.message);
      setCurrentQuestion(SPEED_QUESTION.question);
      setCurrentOptions(SPEED_QUESTION.options);
      setGamePhase(GamePhase.SPEED_CHECK);
      setQuestionCount(1);
      setHistory([]); 

    } else if (gamePhase === GamePhase.SPEED_CHECK) {
      const finalScore = (answer as QuestionOption).score || 5;
      handlePreQuestionsComplete(userName, finalScore);
    } else if (gamePhase === GamePhase.CONTENT_QUESTIONS) {
      // 🚨 수정: 마지막 질문에 답변하면, 최종 로딩 상태로 전환합니다.
      // 이렇게 하면 ResultScreen으로 넘어가기 전에 FinalLoadingScreen을 표시할 수 있습니다.
      // 🚨 수정: 질문 횟수(questionCount)가 아닌, isFinalQuestion 플래그를 확인합니다.
      if (isFinalQuestion) {
        setGameState(GameState.FINAL_LOADING);
        // 로딩 상태를 즉시 활성화하여 FinalLoadingScreen이 바로 보이도록 합니다.
        setIsLoading(true); 
      }
      // 🚨 핵심 수정: 미리 받아둔 preFetchedComments를 사용하여 피드백 상태를 즉시 설정합니다.
      // startCount는 현재 후보 수, targetCount는 다음 API 호출에서 받아올 예정이므로 일단 startCount와 동일하게 설정합니다.
      // fetchNextStep이 완료되면 targetCount가 업데이트될 것입니다.
      // 이 부분은 fetchNextStep의 응답 처리 로직과 연계되어야 합니다.
      // 사용자가 선택을 누르는 순간, 카운트다운 애니메이션을 준비합니다.
      setFeedback({
        comments: preFetchedComments,
        startCount: candidateIds?.length ?? allWebtoons.length,
        // 🚨 핵심 수정: 자체 계산 로직을 제거하고, 백엔드가 미리 알려준 nextCount를 사용합니다.
        targetCount: nextCount ?? (candidateIds?.length || allWebtoons.length),
      });
      setIsLoading(true); // 로딩 상태를 즉시 활성화

      // 🚨 수정: API 요청 방식 변경에 따라 선택된 option 객체를 그대로 message에 담아 전송합니다.
      // JSON.stringify를 사용하지 않습니다.
      const messagePayload = answer as QuestionOption;
      fetchNextStep(messagePayload, sessionId);
    }}, [gamePhase, totalScore, questionCount, userName, candidateIds, allWebtoons, fetchNextStep, handlePreQuestionsComplete, preFetchedComments, nextCount, sessionId, isFinalQuestion]);


  const handleRestart = useCallback(() => {
    setGameState(GameState.WELCOME);
    setGamePhase(GamePhase.NICKNAME);
    setSessionId(null); // 🚨 수정: sessionId 초기화
    setNextCount(null);
    setUserName('');
    setCandidateIds(null);
    setQuestionCount(0);
    setCurrentMessage('');
    setCurrentQuestion('');
    setCurrentOptions([]);
    setHistory([]);
    setFinalResult(null);
    setRecommendationText('');
    setTotalScore(0);
    setIsLoading(false);
    setError(null);
    setFeedback(null);
    setPreFetchedComments([]);
    setIsFinalQuestion(false); // 🚨 추가: 마지막 질문 플래그 초기화
  }, [allWebtoons]);

  const handleShowList = useCallback(() => {
    // 🚨 수정: 웹툰 목록을 표시하기 전에, 정보 화면 상태를 초기화합니다.
    setInfoContent(null);
    setGameState(GameState.SHOW_LIST);
  }, []);

  // 🚨 추가: 정보 화면(사용 방법/안내 사항)을 표시하는 핸들러
  const handleShowInfo = useCallback((title: string, content: string) => {
    setInfoContent({ title, content });
    setGameState(GameState.SHOW_LIST); // SHOW_LIST 상태를 재활용하여 정보 화면을 띄웁니다.
  }, []);

  return {
    gameState, gamePhase, error, isLoading, allWebtoons, candidateIds, userName,
    currentMessage, currentQuestion, currentOptions, questionCount, isFinalQuestion,
    finalResult, recommendationText, feedback, infoContent,
    handleStart, handleAnswer, handleRestart, handleShowList, handleShowInfo, nextCount, handlePreQuestionsComplete
  };
};
