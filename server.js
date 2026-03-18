/**
 * Learnify AI Backend Server
 * Handles quiz generation, revision chat, and study planner updates
 */

const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

// Configure CORS for production and development
const corsOptions = {
  origin: [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://learnify-react.vercel.app',
    'https://learnify-cap.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' })); // Increase limit for large materials

const API_BASE = '/api';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
// Note: We use direct API calls in functions instead of this model instance

// ============ Mock Data ============
const quizzes = {
  mathematics: {
    id: 'quiz_math_001',
    topicId: 'mathematics',
    title: 'Mathematics Quiz',
    description: 'Test your math skills',
    questions: [
      {
        id: 'q1',
        text: 'What is 2 + 2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
      },
      {
        id: 'q2',
        text: 'What is 10 × 5?',
        options: ['40', '50', '60', '70'],
        correctAnswer: '50',
      },
      {
        id: 'q3',
        text: 'What is 100 ÷ 4?',
        options: ['20', '25', '30', '35'],
        correctAnswer: '25',
      },
    ],
  },
  physics: {
    id: 'quiz_physics_001',
    topicId: 'physics',
    title: 'Physics Quiz',
    description: 'Test your physics knowledge',
    questions: [
      {
        id: 'q1',
        text: 'What is the SI unit of force?',
        options: ['Joule', 'Newton', 'Watt', 'Pascal'],
        correctAnswer: 'Newton',
      },
      {
        id: 'q2',
        text: 'What is the speed of light?',
        options: ['3×10^8 m/s', '3×10^6 m/s', '3×10^10 m/s', '3×10^5 m/s'],
        correctAnswer: '3×10^8 m/s',
      },
    ],
  },
  chemistry: {
    id: 'quiz_chemistry_001',
    topicId: 'chemistry',
    title: 'Chemistry Quiz',
    description: 'Test your chemistry knowledge',
    questions: [
      {
        id: 'q1',
        text: 'What is the atomic number of Carbon?',
        options: ['4', '6', '8', '12'],
        correctAnswer: '6',
      },
      {
        id: 'q2',
        text: 'What is the chemical formula for water?',
        options: ['H2O', 'CO2', 'O2', 'H2O2'],
        correctAnswer: 'H2O',
      },
    ],
  },
};

const hints = {
  mathematics: [
    'Remember to follow the order of operations (PEMDAS)',
    'Break down complex problems into smaller steps',
    'Double-check your calculations',
  ],
  physics: [
    'Always include units in your answers',
    'Draw diagrams to visualize the problem',
    'Review the fundamental laws of motion',
  ],
  chemistry: [
    'Balance your chemical equations',
    'Remember the periodic table',
    'Consider electron configurations',
  ],
};

// ============ Routes ============

/**
 * POST /api/quiz/generate
 * Generate exam from materials using AI
 */
app.post(`${API_BASE}/quiz/generate`, async (req, res) => {
  try {
    const { materials, subject } = req.body;

    if (!materials || !Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        error: true,
        message: 'Materials array is required',
        code: 'INVALID_REQUEST',
      });
    }

    // Generate quiz using AI
    const quiz = await generateExamFromMaterials(subject || 'General', materials);
    
    res.json({
      success: true,
      questions: quiz.questions,
      metadata: {
        subject: subject,
        materialsCount: materials.length,
        generatedAt: new Date().toISOString(),
        aiGenerated: true
      }
    });
  } catch (error) {
    console.error('Error generating exam:', error);
    res.status(500).json({
      error: true,
      message: 'Failed to generate exam',
      code: 'GENERATION_ERROR',
      details: error.message
    });
  }
});

/**
 * Generate exam questions from materials using Gemini AI
 */
