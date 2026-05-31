// [수정] 1회성으로 실행하여 모든 웹툰의 AI 태그 처리 상태를 초기화하는 스크립트

import { Firestore } from '@google-cloud/firestore';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// --- 1. 서비스 초기화 ---
const FIRESTORE_DATABASE_ID = 'gateoftoon-datebase';
const db = new Firestore({ databaseId: FIRESTORE_DATABASE_ID });

/**
 * 모든 웹툰 문서의 'aiTagsProcessed' 필드를 false로 설정하여,
 * 다음 서버 시작 시 AI 태그 부착 작업이 다시 실행되도록 강제합니다.
 */
async function resetTaggingStatus() {
    console.log('🚀 Starting to reset AI tag processing status for all webtoons...');

    // --- 1. Firestore에서 모든 웹툰 데이터 가져오기 ---
    const webtoonsSnapshot = await db.collection("webtoons_metadata").get();
    if (webtoonsSnapshot.empty) {
        console.log('No webtoons found in the database.');
        return;
    }
    console.log(`✅ Found ${webtoonsSnapshot.size} webtoons to reset.`);

    // --- 2. Firestore에 일괄 업데이트 ---
    try {
        console.log('🔥 Preparing to update Firestore documents to set "aiTagsProcessed: false"...');
        const batch = db.batch();

        webtoonsSnapshot.forEach(doc => {
            const docRef = db.collection('webtoons_metadata').doc(doc.id);
            // 'aiTagsProcessed'를 false로, 'standardTags'를 빈 배열로 초기화합니다.
            batch.update(docRef, { aiTagsProcessed: false, standardTags: [] });
        });

        await batch.commit();
        console.log(`🎉 Successfully reset ${webtoonsSnapshot.size} webtoons. Next server start will trigger AI tagging.`);

    } catch (e) {
        console.error('❌ An error occurred while resetting the tagging status:', e);
    }
}

// 스크립트 실행
resetTaggingStatus();