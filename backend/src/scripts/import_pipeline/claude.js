'use strict';

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-4-6';

function extractJsonText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';

  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (withoutFence.startsWith('{') || withoutFence.startsWith('[')) {
    return withoutFence;
  }

  const objectStart = withoutFence.indexOf('{');
  const objectEnd = withoutFence.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return withoutFence.slice(objectStart, objectEnd + 1);
  }

  return withoutFence;
}

function parseJsonResponse(raw) {
  const jsonText = extractJsonText(raw);
  if (!jsonText) throw new Error('Claude returned an empty response.');
  return JSON.parse(jsonText);
}

async function callClaudeJson(prompt, options = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set.');
  }

  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });
  const model = options.model || process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL;
  const response = await client.messages.create({
    model,
    max_tokens: options.maxTokens || 6000,
    temperature: options.temperature ?? 0.4,
    system: options.system || 'Return only valid JSON. Do not include markdown, code fences, or commentary.',
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const raw = (response.content || [])
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n')
    .trim();

  return {
    raw,
    json: parseJsonResponse(raw),
    model,
    usage: response.usage || null,
  };
}

module.exports = {
  DEFAULT_CLAUDE_MODEL,
  callClaudeJson,
  parseJsonResponse,
};