async function generateExamFromMaterials(subject, materials) {
  // Generate a unique seed for randomization
  const timestamp = Date.now();
  const randomSeed = Math.floor(Math.random() * 10000);
  
  // Combine all materials content with full details
  let combinedContent = `You are creating an exam for: ${subject}\n\n`;
  combinedContent += `STUDY MATERIALS PROVIDED BY STUDENT:\n`;
  combinedContent += `====================================\n\n`;
  
  materials.forEach((material, index) => {
    combinedContent += `📚 LESSON ${material.lessonNumber}: ${material.title}\n`;
    combinedContent += `Content Type: ${material.type}\n`;
    combinedContent += `---CONTENT START---\n`;
    if (material.content) {
      // Use full content without truncation
      combinedContent += `${material.content}\n`;
    }
    combinedContent += `---CONTENT END---\n\n`;
  });

  combinedContent += `\n🎯 EXAM CREATION INSTRUCTIONS:

You are an expert teacher creating an exam based EXCLUSIVELY on the study materials above.

📋 STRICT REQUIREMENTS:
1. Read through ALL the content provided above carefully
2. Create questions that test understanding of the SPECIFIC information in these materials
3. DO NOT use any external knowledge - only what's written in the materials
4. Each question must be directly answerable from the content above
5. Use the exact terms, names, numbers, and concepts from the materials
6. Reference specific examples, cases, or scenarios mentioned in the content

🎯 QUESTION TYPES TO CREATE:
- Definition questions: "What is [term mentioned in materials]?"
- Factual questions: About specific numbers, dates, names mentioned
- Comprehension questions: About concepts explained in the materials
- Application questions: Using examples from the materials
- Fill-in-the-blank: From actual sentences in the materials

📚 CONTENT ANALYSIS:
Before creating questions, identify:
- Key terms and definitions in the materials
- Important facts, numbers, and statistics
- Main concepts and theories discussed
- Specific examples and case studies mentioned
- Names of people, places, or things referenced

⚠️ CRITICAL RULES:
- Every question must quote or reference something specific from the materials
- Wrong answer options should be plausible but clearly different from correct answers
- Use terminology exactly as it appears in the student's materials
- If a concept is explained in the materials, ask about that specific explanation
- Make questions that prove the student actually read and understood the materials

🎲 RANDOMIZATION SEED: ${randomSeed}-${timestamp}
Generate 10 unique questions that thoroughly test knowledge of the provided materials.

REQUIRED JSON FORMAT (no extra text):
{
  "questions": [
    {
      "question": "Question based on specific content from materials",
      "options": ["Correct answer from materials", "Wrong option 1", "Wrong option 2", "Wrong option 3"],
      "correct": 0
    }
  ]
}

Generate exactly 10 questions now:`;

  try {
    // Use OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'HTTP-Referer': 'https://learnify-app.com',
        'X-Title': 'Learnify AI Tutor'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: combinedContent
        }],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const openaiData = await response.json();
    const text = openaiData.choices[0].message.content;
    console.log('AI Response received, parsing...');
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text;
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1];
    }
    
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const quizData = JSON.parse(jsonMatch[0]);
      
      // Validate and format questions
      if (quizData.questions && Array.isArray(quizData.questions)) {
        console.log(`✅ Generated ${quizData.questions.length} unique questions from materials (Seed: ${randomSeed})`);
        return {
          questions: quizData.questions.map((q, index) => ({
            question: q.question || q.text || 'Question not available',
            options: q.options || [],
            correct: typeof q.correct === 'number' ? q.correct : 0
          }))
        };
      }
    }
    
    throw new Error('Could not parse AI response into valid quiz format');
  } catch (error) {
    console.error('AI Error:', error.response?.data || error.message);
    
    // Return error if AI fails - no fallback generation
    throw new Error(`AI service is currently unavailable. Please try again later or check your internet connection.`);
  }
}

/**
 * GET /api/quizzes/topic/:topicId
 * Fetch quiz for a specific topic
 */
