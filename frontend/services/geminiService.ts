import { Webtoon, ChatHistory, GeminiServiceResponse} from '../types';

// 백엔드 API 명세에 따른 타입 정의
interface RecommendRequest {
  sessionId: string | null; // 세션 ID
  // 🚨 수정: message는 문자열(첫 요청) 또는 객체(두 번째부터)가 될 수 있습니다.
  message: string | object; 
}

export const getNextQuestion = async (
  requestData: RecommendRequest
): Promise<GeminiServiceResponse> => {
  // 백엔드 API URL - 배포 시 실제 URL로 변경해야 합니다.
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  try {
    const response = await fetch(`${API_URL}/api/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // App.tsx에서 전달한 객체를 그대로 body에 담아 전송합니다.
      body: JSON.stringify(requestData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'API request failed');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling recommendation API:", error);
    throw new Error("추천 데이터를 받아오는 데 실패했습니다. 서버에 문제가 발생했을 수 있습니다.");
  }
};

export const fetchAllWebtoons = async (): Promise<Webtoon[]> => {
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  try {
    const response = await fetch(`${API_URL}/api/webtoons`);
    if (!response.ok) {
      throw new Error('Failed to fetch webtoon list');
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching webtoon list:", error);
    // API 호출 실패 시 에러를 throw하여 호출부에서 처리하도록 합니다.
    throw new Error("웹툰 목록을 불러오는 데 실패했습니다. 서버에 문제가 발생했을 수 있습니다.");
  }
};