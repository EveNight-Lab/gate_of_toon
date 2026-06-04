import { Webtoon, GeminiServiceResponse } from '../types';
import { MOCK_WEBTOONS, handleMockRecommend } from './mockService';

// 백엔드 API 명세에 따른 타입 정의
interface RecommendRequest {
  sessionId: string | null; // 세션 ID
  message: string | object; 
}

// 개발 및 배포 환경에서 데모(Mock) 모드 활성화 여부
// VITE_USE_MOCK이 true이거나, 실제 API 주소가 없을 때 데모 모드로 작동
const IS_MOCK_ENV = import.meta.env.VITE_USE_MOCK === 'true' || !import.meta.env.VITE_API_URL;

export const getNextQuestion = async (
  requestData: RecommendRequest
): Promise<GeminiServiceResponse> => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  if (IS_MOCK_ENV) {
    console.log("🌌 [Gate of Toon] VITE_USE_MOCK is active. Running in local Demo Mode.");
    // 4초의 인위적 딜레이를 주어 후보군 카운트다운 애니메이션과 성좌 채팅 연출을 충분히 보여줍니다.
    await new Promise(resolve => setTimeout(resolve, 4000));
    return handleMockRecommend(requestData);
  }

  try {
    const response = await fetch(`${API_URL}/api/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      throw new Error('API server returned error status');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.warn(
      "⚠️ [Gate of Toon Fallback] 추천 API 서버 연결 실패 혹은 키 만료 상태입니다. " +
      "사용자 경험 보존을 위해 자동으로 [로컬 오프라인 데모/데모 모드]로 grace degradation을 수행합니다.",
      error
    );
    // 서버가 꺼져 있거나 에러가 나면 화면이 멈추지 않고 모의 시뮬레이터로 매끄럽게 연결
    await new Promise(resolve => setTimeout(resolve, 4000));
    return handleMockRecommend(requestData);
  }
};

export const fetchAllWebtoons = async (): Promise<Webtoon[]> => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  if (IS_MOCK_ENV) {
    return MOCK_WEBTOONS;
  }

  try {
    const response = await fetch(`${API_URL}/api/webtoons`);
    if (!response.ok) {
      throw new Error('Failed to fetch webtoon list');
    }
    return await response.json();
  } catch (error) {
    console.warn(
      "⚠️ [Gate of Toon Fallback] 웹툰 리스트를 가져오는 데 실패하여 로컬 오프라인 데이터로 대체합니다.",
      error
    );
    // 서버가 꺼져 있어도 화면 전체가 깨지지 않도록 로컬 데이터셋 즉시 반환
    return MOCK_WEBTOONS;
  }
};