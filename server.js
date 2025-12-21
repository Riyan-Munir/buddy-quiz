require('dotenv').config();
const express = require('express');
const cors = require('cors');
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
  process.env.GEMINI_API_KEY_3, // keep only first 3 keys
];

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
    req.user = decodedToken;
    next();
  } catch (err) {
    console.error('Firebase token verification error:', err.message);
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// Function to try sending request with retries
async function generateQuizWithRetries(prompt) {
  for (let i = 0; i < geminiKeys.length; i++) {
    const apiKey = geminiKeys[i];
    const ai = new GoogleGenAI({ apiKey });
    try {
      const result = await ai.models.generateContent({ model: modelName, contents: prompt });
      return result.text;
    } catch (err) {
      console.error(`API key ${i + 1} failed:`, err.message);
      // continue to next key
    }
  }
  throw new Error('All API keys failed to generate quiz');
}

// Quiz route
app.post('/generate-quiz', verifyFirebaseToken, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });

  const prompt = `Generate exactly 5 quiz questions based **only** on the given topic. Do not use any related or external topics. Structure each question exactly like this:

  ''<Question>''
  --<option1>--
  --<option2>--
  --<option3>--
  --<option4>--
  --<correct option among 4>--

Make sure:
- There are exactly 5 questions.
- Follow the format strictly.
- All questions come only from the content below.

<====Question Starts====
${content}
====Question Ends====>`;

  try {
    const responseText = await generateQuizWithRetries(prompt);
    res.json({ response: responseText });
  } catch (err) {
    console.error('Quiz generation failed with all keys:', err.message);
    res.status(500).json({ error: 'Failed to generate quiz with all API keys' });
  }
});

app.listen(port, () => console.log(`🚀 Quiz Server running at http://localhost:${port}`));
