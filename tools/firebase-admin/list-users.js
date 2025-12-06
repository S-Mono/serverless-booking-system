const admin = require('firebase-admin');
const serviceAccount = require('../../booking-system-firebase-764d2-firebase-adminsdk-fbsvc-5f79f3985e.json');
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

(async () => {
  try {
    const listUsersResult = await admin.auth().listUsers(100);
    console.log('本番環境のユーザー一覧:\n');
    listUsersResult.users.forEach((userRecord) => {
      console.log('UID:', userRecord.uid);
      console.log('Email:', userRecord.email || '(なし)');
      console.log('Phone:', userRecord.phoneNumber || '(なし)');
      console.log('作成日:', userRecord.metadata.creationTime);
      if (userRecord.customClaims) {
        console.log('カスタムクレーム:', userRecord.customClaims);
      }
      console.log('---');
    });
    process.exit(0);
  } catch (e) {
    console.error('エラー:', e.message);
    process.exit(1);
  }
})();
