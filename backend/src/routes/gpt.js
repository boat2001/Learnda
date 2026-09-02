// routes/gpt.js
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../middleware/auth');
const gptService = require('../services/gptService');
const logger = require('../config/logger');

/**
 * Explain a concept
 * POST /gpt/explain
 * Body: { topic, depthLevel: 'basic|enhanced|advanced', subject? }
 */
router.post('/explain', optionalAuth, async (req, res) => {
  try {
    const { topic, depthLevel = 'basic', subject } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const explanation = await gptService.explainConcept(topic, depthLevel, { subject });

    res.json({
      success: true,
      data: explanation
    });
  } catch (error) {
    logger.error('GPT explain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate lesson plan
 * POST /gpt/lesson
 * Body: { topic, duration?: 30, targetAudience?: 'student' }
 */
router.post('/lesson', optionalAuth, async (req, res) => {
  try {
    const { topic, duration = 30, targetAudience = 'student' } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const lesson = await gptService.generateLesson(topic, duration, targetAudience);

    res.json({
      success: true,
      data: lesson
    });
  } catch (error) {
    logger.error('GPT lesson generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate quiz questions
 * POST /gpt/quiz
 * Body: { topic, questionCount?: 10, difficulty?: 'easy|medium|hard' }
 */
router.post('/quiz', optionalAuth, async (req, res) => {
  try {
    const { topic, questionCount = 10, difficulty = 'medium' } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const quiz = await gptService.generateQuiz(topic, questionCount, difficulty);

    res.json({
      success: true,
      data: quiz
    });
  } catch (error) {
    logger.error('GPT quiz generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate video script
 * POST /gpt/script
 * Body: { topic, duration?: 10, tone?: 'educational|casual|formal' }
 */
router.post('/script', optionalAuth, async (req, res) => {
  try {
    const { topic, duration = 10, tone = 'educational' } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const script = await gptService.generateVideoScript(topic, duration, tone);

    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    logger.error('GPT script generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Answer student question
 * POST /gpt/question
 * Body: { question, courseContext?, learningLevel?: 'beginner|intermediate|advanced' }
 */
router.post('/question', optionalAuth, async (req, res) => {
  try {
    const { question, courseContext, learningLevel = 'intermediate' } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    const answer = await gptService.answerStudentQuestion(question, courseContext, learningLevel);

    res.json({
      success: true,
      data: answer
    });
  } catch (error) {
    logger.error('GPT question answer error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate study guide
 * POST /gpt/study-guide
 * Body: { topic, examType?: 'exam|assignment|project' }
 */
router.post('/study-guide', optionalAuth, async (req, res) => {
  try {
    const { topic, examType = 'exam' } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        error: 'Topic is required'
      });
    }

    const guide = await gptService.generateStudyGuide(topic, examType);

    res.json({
      success: true,
      data: guide
    });
  } catch (error) {
    logger.error('GPT study guide error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Generate past question solution
 * POST /gpt/past-question-solution
 * Body: { question, questionYear? }
 */
router.post('/past-question-solution', optionalAuth, async (req, res) => {
  try {
    const { question, questionYear } = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    const solution = await gptService.generatePastQuestionSolution(question, questionYear);

    res.json({
      success: true,
      data: solution
    });
  } catch (error) {
    logger.error('GPT past question solution error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
