import { GoogleGenerativeAI, ChatSession } from "@google/generative-ai";
import { randomUUID } from 'crypto'; // sessionId 생성을 위해 crypto 모듈 임포트
import { Firestore, FieldPath } from "@google-cloud/firestore"; // FieldPath를 명시적으로 임포트합니다.
import * as constants from "./constants";

// 필요한 상수 가져오기
const {
    PSYCHOLOGICAL_TEST_PROMPT, // 이제 prompts.ts에서 가져옵니다.
    MID_TEST_PROMPT, 
    FINAL_RECOMMENDATION_PROMPT, 
    TAG_ATTACHMENT_PROMPT,
    TAG_LIST, // [신규] 태그 목록
    OPPOSITE_TAG_MAP, // [신규] 대칭 태그 맵
    FINAL_CANDIDATE_LIMIT,
    MIN_FILTER_COUNT,
    MIN_STANDARD_TAGS_COUNT, // [신규] 최소 표준 태그 개수
} = constants;

const MODEL_NAME = "gemini-2.5-flash"; // 객관식 MVP에 최적화된 모델

// [수정] 7단계 필터링 비율 정의 (총 점수 2~8점 매핑: 약 20% ~ 35%로 상향 조정하여 5~10회 질문 유도)
const FILTER_RATES: { [key: number]: number } = {
    8: 0.350, // Max Speed / Max Depth (약 5회)
    7: 0.325,
    6: 0.300,
    5: 0.275,
    4: 0.250, // 중간값
    3: 0.225,
    2: 0.200, // Min Speed / Min Depth (약 10회)
};

/**
 * 사용자 메시지에서 필터링 속도 선호도 (총 점수)를 파악하고 필터링 비율을 결정합니다.
 * (초기 호출 시 사용)
 * message는 { nickname: "...", totalScore: 2~8 } JSON 문자열입니다.
 */
function determineFilterRate(message: string): number {
    const defaultRate = FILTER_RATES[2]; // 기본값 (가장 정밀/느린 모드)
    try {
        const initialSetup = JSON.parse(message);
        // totalScore를 문자열로 받을 수 있으므로 parseInt를 사용해 안전하게 변환
        const totalScore = parseInt(initialSetup.totalScore as string, 10) || 0; 
        
        // 점수가 유효 범위(2~8) 내에 있으면 해당 비율 적용
        if (FILTER_RATES[totalScore]) {
            const rate = FILTER_RATES[totalScore];
            console.log(`Determined Filter Rate: Score ${totalScore} -> ${rate * 100}%`);
            return rate;
        } else {
            console.warn(`Invalid totalScore received: ${initialSetup.totalScore}. Defaulting to 30%.`);
        }
    } catch (e: any) {
        console.warn("Initial message not in expected JSON format or missing score. Defaulting to 30%.");
    }
    return defaultRate;
}

/**
 * [신규 함수] Firestore에서 모든 웹툰의 ID와 데이터를 가져옵니다.
 * 첫 호출 시에만 사용됩니다.
 */
async function getOrCacheAllWebtoons(
    db: Firestore,
    webtoonCache: { allWebtoonIds: string[], webtoonMetadata: Map<string, any> }
) {
    // 캐시에 데이터가 있으면 즉시 반환
    if (webtoonCache.allWebtoonIds.length > 0) {
        // AI 태그 부착이 완료되었는지 여부와 상관없이 일단 캐시된 데이터를 반환합니다.
        return webtoonCache; 
    }
 
    console.log("[Cache] Webtoon cache is empty. Fetching from Firestore...");
    const webtoonsSnapshot = await db.collection("webtoons_metadata").get();
    const allWebtoonIds = webtoonsSnapshot.docs.map(doc => doc.id);
    
    const webtoonMetadata = new Map();
 
    webtoonsSnapshot.forEach(doc => {
        const data = doc.data();
        webtoonMetadata.set(doc.id, data);
    });

    // [수정] AI 태그 부착 전의 원본 데이터를 먼저 캐시에 저장합니다.
    webtoonCache.allWebtoonIds = allWebtoonIds;
    webtoonCache.webtoonMetadata = webtoonMetadata;

    console.log(`[Cache] Cached ${allWebtoonIds.length} webtoons.`);
    return webtoonCache;
}

