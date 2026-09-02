import { memo } from 'react';
import CommunityMessageBubble from './MessageBubble';
import { localDayKey, messageTimestamp, chatDayDividerLabel } from './helpers';

const CommunityChatTimeline = memo(function CommunityChatTimeline({ messages, userId }) {
  return messages.flatMap((m, i) => {
    const dayKey = localDayKey(messageTimestamp(m));
    const prevKey = i > 0 ? localDayKey(messageTimestamp(messages[i - 1])) : null;
    const isMine = String(m.author?.id || '') === String(userId || '');
    const nodes = [];
    if (dayKey && dayKey !== prevKey) {
      const label = chatDayDividerLabel(dayKey);
      if (label) {
        nodes.push(
          <div
            key={`day-${dayKey}-${m.id}`}
            className="sgr-chat__day"
            role="separator"
            aria-label={label}
          >
            <span className="sgr-chat__day-label">{label}</span>
          </div>,
        );
      }
    }
    nodes.push(<CommunityMessageBubble key={m.id} message={m} isMine={isMine} />);
    return nodes;
  });
});

export default CommunityChatTimeline;
