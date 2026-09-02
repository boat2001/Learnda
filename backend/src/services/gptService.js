// services/gptService.js
const logger = require('../config/logger');

const requestJson = async (url, { method = 'GET', headers = {}, body } = {}) => {
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = payload?.error || payload?.message || payload || 'Request failed';
    const error = new Error(message);
    error.response = { status: response.status, data: payload };
    throw error;
  }

  return payload;
};

class LearndaGPT {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.baseUrl = 'https://api.openai.com/v1';
    this.model = process.env.GPT_MODEL || 'gpt-4';
  }

  /**
   * Explain a concept in simple terms
   */
  async explainConcept(topic, depthLevel = 'basic', context = {}) {
    const prompts = {
      basic: `Explain the concept of "${topic}" in very simple terms suitable for a high school student. 
        Use analogies and real-world examples. Keep it to 2-3 paragraphs.`,
      enhanced: `Provide a comprehensive explanation of "${topic}" with some depth. 
        Include key concepts, examples, and why it matters. Structure it with introduction, main points, and conclusion.`,
      advanced: `Provide an in-depth analysis of "${topic}". Include theoretical foundations, practical applications, 
        advanced concepts, common misconceptions, and connections to other areas. Format as a structured guide.`
    };

    try {
      const response = await this.callOpenAI({
        prompt: prompts[depthLevel] || prompts.basic,
        context: context.subject || 'General Knowledge'
      });

      return {
        success: true,
        topic,
        depthLevel,
        explanation: response,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error explaining concept:', error);
      throw error;
    }
  }

  /**
   * Generate a lesson outline/plan
   */
  async generateLesson(topic, duration = 30, targetAudience = 'student') {
    const prompt = `Create a structured lesson plan for teaching "${topic}":
    - Duration: ${duration} minutes
    - Target audience: ${targetAudience}
    - Include: Learning objectives, key points, examples, activities, assessment questions
    - Format as clear sections with bullet points`;

    try {
      const response = await this.callOpenAI({ prompt });

      return {
        success: true,
        topic,
        duration,
        targetAudience,
        lessonPlan: response,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error generating lesson:', error);
      throw error;
    }
  }

  /**
   * Generate quiz questions from a topic
   */
  async generateQuiz(topic, questionCount = 10, difficulty = 'medium') {
    const prompt = `Generate ${questionCount} ${difficulty} quiz questions about "${topic}".
    Format each as:
    Q: [Question]
    A) [Option A]
    B) [Option B]
    C) [Option C]
    D) [Option D]
    Answer: [Correct option letter]
    Explanation: [Why this is correct]`;

    try {
      const response = await this.callOpenAI({ prompt });
      const questions = this.parseQuizResponse(response);

      return {
        success: true,
        topic,
        questionCount,
        difficulty,
        questions,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error generating quiz:', error);
      throw error;
    }
  }

  /**
   * Generate video script for a lesson
   */
  async generateVideoScript(topic, duration = 10, tone = 'educational') {
    const prompt = `Write a video script for a ${duration}-minute video about "${topic}".
    - Tone: ${tone}
    - Include: Introduction hook, main content broken into sections, conclusions, call-to-action
    - Make it engaging and suitable for transcription
    - Format with [VISUALS] notes in brackets
    - Approximate speaking pace: 130 words per minute`;

    try {
      const response = await this.callOpenAI({ prompt });

      return {
        success: true,
        topic,
        duration,
        tone,
        script: response,
        estimatedWordCount: Math.round(duration * 130),
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error generating video script:', error);
      throw error;
    }
  }

  /**
   * Answer student question in context of course
   */
  async answerStudentQuestion(question, courseContext = '', learningLevel = 'intermediate') {
    const prompt = `Answer this student question: "${question}"
    
    Context: ${courseContext || 'General knowledge question'}
    Student level: ${learningLevel}
    
    Provide:
    1. Direct answer
    2. Explanation with examples
    3. Related concepts
    4. Where to learn more`;

    try {
      const response = await this.callOpenAI({ prompt });

      return {
        success: true,
        question,
        answer: response,
        courseContext,
        learningLevel,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error answering student question:', error);
      throw error;
    }
  }

  /**
   * Generate study tips and learning strategies
   */
  async generateStudyGuide(topic, examType = 'exam') {
    const prompt = `Create a comprehensive study guide for "${topic}" for ${examType} preparation:
    - Key concepts to memorize
    - Common pitfalls to avoid
    - Effective study techniques
    - Practice problem strategies
    - Time management tips
    - Recommended resources
    Format as a structured guide with sections`;

    try {
      const response = await this.callOpenAI({ prompt });

      return {
        success: true,
        topic,
        examType,
        studyGuide: response,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error generating study guide:', error);
      throw error;
    }
  }

  /**
   * Generate past question solutions
   */
  async generatePastQuestionSolution(question, questionYear = null) {
    const prompt = `Provide a detailed solution to this past question:
    "${question}"
    ${questionYear ? `Year: ${questionYear}` : ''}
    
    Include:
    1. Step-by-step solution
    2. Key concepts used
    3. Alternative approaches
    4. Common mistakes
    5. Related questions to practice`;

    try {
      const response = await this.callOpenAI({ prompt });

      return {
        success: true,
        question,
        year: questionYear,
        solution: response,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Error generating past question solution:', error);
      throw error;
    }
  }

  /**
   * Core OpenAI API call
   */
  async callOpenAI({ prompt, context = '', temperature = 0.7, maxTokens = 2000 }) {
    try {
      if (!this.apiKey) {
        throw new Error('OPENAI_API_KEY is not configured');
      }

      const payload = await requestJson(
        `${this.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: {
            model: this.model,
            messages: [
              {
                role: 'system',
                content: `You are Learnda GPT, an educational assistant for the Learnda learning platform. 
                Your role is to help students understand concepts, generate learning materials, and guide them 
                through their learning journey. Be clear, concise, and encouraging. Avoid unnecessary jargon.
                ${context ? `Context: ${context}` : ''}`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature,
            max_tokens: maxTokens
          }
        }
      );

      if (payload?.choices && payload.choices[0]) {
        return payload.choices[0].message.content;
      }

      throw new Error('No response from OpenAI');
    } catch (error) {
      logger.error('OpenAI API error:', error.response?.data || error.message);
      throw new Error(`Failed to generate content: ${error.message}`);
    }
  }

  /**
   * Parse quiz response into structured format
   */
  parseQuizResponse(response) {
    const questions = [];
    const questionBlocks = response.split('\nQ:').filter(block => block.trim());

    questionBlocks.forEach((block, index) => {
      const lines = block.split('\n').filter(line => line.trim());
      if (lines.length >= 6) {
        questions.push({
          number: index + 1,
          question: lines[0].replace(/^(\d+\.\s)?/, '').trim(),
          options: {
            A: (lines[1] || '').replace('A)', '').trim(),
            B: (lines[2] || '').replace('B)', '').trim(),
            C: (lines[3] || '').replace('C)', '').trim(),
            D: (lines[4] || '').replace('D)', '').trim()
          },
          correctAnswer: (lines[5] || '').replace('Answer:', '').trim(),
          explanation: (lines[6] || '').replace('Explanation:', '').trim()
        });
      }
    });

    return questions;
  }
}

module.exports = new LearndaGPT();
