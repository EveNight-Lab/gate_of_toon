import React, { useState } from 'react';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unsupported';

interface WelcomeScreenProps {
  onStart: () => void;
  onShowList: () => void;
  onShowInfo: (title: string, content: string) => void; // 🚨 추가
  requestPermission: () => void;
  permissionState: PermissionState;
}

const HOW_TO_USE_CONTENT = `
【 게이트 오브 툰: 당신의 웹툰 유니버스 가이드 】

'게이트 오브 툰'은 AI와의 대화를 통해 당신의 숨겨진 취향을 분석하고, 방대한 데이터 속에서 당신에게 가장 적합한 '인생 웹툰'을 찾아주는 지능형 시스템입니다.

■ 1단계: 당신의 성향 파악하기
- 닉네임 입력: 여정을 함께할 당신의 이름을 알려주세요.
- 사전 질문: AI의 추천 속도와 정확도에 영향을 주는 두 가지 질문에 답변합니다. 당신이 원하는 추천 방식을 AI에게 알려주는 중요한 과정입니다.

■ 2단계: AI와 함께 취향의 문 탐험하기
- AI의 질문: 당신의 성향을 바탕으로, AI가 취향을 더 깊이 파고들기 위한 질문을 시작합니다.
- 선택과 집중: 제시된 두 가지 선택지 중, 당신의 마음에 더 끌리는 쪽을 선택하세요. 당신의 선택은 추천 알고리즘의 핵심 파라미터로 작용하여 후보군을 정밀하게 필터링합니다.
- 실시간 필터링: 화면 상단의 후보 숫자가 줄어드는 것을 보며, 최적의 추천 결과에 얼마나 가까워지고 있는지 직접 확인해보세요!

■ 3단계: 최종 추천 결과 확인
- 최종 추천: 모든 대화가 끝나면, AI는 당신의 취향을 완벽하게 저격하는 단 하나의 웹툰과 그 추천 이유를 제시합니다.
- 또 다른 가능성: 언제든 [분석 재시작] 버튼으로 새로운 여정을 시작하거나, [데이터베이스 조회]를 통해 전체 웹툰 목록을 살펴볼 수 있습니다.
`;

const NOTICES_CONTENT = `
게이트 오브 툰은 즐거운 웹툰 추천 경험을 제공하기 위해 다음 사항을 준수하고 안내합니다.

■ 개인정보 처리방침 (주요 내용)
• 수집 항목: 닉네임, 사전 질문 및 AI 질문에 대한 답변 내용
• 수집 및 이용 목적: 개인 맞춤형 웹툰 추천 서비스 제공
• 보유 및 이용 기간: 서비스 이용 세션 종료 시 즉시 파기. 저희는 여러분의 정보를 저장하지 않습니다.
• 제3자 제공: 수집된 정보는 서비스 제공 목적 외에 어떠한 경우에도 제3자에게 제공되지 않습니다.
• 안전성 확보 조치: 모든 통신은 암호화되며, 데이터는 메모리 상에서만 처리되어 보안을 유지합니다.

■ 서비스 이용약관 (주요 내용)
• 서비스 이용: 본 서비스는 웹툰 추천을 돕기 위한 목적으로 무료로 제공됩니다.
• 이용자의 권리와 의무: 이용자는 서비스를 자유롭게 이용할 수 있으나, 비정상적인 방법으로 서버에 부하를 주거나 악의적인 용도로 사용하는 것은 금지됩니다.
• 서비스 제공자의 권리와 의무: 안정적인 서비스 제공을 위해 노력하며, 부득이한 경우 사전 공지 없이 서비스가 중단되거나 변경될 수 있습니다.
• 면책 조항: 본 서비스가 제공하는 AI 추천 결과는 통계와 분석에 기반한 것으로, 그 정확성이나 만족도를 100% 보장하지는 않습니다. 최종 선택에 대한 책임은 이용자 본인에게 있습니다.

■ AI 사용 안내
• 본 서비스는 추천 과정에 생성형 AI 기술을 사용합니다. AI는 사용자의 답변을 바탕으로 최적의 웹툰을 제안하지만, 그 과정이나 결과에 일부 부정확한 정보가 포함될 수 있습니다.

■ 추가 안내
• 본 서비스는 베타 버전으로, 예고 없이 수정·중단될 수 있습니다.
• 이용자는 본 서비스를 상업적 용도나 자동화 도구(봇 등)로 재활용할 수 없습니다.
`;

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onStart, onShowList, onShowInfo, requestPermission, permissionState }) => {

  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-8 text-center min-h-[60vh] text-white animate-fade-in">
      <h2 className="font-orbitron text-lg text-cyan-400 tracking-widest">[ SYSTEM MESSAGE ]</h2>
      <div className="title-line my-2"></div>
      {/* 🚨 수정: 테두리 효과 클래스를 text-stroke-svg로 변경합니다. */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-black mt-4 mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-purple-400 font-orbitron animate-gradient-x text-stroke-svg">
        GATE OF TOON
      </h1>
      {/* 🚨 수정: 게, 오, 툰 글자를 강조하기 위해 span으로 분리하고 title-highlight 클래스 적용 */}
      <p className="text-lg sm:text-xl text-cyan-200/90 tracking-[0.15em] font-medium mb-6">
        게이트 오브 툰
      </p>
      <p className="text-base md:text-lg text-gray-300 mb-8">사용자 맞춤 웹툰 분석 기능이 활성화 되었습니다.</p>

      <div className="w-full max-w-xs flex flex-col gap-4">
        <button 
          onClick={onStart} 
          className="system-button text-lg py-3 font-black bg-gradient-to-r from-cyan-500/80 to-purple-500/80 !text-white border-cyan-300/50 hover:!text-white hover:border-white/80 hover:shadow-lg hover:shadow-cyan-500/20 transform hover:scale-105 animate-pulse"
        >
          [ 시작하기 ]
        </button>
        <button onClick={() => onShowInfo('사용 방법', HOW_TO_USE_CONTENT)} className="system-button text-sm">
          [ 사용 방법 ]
        </button>
        <button onClick={() => onShowInfo('안내 사항', NOTICES_CONTENT)} className="system-button text-sm">
          [ 안내 사항 ]
        </button>
      </div>

       {permissionState === 'prompt' && (
        <div className="w-full max-w-xs mt-4">
          <button onClick={requestPermission} className="w-full system-button border-purple-500 text-purple-200">
            [ 모션 효과 활성화 ]
          </button>
        </div>
      )}

      <div className="mt-12">
        <button 
          onClick={onShowList} 
          className="system-button border-cyan-700/50 text-cyan-300/70 hover:text-cyan-200 hover:border-cyan-600 text-xs py-2 px-4"
          >
          &lt; 전체 웹툰 데이터베이스 조회 &gt;
        </button>
      </div>
    </div>
  );
};

export default React.memo(WelcomeScreen);