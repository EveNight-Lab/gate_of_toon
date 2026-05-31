import { Webtoon, GeminiServiceResponse } from '../types';

export const MOCK_WEBTOONS: Webtoon[] = [
  {
    id: "w1",
    title: "전지적 독자 시점",
    author: "싱숑 / UMI",
    tags: ["판타지", "성장", "성좌", "먼치킨", "전투"],
    summary: "퇴근길 지하철, 스마트폰으로 보던 소설의 내용대로 세상이 멸망하고 새로운 시나리오가 시작되었다. 유일하게 이 세계의 결말을 알고 있는 독자의 생존기.",
    url: "https://comic.naver.com/webtoon/list?titleId=747269",
    lifeCount: 1254
  },
  {
    id: "w2",
    title: "화산귀환",
    author: "비가 / LICO",
    tags: ["무협", "성장", "코믹", "사이다", "전투"],
    summary: "대화산파 23대 제자, 천하삼대검수 매화검존 청명. 천하를 혼란에 빠뜨린 천마와의 동귀어진 후, 100년의 시간을 뛰어넘어 아이의 몸으로 다시 태어나 몰락한 화산을 재건한다.",
    url: "https://comic.naver.com/webtoon/list?titleId=769209",
    lifeCount: 987
  },
  {
    id: "w3",
    title: "나 혼자만 레벨업",
    author: "추공 / 장성락(REDICE STUDIO)",
    tags: ["현판", "먼치킨", "사이다", "전투", "성장"],
    summary: "재능 없는 E급 헌터 성진우. 기이한 던전에서 죽음의 고비를 넘긴 후, 오직 자신에게만 보이는 '퀘스트 창'과 '레벨업' 능력을 얻으며 최강의 그림자 군주로 거듭난다.",
    url: "https://page.kakao.com/content/50866481",
    lifeCount: 842
  },
  {
    id: "w4",
    title: "내 남편과 결혼해줘",
    author: "성소작 / LICO",
    tags: ["로맨스", "회귀", "복수", "사이다", "드라마"],
    summary: "절친과 남편의 불륜을 목격한 날, 시한부 인생의 지원은 비참한 죽음을 맞이한다. 그리고 거짓말처럼 10년 전으로 회귀하여, 자신의 운명을 절친에게 떠넘기기 위한 복수를 다짐한다.",
    url: "https://comic.naver.com/webtoon/list?titleId=783054",
    lifeCount: 651
  },
  {
    id: "w5",
    title: "가비지타임",
    author: "2사장",
    tags: ["스포츠", "학원", "코믹", "성장", "드라마"],
    summary: "전국 최약체 지상고등학교 농구부에 새로운 감독이 부임한다. 오합지졸 선수들이 땀과 눈물 속에서 한 팀이 되어 기적의 1승을 향해 달려가는 청춘 농구 드라마.",
    url: "https://comic.naver.com/webtoon/list?titleId=728750",
    lifeCount: 512
  }
];

let mockStep = 0;
let userNickname = "모험가";

export const resetMockSession = () => {
  mockStep = 0;
};