/**
 * [신규] 서버 시작 시 AI를 이용해 모든 웹툰에 표준 태그를 부착하고 캐시를 업데이트합니다.
 * 이 함수는 백그라운드에서 실행됩니다.
 */
export async function attachAiTagsAndCache(
    db: Firestore,
    genAI: GoogleGenerativeAI,
    webtoonCache: { allWebtoonIds: string[], webtoonMetadata: Map<string, any> }
) {
    // 먼저 기본 데이터를 캐시에 로드합니다.
    // 이 함수는 이제 AI 태그 부착 여부와 상관없이 DB의 데이터를 그대로 캐시에 올립니다.
    await getOrCacheAllWebtoons(db, webtoonCache); 

    // [리팩토링] 1. 태그 데이터 검증 및 초기화/재처리 대상 선정
    const docsToReset: string[] = [];
    let invalidCount = 0;

    webtoonCache.webtoonMetadata.forEach((data, id) => {
        if (data.aiTagsProcessed === undefined) {
            // Case 1: 필드가 아예 없는 경우 -> 초기화 대상
            docsToReset.push(id);
        } else if (data.aiTagsProcessed === true) {
            // Case 2: 이미 처리된 경우 -> 데이터 품질 검증
            // [리팩토링] 'standardTags' 필드를 직접 검사합니다.
            const standardTags = data.standardTags || [];
            const validStandardTags = standardTags.filter((tag: string) => TAG_LIST.includes(tag));

            // AI 할루시네이션(잘못된 태그 생성) 또는 태그 부족 검증
            if (validStandardTags.length < MIN_STANDARD_TAGS_COUNT) {
                docsToReset.push(id);
                invalidCount++;
            }
        }
        // Case 3: aiTagsProcessed: false 인 경우는 이미 처리 대상이므로 별도 작업 불필요
    });

    if (docsToReset.length > 0) {
        const initCount = docsToReset.length - invalidCount;
        console.log(`[AI-Tagging] Found ${initCount} new webtoons to initialize and ${invalidCount} webtoons with invalid tags to re-process.`);
        console.log(`[AI-Tagging] Total ${docsToReset.length} webtoons will be set to 'aiTagsProcessed: false'.`);

        const batch = db.batch();
        docsToReset.forEach(id => {
            const docRef = db.collection('webtoons_metadata').doc(id);
            // [리팩토링] 재처리 시 standardTags 필드를 빈 배열로 초기화하여 누적을 방지합니다.
            batch.update(docRef, { aiTagsProcessed: false, standardTags: [] });
            // 메모리 캐시도 즉시 업데이트
            const cachedData = webtoonCache.webtoonMetadata.get(id);
            if (cachedData) {
                webtoonCache.webtoonMetadata.set(id, { ...cachedData, aiTagsProcessed: false }); // 캐시 상태도 false로 동기화
            }
        });
        await batch.commit();
        console.log(`✅ [AI-Tagging] Initialization complete.`);
    }

    // [리팩토링] 2. 'aiTagsProcessed' 필드가 명시적으로 'false'인 모든 문서를 조회하여 태깅을 진행합니다.
    const webtoonsToProcessSnapshot = await db.collection("webtoons_metadata").where('aiTagsProcessed', '==', false).get();

    if (webtoonsToProcessSnapshot.empty) {
        console.log("✅ [AI-Tagging] All webtoons are already processed. No background task needed.");
        return;
    }

    console.log(`[AI-Tagging] Found ${webtoonsToProcessSnapshot.size} webtoons that need tag processing. Starting background task...`);

    // [개선] API 호출량 및 안정성을 위해 50개씩 나누어 처리 (Chunking)
    const CHUNK_SIZE = 50;
    const allDocsToProcess = webtoonsToProcessSnapshot.docs;
    let totalProcessedCount = 0;

    for (let i = 0; i < allDocsToProcess.length; i += CHUNK_SIZE) {
        const chunk = allDocsToProcess.slice(i, i + CHUNK_SIZE);
        console.log(`[AI-Tagging] Processing chunk ${i / CHUNK_SIZE + 1} with ${chunk.length} webtoons...`);

        try {
            let webtoonListForAI = "";
            chunk.forEach(doc => {
                const data = doc.data();
                const summary = data.summary || '';
                webtoonListForAI += `ID: ${doc.id}, Title: ${data.title}, Summary: ${summary}, Tags: [${(data.tags || []).join(', ')}]\n`;
            });

            const taggingPrompt = TAG_ATTACHMENT_PROMPT
                .replace("{tag_list}", `[${TAG_LIST.join(', ')}]`)
                .replace("{webtoon_list}", webtoonListForAI);

            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash", generationConfig: { responseMimeType: "application/json" } });
            const result = await model.generateContent(taggingPrompt);
            const responseText = result.response.text();
            const aiTaggedWebtoons = JSON.parse(responseText);

            const batch = db.batch();
            for (const webtoonId in aiTaggedWebtoons) {
                const docRef = db.collection('webtoons_metadata').doc(webtoonId);
                // 현재 청크에서 원본 데이터를 찾습니다.
                const originalData = chunk.find(doc => doc.id === webtoonId)?.data();
                if (originalData) {
                    // [리팩토링] AI가 생성한 태그를 'standardTags' 필드에 별도로 저장합니다.
                    const newStandardTags = [...new Set(aiTaggedWebtoons[webtoonId] as string[])]; // 중복 제거 및 타입 명시

                    // [신규] 기존 tags 필드에서 표준 태그를 제거하여 원본 태그만 남깁니다.
                    const originalTags = originalData.tags || [];
                    const cleanedOriginalTags = originalTags.filter((tag: string) => !TAG_LIST.includes(tag));

                    // Firestore 문서와 메모리 캐시를 동시에 업데이트합니다.
                    batch.update(docRef, { tags: cleanedOriginalTags, standardTags: newStandardTags, aiTagsProcessed: true });
                    // 캐시 데이터도 정제된 버전으로 업데이트합니다.
                    webtoonCache.webtoonMetadata.set(webtoonId, { ...originalData, tags: cleanedOriginalTags, standardTags: newStandardTags, aiTagsProcessed: true });
                }
            }
            await batch.commit();
            const processedInChunk = Object.keys(aiTaggedWebtoons).length;
            totalProcessedCount += processedInChunk;
            console.log(`✅ [AI-Tagging] Chunk ${i / CHUNK_SIZE + 1} processed. Updated ${processedInChunk} webtoons.`);

        } catch (e) {
            console.error(`❌ [AI-Tagging] Failed to process chunk ${i / CHUNK_SIZE + 1}. Skipping this chunk.`, e);
            // 특정 청크가 실패하더라도 다음 청크는 계속 시도합니다.
        }
    }

    if (totalProcessedCount > 0) {
        console.log(`✅ [AI-Tagging] Background task completed. Successfully processed and updated a total of ${totalProcessedCount} webtoons.`);
    } else if (webtoonsToProcessSnapshot.size > 0) {
        console.warn(`[AI-Tagging] Background task finished, but no webtoons were updated. Please check for errors.`);
    }

}

