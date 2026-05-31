// toon_backend/src/server.js

import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI, ChatSession, GenerativeModel } from '@google/generative-ai';
import { Firestore } from '@google-cloud/firestore';
import { getRecommendation, attachAiTagsAndCache } from './geminiService';
import type { Request, Response } from 'express';

const app = express();
const port = process.env.PORT || 8080; 

// ----------------------------------------------------
// 1. 미들웨어 설정 (CORS 문제 해결)
// ----------------------------------------------------

const FRONTEND_URL = 'https://gate-of-toon.web.app'; 

const corsOptions = {
    origin: FRONTEND_URL, 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json());

// ----------------------------------------------------
// 2. Google 서비스 초기화 (Firestore DB 및 Gemini 안정성 강화)
// ----------------------------------------------------

// Firestore Database ID
const FIRESTORE_DATABASE_ID = 'gateoftoon-datebase';

// Gemini API Key
const GEMINI_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

if (!GEMINI_KEY) {
    console.warn('⚠️ WARNING: Gemini API Key not found. Recommendation feature will fail.');
}

// ✅ 최신 SDK 초기화 방식으로 수정
const genAI = new GoogleGenerativeAI(GEMINI_KEY || ''); 

// Firestore 초기화
const db = new Firestore({ databaseId: FIRESTORE_DATABASE_ID }); 

// ----------------------------------------------------
// [성능 개선] 세션 및 캐시 저장소 초기화
// ----------------------------------------------------

// 사용자별 AI 채팅 세션을 저장하는 인메모리 저장소
const sessionStore = new Map<string, { chat: ChatSession; filterRate: number; candidateIds: string[] }>();

// 웹툰 메타데이터를 저장하는 인메모리 캐시
const webtoonCache = {
    allWebtoonIds: [] as string[],
    webtoonMetadata: new Map<string, any>()
};


// ----------------------------------------------------
// 3. API 엔드포인트 정의
// ----------------------------------------------------

// [MVP] 단일 추천 및 질문 엔드포인트
app.post('/api/recommend', async (req, res) => {
    if (!GEMINI_KEY) {
        console.error('Gemini API call failed: API Key is missing.');
        return res.status(500).send({ error: 'Failed to process AI request: Gemini API Key is missing.' });
    }
    
    // [성능 개선] 요청 본문에서 sessionId를 받습니다.
    const { sessionId, candidateIds, history, message } = req.body;

    if (!message) {
        return res.status(400).send({ error: 'Message is required.' });
    }

    try {
        const resultObject = await getRecommendation(
            db, 
            genAI,
            { sessionId, candidateIds, history: history || [], message },
            sessionStore,
            webtoonCache
        );

        res.status(200).json(resultObject);
        
    } catch (error) {
        console.error('Gemini API call failed:', error); 
        res.status(500).send({ error: 'Failed to process AI request.' });
    }
});

// [MVP] 웹툰 목록 제공 엔드포인트
app.get('/api/webtoons', async (req, res) => {
    try {
        const webtoonsRef = db.collection('webtoons_metadata');
        const snapshot = await webtoonsRef.get();

        if (snapshot.empty) {
            return res.status(200).json([]);
        }
        
        const webtoons = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.set('Cache-Control', 'public, max-age=3600'); 
        res.status(200).json(webtoons);

    } catch (error) {
        console.error('Failed to fetch initial webtoons:', error);
        res.status(500).send({ error: 'Failed to fetch webtoons for display.' });
    }
});

// ----------------------------------------------------
// 4. 서버 시작
// ----------------------------------------------------
app.listen(port, () => {
    console.log(`🚀 Server listening at http://localhost:${port}`);
    // [신규] 서버가 시작되면, 백그라운드에서 AI 태그 부착 및 캐싱 작업을 시작합니다.
    // 이 작업은 사용자 요청을 막지 않습니다.
    attachAiTagsAndCache(db, genAI, webtoonCache);
});
