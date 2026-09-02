export const DISCUSSION_CONFIG = {
  discussion: {
    label: 'Discussion',
    shortLabel: 'Discussion',
    boardLabel: 'Discussion on this chunk',
    composeLabel: 'Post',
    replyLabel: 'Reply',
    placeholder: 'Write your message...',
    emptyTitle: 'No discussion yet',
    emptyCopy: 'Start the discussion around this lesson chunk.',
  },
  question: {
    label: 'Ask A Question',
    shortLabel: 'Question',
    boardLabel: 'Questions on this chunk',
    composeLabel: 'Ask Question',
    replyLabel: 'Answer',
    placeholder: 'Ask your question...',
    emptyTitle: 'No questions yet',
    emptyCopy: 'Start the first discussion around this lesson chunk or concept.',
  },
  comment: {
    label: 'Give A Comment',
    shortLabel: 'Comment',
    boardLabel: 'Comments on this chunk',
    composeLabel: 'Post Comment',
    replyLabel: 'Reply',
    placeholder: 'Write your comment...',
    emptyTitle: 'No comments yet',
    emptyCopy: 'Share a quick insight, reaction, or study note with other learners.',
  },
  error: {
    label: 'Report An Error',
    shortLabel: 'Error report',
    boardLabel: 'Reports on this chunk',
    composeLabel: 'Send Report',
    replyLabel: 'Comment',
    placeholder: 'Report your issue...',
    emptyTitle: 'No error reports yet',
    emptyCopy: 'Flag unclear wording, content issues, or broken illustrations here.',
  },
};

export const DISCUSSION_TYPES = ['question', 'comment', 'error'];

export const createEmptyDiscussionBoards = () => ({
  question: [],
  comment: [],
  error: [],
});

export const getReplySummaryLabel = (type, count) => {
  const total = Number(count || 0);
  if (type === 'question') return `${total} ${total === 1 ? 'answer' : 'answers'}`;
  return `${total} ${total === 1 ? 'reply' : 'replies'}`;
};

export const getDiscussionSummary = (type, entries = []) => {
  const itemCount = entries.length;
  const replyCount = entries.reduce((total, entry) => total + (entry.replies?.length || 0), 0);

  if (type === 'discussion') {
    const questionCount = entries.filter((entry) => entry.discussionType === 'question').length;
    const commentCount = entries.filter((entry) => entry.discussionType !== 'question').length;
    return `${itemCount} messages • ${questionCount} ${questionCount === 1 ? 'question' : 'questions'} • ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;
  }
  if (type === 'question') {
    return `${itemCount} ${itemCount === 1 ? 'question' : 'questions'} • ${replyCount} ${replyCount === 1 ? 'answer' : 'answers'}`;
  }
  if (type === 'error') {
    return `${itemCount} ${itemCount === 1 ? 'reported error' : 'reported errors'} • ${replyCount} ${replyCount === 1 ? 'fix' : 'fixes'}`;
  }
  return `${itemCount} ${itemCount === 1 ? 'comment' : 'comments'} • ${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
};