/**
 * [로직 수정] 특정 웹툰의 추천 횟수(lifeCount)를 1 증가시킵니다.
 * @param db Firestore 인스턴스
 * @param webtoonId 추천 횟수를 증가시킬 웹툰의 문서 ID
 */
async function incrementWebtoonLifeCount(db: Firestore, webtoonId: string) {
    if (!webtoonId) {
        console.error("Failed to increment life count: webtoonId is missing.");
        return 0;
    }
    const docRef = db.collection("webtoons_metadata").doc(webtoonId);

    return db.runTransaction(async (transaction) => {
        const doc = await transaction.get(docRef);
        const currentCount = doc.exists ? doc.data()?.lifeCount || 0 : 0;
        const newCount = currentCount + 1;
        transaction.update(docRef, { lifeCount: newCount });
        return newCount;
    });
}

/**
 * [신규 함수] AI가 생성한 질문의 선택지(options)에서 태그를 기반으로 성좌 멘트를 생성하고,
 * 프론트엔드에 전달할 전체 멘트 목록을 반환합니다.
 * @param nextQuestionData AI가 생성한 next_question 객체
 * @returns 피드백용으로 섞인 전체 멘트 목록
 */
function generateCommentsForOptions(nextQuestionData: any): string[] {
    if (!nextQuestionData || !nextQuestionData.options) {
        return [];
    }

    const allComments: string[] = [];
    nextQuestionData.options.forEach((option: any) => {
        const tags = option.tags || [];

        tags.forEach((tag: string) => {
            const pool = constants.COMMENT_POOL[tag as keyof typeof constants.COMMENT_POOL];
            if (pool) {
                allComments.push(pool.positive[Math.floor(Math.random() * pool.positive.length)]);
                allComments.push(pool.negative[Math.floor(Math.random() * pool.negative.length)]);
            }
        });
        // [수정] 프론트엔드에서 사용하지 않으므로 더 이상 option 객체에 멘트를 할당하지 않습니다.
    });

    // [신규 로직] 범용 멘트 풀에서 멘트를 하나 랜덤하게 선택하여 추가합니다.
    const genericPool = constants.COMMENT_POOL["범용"];
    if (genericPool && (genericPool.positive.length > 0 || genericPool.negative.length > 0)) {
        const allGenericComments = [...genericPool.positive, ...genericPool.negative];
        const randomGenericComment = allGenericComments[Math.floor(Math.random() * allGenericComments.length)];
        allComments.push(randomGenericComment);
    }

    return allComments.sort(() => 0.5 - Math.random()); // 태그 멘트와 범용 멘트를 모두 섞어서 반환
}

