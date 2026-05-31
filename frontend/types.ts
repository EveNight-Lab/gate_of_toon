export interface Webtoon {
  id: string; 
  title: string;
  author: string;
  tags: string[];
  summary: string;
  url: string;
  lifeCount: number;
}

export enum GameState {
  WELCOME,
  PRE_QUESTIONS,
  INITIAL_LOADING,
  FINAL_LOADING, // 🚨 최종 추천 전 로딩 상태 추가
  QUESTIONS,
  RESULT,
  SHOW_LIST,
}

export interface QuestionOption {
  text: string;
  // 🚨 수정: 백엔드 응답 변경에 따라 tags 필드 추가, score는 사전질문에서만 사용되므로 optional
  score?: number; 
  tags?: string[];
}

// 게임 진행 단계를 더 세분화하여 관리
export enum GamePhase {
  NICKNAME,
  SPEED_CHECK,
  CONTENT_QUESTIONS,
}

// 백엔드 API와 통신하기 위한 대화 기록 타입
export interface ChatPart {
  text: string;
}

export interface ChatHistory {
  role: 'user' | 'model';
  parts: ChatPart[];
}

// 다음 질문 객체의 핵심 구조
export interface NextQuestionData {
    question: string;
    options: QuestionOption[];
}

// 백엔드에서 받는 최종 추천 웹툰 상세 정보
export interface FinalWebtoonDetails {
    id: string;
    title: string; // 🚨 수정: title 필드 추가
    reason: string; // 최종 추천 이유 (필수)
    lifeCount: number;
    recommendationId?: string; // 🚨 수정: 백엔드 응답에 포함된 recommendationId 추가
}

// QuestionResponse는 NextQuestionData를 포함하며, useGameLogic.ts의 handleNextQuestion에 사용됩니다.
export interface QuestionResponse extends NextQuestionData {
  message?: string;
  newCandidateIds?: string[];
}


// 🚨 핵심: getNextQuestion API 응답 타입 정의 (Union Type)
export type GeminiServiceResponse = 
    // Case 1: 다음 질문 응답 (isFinal: false)
    | {
        sessionId: string; // 🚨 수정: sessionId 필드 추가
        isFinal: false;
        message: string; // LLM이 사용자에게 전달할 메시지 (예: "다음 질문입니다.")
        filterRate: number; 
        newCandidateIds: string[]; // 필터링된 웹툰 ID 목록
        nextQuestion: NextQuestionData; // 다음 질문 내용이 이 객체 안에 중첩됨
        nextCandidateCount: number;
        isLastQuestion: boolean; // 🚨 추가: 마지막 질문 여부
        comments?: string[]; // 성좌 코멘트 추가
    }
    // Case 2: 최종 추천 응답 (isFinal: true)
    | {
        sessionId: string; // 🚨 수정: sessionId 필드 추가
        isFinal: true;
        message: string; // LLM이 사용자에게 전달할 최종 추천 메시지
        finalWebtoonData: FinalWebtoonDetails; // 최종 추천 웹툰 상세 정보가 이 객체 안에 중첩됨
    };
