require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
    origin: 'https://api-testengine.netlify.app'
}));

app.use(express.json());

const modelName = 'gemini-2.5-flash';
const geminiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
  process.env.GEMINI_API_KEY_5
];

let apiCallCount = 0;
function getApiKey() {
  const index = Math.floor(apiCallCount / 1000);
  apiCallCount++;
  return geminiKeys[index % geminiKeys.length];
}

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_JSON, 'base64').toString('utf8')
);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Verify Firebase token middleware
async function verifyFirebaseToken(req, res, next) {
  const idToken = req.headers.authorization?.split(' ')[1];
  if (!idToken) return res.status(401).json({ error: 'No token provided' });

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    req.user = decodedToken; // contains uid, email, etc.
    next();
  } catch (err) {
    console.error('Firebase token verification error:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Quiz route
app.post('/generate-quiz', verifyFirebaseToken, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const prompt = `Generate 5 quiz questions. Structure exactly as:
  ''<Question>''
  --<option1>--
  --<option2>--
  --<option3>--
  --<option4>--
  --<correct option among 4>--
  Make sure total questions are 5 no less no more
  <====Question Starts==
  ${content}
  ==Question Ends====>`;

  try {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });
    const result = await ai.models.generateContent({ model: modelName, contents: prompt });
    res.json({ response: result.text });
  } catch (err) {
    console.error('Quiz generation error:', err);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

app.listen(port, () => console.log(`🚀 Quiz Server running at http://localhost:${port}`));
