import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore, Timestamp } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';

let _adminApp: App | undefined;
let _firestoreDb: Firestore | undefined;

function initializeFirebaseAdmin() {
    if (_adminApp && _firestoreDb) {
        return { app: _adminApp, db: _firestoreDb };
    }

    const existingApps = getApps();

    if (existingApps.length > 0) {
        _adminApp = existingApps[0];
    } else {
        try {
            // First try environment variables (Vercel Production)
            if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
                // Formatting the private key to ensure newlines are parsed correctly
                const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
                
                _adminApp = initializeApp({
                    credential: cert({
                        projectId: process.env.FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: privateKey,
                    }),
                });
            } else {
                // Fallback to local serviceAccountKey.json (Local Development)
                const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
                if (fs.existsSync(serviceAccountPath)) {
                    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
                    _adminApp = initializeApp({
                        credential: cert(serviceAccount),
                    });
                } else {
                    _adminApp = initializeApp();
                }
            }
        } catch (error) {
            console.error('Failed to initialize Firebase Admin:', error);
            throw error;
        }
    }

    if (!_firestoreDb) {
        _firestoreDb = getFirestore(_adminApp);
    }

    return { app: _adminApp, db: _firestoreDb };
}

const { app: initializedApp, db: initializedDb } = initializeFirebaseAdmin();

export const adminApp = initializedApp;
export const adminDb = initializedDb;
export { Timestamp };