app.get(`${API_BASE}/quizzes/topic/:topicId`, async (req, res) => {
  try {
    const { topicId } = req.params;
    const { materials } = req.query; // Get materials from query params
    
    // Convert to lowercase for matching
    const normalizedTopicId = topicId.toLowerCase();

    // If materials are provided, generate quiz using AI
    if (materials) {
      try {
        const materialsData = JSON.parse(materials);
        const generatedQuiz = await generateQuizFromMaterials(topicId, materialsData);
        return res.json(generatedQuiz);
      } catch (aiError) {
        console.error('AI generation failed, falling back to default quiz:', aiError);
        // Fall back to default quiz if AI fails
      }
    }

    // Default quiz fallback
    const quiz = quizzes[normalizedTopicId];

    if (!quiz) {
      return res.status(404).json({
        error: true,
        message: 'Quiz not found for this topic',
        code: 'QUIZ_NOT_FOUND',
      });
    }

    res.json(quiz);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * POST /api/quizzes/submit
 * Submit quiz answers and get score
 */
app.post(`${API_BASE}/quizzes/submit`, (req, res) => {
  try {
    const { topicId, answers } = req.body;

    if (!topicId || !answers) {
      return res.status(400).json({
        error: true,
        message: 'Missing topicId or answers',
        code: 'INVALID_REQUEST',
      });
    }

    // Convert to lowercase for matching
    const normalizedTopicId = topicId.toLowerCase();
    const quiz = quizzes[normalizedTopicId];
    if (!quiz) {
      return res.status(404).json({
        error: true,
        message: 'Quiz not found',
        code: 'QUIZ_NOT_FOUND',
      });
    }

    // Grade the quiz
    let score = 0;
    const detailedResults = [];

    quiz.questions.forEach((question) => {
      const userAnswer = answers[question.id];
      const isCorrect = userAnswer === question.correctAnswer;

      if (isCorrect) score++;

      detailedResults.push({
        questionId: question.id,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
      });
    });

    const percentage = Math.round((score / quiz.questions.length) * 100);
    let feedback = '';

    if (percentage >= 80) {
      feedback = 'Excellent! You have a strong understanding of this topic.';
    } else if (percentage >= 60) {
      feedback = 'Good effort! Review the material and try again to improve.';
    } else {
      feedback = 'Keep practicing! Focus on the areas where you struggled.';
    }

    res.json({
      score,
      total: quiz.questions.length,
      percentage,
      feedback,
      detailedResults,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * POST /api/revision/chat
 * Get AI response for revision chat
 */
app.post(`${API_BASE}/revision/chat`, async (req, res) => {
  console.log('📝 Revision chat request received:', req.body);
  
  try {
    const { topicId, question, materials, conversationHistory } = req.body;

    if (!topicId || !question) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        error: true,
        message: 'Missing topicId or question',
        code: 'INVALID_REQUEST',
      });
    }

    console.log('🤖 Processing chat request for:', topicId, question);

    // Build context from materials if available
    let context = `You are a helpful AI tutor for the subject: ${topicId}\n\n`;
    
    if (materials && materials.length > 0) {
      context += `STUDENT'S STUDY MATERIALS:\n`;
      context += `========================\n\n`;
      materials.forEach((material) => {
        context += `Lesson ${material.lessonNumber}: ${material.title}\n`;
        if (material.content) {
          context += `${material.content.substring(0, 2000)}\n\n`;
        }
      });
      context += `\n`;
    }

    // Add conversation history for context
    if (conversationHistory && conversationHistory.length > 0) {
      context += `CONVERSATION HISTORY:\n`;
      context += `===================\n`;
      conversationHistory.slice(-4).forEach((msg) => {
        context += `${msg.isUser ? 'Student' : 'Tutor'}: ${msg.text}\n`;
      });
      context += `\n`;
    }

    context += `STUDENT'S QUESTION: ${question}\n\n`;
    context += `Please provide a helpful, clear, and educational response. 
- If the question is about content from the materials, reference specific details
- Explain concepts clearly and provide examples
- Encourage the student to think critically
- Be supportive and motivating
- Keep responses concise but informative (2-4 sentences)

Your response:`;

    console.log('🚀 Calling OpenRouter AI...');

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'HTTP-Referer': 'https://learnify-app.com',
        'X-Title': 'Learnify AI Tutor'
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [{
          role: 'user',
          content: context
        }],
        temperature: 0.7,
        max_tokens: 1024
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const openaiData = await response.json();
    console.log('✅ AI Response received');
    const aiResponse = openaiData.choices[0].message.content;

    res.json({
      response: aiResponse.trim(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Chat AI Error:', error.response?.data || error.message);
    res.status(500).json({
      error: true,
      message: 'Failed to get AI response',
      code: 'AI_ERROR',
      details: error.message
    });
  }
});

/**
 * POST /api/revision/hint
 * Get AI hint for revision
 */
app.post(`${API_BASE}/revision/hint`, (req, res) => {
  try {
    const { topicId, question, lessonId } = req.body;

    if (!topicId || !question) {
      return res.status(400).json({
        error: true,
        message: 'Missing topicId or question',
        code: 'INVALID_REQUEST',
      });
    }

    // Get random hint for the topic (normalize to lowercase)
    const normalizedTopicId = topicId.toLowerCase();
    const topicHints = hints[normalizedTopicId] || hints.mathematics;
    const randomHint = topicHints[Math.floor(Math.random() * topicHints.length)];

    // If there's a specific lesson, make the response more targeted
    let response = `Based on your question "${question}", here's a hint: ${randomHint}\n\nTry to think about the fundamental concepts and work through the problem step by step.`;
    
    if (lessonId) {
      response = `Based on the selected lesson and your question "${question}", here's a targeted hint: ${randomHint}\n\nReview the lesson content and try to connect the concepts together.`;
    }

    res.json({
      response,
      hint: randomHint,
      resources: [],
      lessonSpecific: !!lessonId
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * POST /api/planner/update
 * Update study planner based on quiz score
 */
app.post(`${API_BASE}/planner/update`, (req, res) => {
  try {
    const { topicId, score, plannerData } = req.body;

    if (!topicId || score === undefined || !plannerData) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields',
        code: 'INVALID_REQUEST',
      });
    }

    let recommendation = '';
    let adjustments = {};
    let updatedPlannerData = { ...plannerData };

    if (score >= 80) {
      recommendation = 'High score! You are doing well. Consider moving to the next topic.';
      adjustments = {
        studyTimeReduction: 10,
        lessonsToAdd: 2,
      };
      updatedPlannerData.completed = Math.min(
        plannerData.total,
        plannerData.completed + 2
      );
    } else if (score >= 60) {
      recommendation = 'Good effort! Keep practicing to improve further.';
      adjustments = {
        studyTimeReduction: 0,
        lessonsToAdd: 0,
      };
    } else {
      recommendation = 'You need more practice. Schedule extra revision sessions.';
      adjustments = {
        studyTimeIncrease: 15,
        lessonsToReview: 2,
      };
      updatedPlannerData.completed = Math.max(0, plannerData.completed - 1);
    }

    updatedPlannerData.lastQuizDate = new Date().toISOString();
    updatedPlannerData.grade = score;

    res.json({
      updated: true,
      recommendation,
      adjustments,
      updatedPlannerData,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
      code: 'SERVER_ERROR',
    });
  }
});

/**
 * GET /api/topics/subject/:subjectId
 * Get all topics for a subject
 */
app.get(`${API_BASE}/topics/subject/:subjectId`, (req, res) => {
  try {
    const { subjectId } = req.params;

    const topics = {
      mathematics: [
        {
          id: 'algebra',
          name: 'Algebra',
          description: 'Learn algebraic equations and expressions',
          difficulty: 'beginner',
          estimatedTime: 120,
        },
        {
          id: 'geometry',
          name: 'Geometry',
          description: 'Explore shapes, angles, and spatial reasoning',
          difficulty: 'intermediate',
          estimatedTime: 150,
        },
      ],
      physics: [
        {
          id: 'mechanics',
          name: 'Mechanics',
          description: 'Study motion, forces, and energy',
          difficulty: 'intermediate',
          estimatedTime: 180,
        },
      ],
      chemistry: [
        {
          id: 'atoms',
          name: 'Atoms and Molecules',
          description: 'Understand atomic structure and bonding',
          difficulty: 'beginner',
          estimatedTime: 120,
        },
      ],
    };

    const subjectTopics = topics[subjectId];
    if (!subjectTopics) {
      return res.status(404).json({
        error: true,
        message: 'Subject not found',
        code: 'SUBJECT_NOT_FOUND',
      });
    }

    res.json({
      subjectId,
      subjectName: subjectId.charAt(0).toUpperCase() + subjectId.slice(1),
      topics: subjectTopics,
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message,
      code: 'SERVER_ERROR',
    });
  }
});

// Health check
app.get(`${API_BASE}/health`, (req, res) => {
  res.json({ status: 'ok', message: 'Learnify backend is running' });
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Learnify AI Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      generateExam: 'POST /api/quiz/generate',
      revisionChat: 'POST /api/revision/chat',
      documentation: 'https://github.com/your-repo/learnify-backend'
    }
  });
});

// ============ Start Server ============
const PORT = process.env.PORT || 5000;

// For Vercel deployment
if (process.env.NODE_ENV === 'production') {
    module.exports = app;
} else {
    app.listen(PORT, () => {
        console.log(`🚀 Learnify backend running on http://localhost:${PORT}`);
        console.log(`📚 API base: http://localhost:${PORT}${API_BASE}`);
    });
}