/**
 * [신규 함수] AI 응답 파싱 실패 시 프론트엔드에 보낼 비상 응답 객체를 생성합니다.
 * @param sessionId 현재 세션 ID
 * @param candidateIds 현재 후보 웹툰 ID 목록
 * @param filterRate 현재 필터링 비율
 * @param message 프론트엔드에 표시할 오류 메시지
 * @returns 비상 응답 객체
 */
function createEmergencyResponse(
    sessionId: string,
    candidateIds: string[],
    filterRate: number,
    message: string
) {
    return {
        sessionId,
        newCandidateIds: candidateIds,
        isFinal: false,
        filterRate,
        nextQuestion: { question: "AI 응답 오류!", options: [] },
        message,
    };
}
/**
 * 메인 AI 추천 로직 (세션 및 캐시 기반)
 */
export async function getRecommendation(
    db: Firestore,
    genAI: GoogleGenerativeAI,
    requestData: {
        sessionId: string | null;
        candidateIds: string[];
        history: any[];
        message: string;
    },
    sessionStore: Map<string, { chat: ChatSession; filterRate: number; candidateIds: string[] }>,
    webtoonCache: { allWebtoonIds: string[], webtoonMetadata: Map<string, any> }
) {
    const { sessionId, candidateIds, history, message } = requestData;

    // --- 0. 입력값 방어 코드 ---
    // [핵심 버그 수정] 첫 호출 판별 기준을 오직 sessionId의 유무로만 한정합니다.
    // 프론트엔드가 항상 전체 candidateIds를 보내는 현재 상황에서, 다른 조건은 오작동을 유발합니다.
    const isFirstAiQuestionCall = !sessionId; 
    const safeCandidateIds = candidateIds || []; // candidateIds는 이제 항상 전체 목록이므로 그대로 사용합니다.

    // --- 1. 첫 AI 질문 생성 호출 처리 ---
    if (isFirstAiQuestionCall) {
        const newSessionId = randomUUID();
        console.log(`[Session] No sessionId provided. Creating new session: ${newSessionId}`);
        
        let messageObject: any = {};
        try {
            messageObject = JSON.parse(message);
        } catch (e) { /* 무시 */ }

        const filterRate = determineFilterRate(message);

        const { allWebtoonIds } = await getOrCacheAllWebtoons(db, webtoonCache);

        // [성능 개선] 모델 생성 시점에는 시스템 프롬프트를 전달하지 않습니다.
        // 모델은 한 번만 생성되어 재사용되는 것이 가장 효율적입니다.
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: { responseMimeType: "application/json" },
        });

        // [성능 개선] startChat 시점에 시스템 프롬프트를 주입합니다.
        // 이렇게 하면 모델 초기화 시간 없이, 각 사용자의 세션만 빠르게 생성할 수 있습니다.
        const chat = await model.startChat({ 
            history: [{ role: "user", parts: [{ text: PSYCHOLOGICAL_TEST_PROMPT
                .replace("{history_string}", "[]") }] }] 
        });
        // [성능 개선] 생성된 chat 세션과 filterRate를 저장합니다.
        sessionStore.set(newSessionId, { chat, filterRate, candidateIds: allWebtoonIds });

        const result = await chat.sendMessage("이제 심리테스트를 시작하겠습니다. 사용자의 성향을 파악할 첫 질문을 생성해주세요.");
        const responseText = result.response.text().trim();
        console.log("--- Gemini Raw Response (First Call) ---\n", responseText);

        let jsonResponse: any = null;
        try {
            jsonResponse = JSON.parse(responseText);
        } catch (e) {
            console.error("Failed to parse Gemini JSON response (First Call):", responseText, e);
            // 첫 호출부터 실패 시 비상 응답
            return createEmergencyResponse(newSessionId, allWebtoonIds, filterRate, "AI 시스템 초기화에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }

        // [로직 변경] AI가 반환한 태그를 기반으로 성좌 멘트를 생성합니다.
        const firstQuestionData = jsonResponse.next_question;
        // [리팩토링] 멘트 생성 로직을 함수로 분리하여 재사용
        const allCommentsForFirstCall = generateCommentsForOptions(firstQuestionData);

        const nextNumToFilterOnFirstCall = Math.floor(allWebtoonIds.length * filterRate);
        const nextCandidateCountOnFirstCall = allWebtoonIds.length - nextNumToFilterOnFirstCall;

        return {
            sessionId: newSessionId, // [중요] 프론트가 다음 요청에 사용할 세션 ID
            newCandidateIds: allWebtoonIds, // ✅ 전체 ID 목록을 반환
            isFinal: false,
            filterRate: filterRate,
            nextQuestion: firstQuestionData,
            message: "분석 세션이 시작되었습니다. 첫 번째 질문입니다.",
            comments: allCommentsForFirstCall.slice(0, Math.floor(Math.random() * 4) + 5),
            nextCandidateCount: nextCandidateCountOnFirstCall // ✅ 다음 라운드 개수만 미리 계산해서 전달
        };
    }

    // --- 2. 후속 호출 처리 (두 번째 호출부터) ---
    const session = sessionStore.get(sessionId);
    if (!session) {
        // 세션이 만료되었거나 잘못된 ID일 경우, 에러 대신 첫 호출처럼 처리하도록 유도
        console.error(`[Session] Invalid or expired sessionId: ${sessionId}.`);
        // 이 경우 프론트엔드는 sessionId를 null로 하여 다시 요청해야 합니다.
        throw new Error(`Invalid session ID: ${sessionId}. Please start a new session.`);
    }
    console.log(`[Session] Reusing session: ${sessionId}`);

    const { chat, filterRate, candidateIds: currentCandidates } = session;
    // [핵심 버그 수정] history 대신 세션에 저장된 candidateIds를 현재 후보군으로 사용합니다.
    // 이렇게 하면 백엔드가 상태를 온전히 관리하게 되어 안정성이 크게 향상됩니다.
    const currentCandidateCount = currentCandidates.length;

    // --- 3. 최종 추천 확인 (후보가 적을 때) ---
    if (currentCandidateCount <= FINAL_CANDIDATE_LIMIT) {
        // [버그 수정] 프론트에서 받은 safeCandidateIds 대신, 세션에 저장된 현재 후보군의 첫 번째 ID를 사용해야 합니다.
        // 이렇게 해야 AI 추천 실패 시에도 올바른 1위 후보를 추천할 수 있습니다.
        const finalWebtoonId = currentCandidates[0]; 
        const finalWebtoonData = webtoonCache.webtoonMetadata.get(finalWebtoonId);

        // [리팩토링] 최종 추천 단계에서만 webtoonList를 생성합니다.
        let webtoonList = "";
        currentCandidates.forEach(id => {
            const data = webtoonCache.webtoonMetadata.get(id);
            if (data) {
                // AI에 전달하는 데이터 양을 줄이기 위해 ID와 Title만 전달합니다.
                webtoonList += `ID: ${id}, Title: ${data.title}\n`;
            }
        });
        
        let finalPrompt = FINAL_RECOMMENDATION_PROMPT
            .replace("{webtoon_list}", webtoonList)
            .replace("{history_string}", JSON.stringify(history)); // [버그 수정] 최종 추천 시에는 history가 반드시 필요합니다.

        try {
            // [수정] 최종 추천 프롬프트는 history를 포함하므로, 전체 프롬프트를 전달합니다.
            const finalResult = await chat.sendMessage(`${finalPrompt}\n\n위 규칙에 따라 최종 웹툰을 추천해 주세요.`);
            const finalResponseText = finalResult.response.text().trim();
            
            // [디버깅 로그 추가] 최종 추천 단계의 Gemini 원본 응답을 출력합니다.
            console.log("--- Gemini Raw Response (Final) ---\n", finalResponseText);

            const finalJson = JSON.parse(finalResponseText);
            
            // [안정성 강화] AI가 추천한 ID가 후보군에 있는지 확인합니다.
            if (!currentCandidates.includes(finalJson.recommendationId)) {
                console.warn(`AI recommended an ID (${finalJson.recommendationId}) not in the final candidate list. Falling back to the first candidate.`);
                finalJson.id = currentCandidates[0]; // 후보군 첫 번째 ID로 대체
                finalJson.recommendationId = finalJson.id; // 호환성을 위해 유지
                const fallbackData = webtoonCache.webtoonMetadata.get(finalJson.id);
                finalJson.title = fallbackData?.title || "알 수 없는 웹툰";
                finalJson.reason = "죄송합니다. AI 추천에 약간의 오류가 있었습니다. 하지만 지금까지의 기록을 토대로 보면, 이 작품이 당신의 성향과 가장 잘 맞을 것 같네요.";
            }

            // [로직 수정] 전역 카운터가 아닌, 추천된 웹툰의 lifeCount를 1 증가시킵니다.
            const finalCount = await incrementWebtoonLifeCount(db, finalJson.recommendationId);
            
            finalJson.lifeCount = finalCount;

            // [필드명 수정] recommendationId -> id
            // [개선] recommendationId를 삭제하고 id만 사용하도록 통일합니다.
            finalJson.id = finalJson.recommendationId;
            delete finalJson.recommendationId;
            
            return {
                sessionId, // 세션 ID 유지
                newCandidateIds: [finalJson.id],
                isFinal: true,
                filterRate: filterRate,
                finalWebtoonData: finalJson,
                message: finalJson.reason || "최고의 웹툰을 찾았습니다!", // [개선] message 필드는 유지하되, 프론트에서는 finalWebtoonData.reason을 우선적으로 사용하도록 약속합니다.
            };

        } catch (e: any) {
            console.error("Failed during final AI recommendation:", e);
            // [버그 수정] catch 블록을 async로 만들고, 비상 응답 객체를 안전하게 생성합니다.
            // [로직 수정] 비상 상황에서도 1위 후보 웹툰의 lifeCount를 1 증가시킵니다.
            const lifeCount = await incrementWebtoonLifeCount(db, finalWebtoonId);
            const fallbackData = webtoonCache.webtoonMetadata.get(finalWebtoonId) || {};

            return {
                sessionId, // 세션 ID 유지
                newCandidateIds: [finalWebtoonId],
                isFinal: true,
                filterRate: filterRate,
                finalWebtoonData: {
                    id: finalWebtoonId,
                    reason: `죄송합니다. AI 추천 생성 중 오류가 발생했습니다. 하지만 지금까지의 선택을 바탕으로 볼 때, 1순위 후보였던 '${fallbackData.title || '이 웹툰'}'을(를) 강력히 추천합니다.`,
                    title: fallbackData.title || "추천 웹툰",
                    lifeCount: lifeCount
                }
            };
        }
    }


    // --- 4. Mid-Test: AI 랭킹 및 동적 필터링 ---
    // [로직 수정] 프론트에서 message를 객체로 보내므로, JSON.parse 없이 직접 사용합니다.
    const messageObject: any = message;
    const userAnswerText = (typeof messageObject === 'object' && messageObject.text) ? messageObject.text : '';
    const selectedTagsFromClient = new Set<string>((typeof messageObject === 'object' && Array.isArray(messageObject.tags)) ? messageObject.tags : []);

    // [신규] 현재 후보군의 태그 분포를 계산하여 AI에게 전달합니다.
    const tagDistribution: { [key: string]: number } = {};
    currentCandidates.forEach(id => {
        const metadata = webtoonCache.webtoonMetadata.get(id);
        const webtoonTags = metadata?.tags || [];
        webtoonTags.forEach((tag: string) => {
            if (TAG_LIST.includes(tag)) { // 표준 태그만 카운트
                tagDistribution[tag] = (tagDistribution[tag] || 0) + 1;
            }
        });
    });
    // AI가 이해하기 쉬운 문자열 형태로 변환
    const tagDistributionString = Object.entries(tagDistribution)
        .sort(([, a], [, b]) => b - a) // 개수가 많은 순으로 정렬
        .map(([tag, count]) => `${tag}: ${count}개`)
        .join(', ');

    // [핵심 성능 개선] history를 참조하지 않는 새로운 경량 프롬프트를 사용합니다.
    // AI가 과거 기록을 다시 읽지 않도록 하여 처리 시간을 획기적으로 단축합니다.
    const fullUserMessage = MID_TEST_PROMPT
        .replace("{user_answer}", `"${userAnswerText}"`) // [수정] 플레이스홀더 이름 변경
        .replace("{history_string}", JSON.stringify(history))
        .replace("{tag_distribution}", tagDistributionString); // [수정] 플레이스홀더 이름 변경


    const result = await chat.sendMessage(fullUserMessage);
    let responseText = result.response.text().trim();

    // [디버깅 로그 추가] 중간 질문 단계의 Gemini 원본 응답을 출력합니다.
    console.log("--- Gemini Raw Response (Mid-Test) ---\n", responseText);

    let jsonResponse: any = null;
    try {
        jsonResponse = JSON.parse(responseText);
    } catch (e: any) {
        console.error("Failed to parse Gemini JSON response (Mid-Test):", responseText, e);
        return createEmergencyResponse(sessionId, currentCandidates, filterRate, `AI 응답 형식 오류가 발생했습니다. (현재 후보: ${currentCandidateCount}개) 잠시 후 다시 시도해 주세요.`);
    }

    // --- 5. 순위 기반 필터링 로직 ---
    // [로직 개선] AI가 아닌, 클라이언트로부터 직접 받은 selectedTags를 사용합니다.
    const selectedTags = selectedTagsFromClient;
    let rerankedCandidateIds: string[] = [];

    if (selectedTags.size > 0) {
        console.log(`[Re-ranking] with standard tags: ${Array.from(selectedTags).join(', ')}`);

        // 각 웹툰의 '일치 점수'를 계산합니다.
        const scoredCandidates = currentCandidates.map(id => {
            const metadata = webtoonCache.webtoonMetadata.get(id);
            // [리팩토링] 필터링에는 'standardTags' 필드만 사용합니다.
            const webtoonStandardTags = new Set<string>(metadata?.standardTags || []);
            let score = 0;
            
            // [로직 개선] 사용자가 선택한 태그와 일치하면 +1, 대칭 태그를 가지면 -1점을 부여합니다.
            selectedTags.forEach(selectedTag => {
                if (webtoonStandardTags.has(selectedTag)) {
                    score++;
                }
                const oppositeTag = OPPOSITE_TAG_MAP.get(selectedTag);
                if (oppositeTag && webtoonStandardTags.has(oppositeTag)) {
                    score--;
                }
            });
            return { id, score };
        });

        // [신규] 점수 분포를 확인하기 위한 로그를 추가합니다.
        const scoreDistribution: { [key: number]: number } = {};
        scoredCandidates.forEach(candidate => {
            scoreDistribution[candidate.score] = (scoreDistribution[candidate.score] || 0) + 1;
        });
        const distributionLog = Object.entries(scoreDistribution)
            .sort(([scoreA], [scoreB]) => Number(scoreB) - Number(scoreA)) // 점수가 높은 순으로 정렬
            .map(([score, count]) => `${score}점: ${count}개`)
            .join(', ');
        console.log(`[Score Distribution] ${distributionLog}`);

        // 점수가 높은 순으로, 점수가 같다면 원래 순서를 유지하며 정렬합니다.
        scoredCandidates.sort((a, b) => b.score - a.score);
        rerankedCandidateIds = scoredCandidates.map(c => c.id);

    } else {
        // [로그 수정] 클라이언트가 태그를 보내지 않은 경우, 경고를 출력하고 기존 순서를 유지합니다.
        console.warn("[Warning] No tags received from the client. Skipping re-ranking and maintaining current candidate order.");
        rerankedCandidateIds = currentCandidates;
    }

    // [로직 개선] 필터링할 웹툰 개수를 계산하되, 최소 탈락 개수(MIN_FILTER_COUNT)를 보장합니다.
    const calculatedNumToFilter = Math.floor(currentCandidateCount * filterRate);
    const numToFilter = Math.max(calculatedNumToFilter, MIN_FILTER_COUNT);

    // [안정성 강화] 필터링 후 후보가 FINAL_CANDIDATE_LIMIT보다 적어지지 않도록 방지합니다.
    // 예를 들어, 현재 9개 남았고 2개를 필터링해야 할 때, 결과가 7개가 되어 최종 추천으로 넘어가버리는 것을 방지합니다.
    const finalNumToFilter = (currentCandidateCount > FINAL_CANDIDATE_LIMIT && currentCandidateCount - numToFilter < FINAL_CANDIDATE_LIMIT) ? currentCandidateCount - FINAL_CANDIDATE_LIMIT : numToFilter;
    
    // 상위 웹툰 ID만 남깁니다.
    const newCandidateIds = rerankedCandidateIds.slice(0, currentCandidateCount - finalNumToFilter);
    const newCandidateCount = newCandidateIds.length;

    // [핵심 버그 수정] 세션에 저장된 candidateIds를 새로운 필터링 결과로 업데이트합니다.
    session.candidateIds = newCandidateIds;
    
    // --- 6. 프론트엔드 피드백용 코멘트 생성 ---
    const nextQuestionData = jsonResponse.next_question;    
    const feedbackComments = generateCommentsForOptions(nextQuestionData);

    console.log(`[Filter Log] Rate: ${filterRate*100}%, Total: ${currentCandidateCount}, Filtered out: ${finalNumToFilter}, Remaining: ${newCandidateCount}`);
    
    // 다음 단계로 전환
    // 5에서 8 사이의 랜덤한 개수의 코멘트를 전달합니다.
    const commentCountToSend = Math.floor(Math.random() * 4) + 5; // 5, 6, 7, 8 중 하나

    // [안정성 강화] 다음 호출 시 필터링 후 남게 될 후보의 개수를 미리 계산하여 프론트엔드에 전달합니다.
    // 이렇게 하면 프론트엔드의 연출과 백엔드의 실제 로직 간의 불일치를 방지할 수 있습니다.
    const nextNumToFilter = Math.floor(newCandidateCount * filterRate);
    const nextCandidateCount = newCandidateCount - nextNumToFilter;
    // [신규] 다음 질문이 마지막 질문인지 여부를 명시적으로 전달합니다.
    // [버그 수정] '다음' 후보가 아닌, '현재' 필터링된 후보 수를 기준으로 마지막 질문인지 판단해야 합니다.
    const isLastQuestion = newCandidateCount <= FINAL_CANDIDATE_LIMIT;

    return {
        sessionId, // [중요] 세션 ID를 계속 전달
        newCandidateIds: newCandidateIds, // 축소된 ID 목록
        isFinal: false,
        filterRate: filterRate,
        isLastQuestion: isLastQuestion, // [필드 추가] 마지막 질문 여부
        nextQuestion: nextQuestionData,
        message: `${newCandidateCount}개의 후보가 남았습니다. 다음 질문입니다.`,
        comments: feedbackComments.slice(0, commentCountToSend),
        // [필드 추가] 다음 필터링 후 남을 후보의 개수를 명시적으로 전달합니다.
        // 프론트엔드는 이 값을 사용하여 필터링 애니메이션을 연출합니다.
        nextCandidateCount: nextCandidateCount 
    };
}