export const handleMockRecommend = (payload: { sessionId: string | null; message: string | object }): GeminiServiceResponse => {
  if (payload.sessionId === null) {
    resetMockSession();
    
    try {
      const parsed = JSON.parse(payload.message as string);
      userNickname = parsed.nickname || "모험가";
    } catch (e) {
      userNickname = "모험가";
    }

    mockStep = 1;
    return {
      sessionId: "mock-session-id",
      isFinal: false,
      message: `🌌 [성좌, '운명의 기록자'가 눈을 번뜩이며 ${userNickname}님을 환영합니다.] 당신의 취향 영혼이 탐색의 문을 열었습니다. 성좌들이 당신을 관전하기 위해 은하계 극장에 입장했습니다!`,
      filterRate: 0.8,
      newCandidateIds: ["w1", "w2", "w3", "w4", "w5"],
      nextCandidateCount: 5,
      isLastQuestion: false,
      comments: [
        "정의로운 빛의 성좌가 당신의 등장을 반갑게 미소 짓습니다.",
        "음모와 혼돈의 성좌가 침을 꼴깍 삼키며 당신을 바라봅니다."
      ],
      nextQuestion: {
        question: "1단계: 전장(세계관) 선택. 당신의 가슴을 뛰게 하는 무대는 어디인가요?",
        options: [
          { text: "현대 배경에 던전/레이드가 열리는 판타지 세계", tags: ["현판", "먼치킨"] },
          { text: "칼끝에 매화검이 흩날리는 강호의 무협 세계", tags: ["무협", "전투"] },
          { text: "마법과 마수가 웅성거리는 서양 정통 판타지 세계", tags: ["판타지", "성장"] },
          { text: "복수와 야망이 소용돌이치는 궁중 로맨스 판타지", tags: ["로맨스", "회귀", "복수"] }
        ]
      }
    };
  }

  const currentAnswer = (payload.message as any)?.text || "선택";
  mockStep += 1;

  if (mockStep === 2) {
    return {
      sessionId: "mock-session-id",
      isFinal: false,
      message: `💬 [성좌, '비밀을 탐하는 감시자'가 흥미로운 코멘트를 던집니다: "${currentAnswer}"이라니... 꽤나 모험심 넘치는 길을 선택했군!]`,
      filterRate: 0.5,
      newCandidateIds: ["w1", "w2", "w3"],
      nextCandidateCount: 3,
      isLastQuestion: false,
      comments: [
        "돈방석에 앉고 싶은 성좌가 당신의 대담함에 엄지를 치켜세웁니다.",
        "냉혹한 전략의 성좌가 당신의 생존력을 분석하기 시작합니다."
      ],
      nextQuestion: {
        question: "2단계: 인격과 능력. 만약 강력한 재능을 얻는다면 당신의 태도는?",
        options: [
          { text: "처음부터 적들을 압도하는 천재형 먼치킨", tags: ["먼치킨", "사이다"] },
          { text: "밑바닥에서 피눈물 흘리며 성장하는 노력형 주인공", tags: ["성장", "전투"] },
          { text: "머리와 권모술수로 판을 뒤흔드는 지략가", tags: ["복수", "사이다"] },
          { text: "동료와의 끈끈한 유대감으로 승리하는 따뜻한 리더", tags: ["스포츠", "성장"] }
        ]
      }
    };
  }

  if (mockStep === 3) {
    return {
      sessionId: "mock-session-id",
      isFinal: false,
      message: `🔮 [성좌, '심연의 지배자'가 굵직한 음성으로 웅얼거립니다: "네 영혼의 빛깔이 "${currentAnswer}" 방향으로 요동치는구나..."]`,
      filterRate: 0.2,
      newCandidateIds: ["w1", "w2"],
      nextCandidateCount: 2,
      isLastQuestion: true,
      comments: [
        "성좌들이 침묵 속에 마지막 선택을 숨죽여 기다립니다.",
        "운명의 주사위를 쥔 성좌가 묘한 미소를 짓습니다."
      ],
      nextQuestion: {
        question: "최종 단계: 위기 대응. 눈앞에 막강한 장벽이 놓여있습니다. 당신의 대응 방식은?",
        options: [
          { text: "참지 않는다! 즉시 폭발적인 힘으로 장벽을 부숴버린다 (사이다 피드백)", tags: ["사이다", "복수"] },
          { text: "모두를 이끈다! 고난을 동료들과 극복하며 성장한다 (성장 감동)", tags: ["성장", "드라마"] }
        ]
      }
    };
  }

  // Final step
  const choice = currentAnswer.toLowerCase();
  let recommended = MOCK_WEBTOONS[0];
  
  if (choice.includes("사이다") || choice.includes("부숴버린다")) {
    recommended = MOCK_WEBTOONS[2]; // 나 혼자만 레벨업
    if (Math.random() > 0.5) {
      recommended = MOCK_WEBTOONS[1]; // 화산귀환
    }
  } else if (choice.includes("동료") || choice.includes("극복")) {
    recommended = MOCK_WEBTOONS[4]; // 가비지타임
  } else if (choice.includes("로맨스") || choice.includes("복수")) {
    recommended = MOCK_WEBTOONS[3]; // 내 남편과 결혼해줘
  }

  return {
    sessionId: "mock-session-id",
    isFinal: true,
    message: `🌌 [성좌들의 시선이 하나의 운명선에 고정됩니다!] ${userNickname}님의 영혼에 가장 완벽하게 공명한 100% 싱크로율 웹툰을 매칭해 드립니다.`,
    finalWebtoonData: {
      id: recommended.id,
      title: recommended.title,
      reason: `성좌들이 일제히 함성을 지르며 당신의 성향을 추앙합니다! "${userNickname}"님은 최종 관문에서 '${currentAnswer}'를 선언하셨습니다. 
      강력한 목적의식과 난관을 기회로 뒤집어버리는 대담함을 품고 계시군요. 당신에게 가장 어울리는 명작은 바로 <${recommended.title}>입니다. 
      이 웹툰 속 주인공이 엮어내는 기적의 서사처럼, 당신의 미래도 찬란히 빛나길 성좌들이 온 우주의 이름으로 축복합니다!`,
      lifeCount: recommended.lifeCount + 1
    }
  };
};
