import { memo, useState } from 'react';
import { FiPaperclip, FiExternalLink, FiAward, FiBookOpen, FiCpu, FiLayers } from 'react-icons/fi';
import { resolveUploadUrl } from '../../services/api';
import {
  fileSize, messageTimestamp, formatMessageTime, messageTimeTitle,
  getEmojiOnlyClusterCount, emojiBubbleTierFromCount, renderMessageBody,
} from './helpers';

export function FileAttachmentCommunity({ file }) {
  const url = resolveUploadUrl(file.url);
  const isImage = String(file.mime_type || '').startsWith('image/');
  const [imageFailed, setImageFailed] = useState(false);
  if (isImage && !imageFailed) {
    return (
      <a className="sgr-file-card sgr-file-card--image" href={url} target="_blank" rel="noopener noreferrer">
        <img
          src={url}
          alt={file.name}
          className="sgr-file-card__img"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
        <span className="sgr-file-card__name">{file.name}</span>
      </a>
    );
  }
  return (
    <a className="sgr-file-card" href={url} target="_blank" rel="noopener noreferrer" download={file.name}>
      <span className="sgr-file-card__icon" aria-hidden><FiPaperclip /></span>
      <span className="sgr-file-card__info">
        <span className="sgr-file-card__name">{file.name}</span>
        {file.size ? <span className="sgr-file-card__size">{fileSize(file.size)}</span> : null}
      </span>
      <FiExternalLink className="sgr-file-card__go" aria-hidden />
    </a>
  );
}

const CommunityMessageBubble = memo(function CommunityMessageBubble({ message, isMine }) {
  const link = message.metadata?.link;
  const voice = message.metadata?.voice;
  const file = message.metadata?.file;
  const author = message.author || {};
  const ts = messageTimestamp(message);
  const timeLabel = formatMessageTime(ts);
  const bodyIsAuto = file && (message.body === `📎 ${file.name}` || message.body === '📎 Attachment');
  const emojiOnlyCount =
    !link?.url && !file?.url && !voice?.url && !bodyIsAuto ? getEmojiOnlyClusterCount(message.body) : null;
  const emojiTier = emojiBubbleTierFromCount(emojiOnlyCount);

  const bubbleClass = [
    'sgr-bubble',
    isMine ? 'sgr-bubble--mine' : '',
    emojiTier != null ? `sgr-bubble--emoji-only sgr-bubble--emoji-tier-${emojiTier}` : '',
  ].filter(Boolean).join(' ');

  return (
    <article className={bubbleClass}>
      {!isMine ? (
        <div className="sgr-bubble__avatar" aria-hidden>
          {(author.full_name || '?').slice(0, 1).toUpperCase()}
        </div>
      ) : null}

      <div className="sgr-bubble__body">
        {!isMine ? (
          <header className="sgr-bubble__head">
            <span className="sgr-bubble__name">{author.full_name || 'Student'}</span>
          </header>
        ) : null}

        {link?.url ? (
          <a
            className="sgr-rich-card"
            href={link.url}
            target={String(link.url).startsWith('http') ? '_blank' : undefined}
            rel={String(link.url).startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            <span className="sgr-rich-card__icon" aria-hidden>
              {link.kind === 'practice' ? <FiCpu /> : link.kind === 'edutainment' ? <FiLayers /> : link.kind === 'badge' ? <FiAward /> : <FiBookOpen />}
            </span>
            <span className="sgr-rich-card__text">
              <span className="sgr-rich-card__tag">
                {link.kind === 'practice' ? 'Practice' : link.kind === 'edutainment' ? 'Edutainment' : link.kind === 'badge' ? 'Badge' : 'Lesson'}
              </span>
              <span className="sgr-rich-card__title">{link.title}</span>
              {link.subtitle ? <span className="sgr-rich-card__sub">{link.subtitle}</span> : null}
            </span>
            <FiExternalLink className="sgr-rich-card__go" aria-hidden />
          </a>
        ) : null}

        {bodyIsAuto && (file?.url || voice?.url || timeLabel) ? (
          <div className="sgr-bubble__tailRow">
            <div className="sgr-bubble__tailMain">
              {file?.url ? <FileAttachmentCommunity file={file} /> : null}
              {voice?.url ? (
                <div className="sgr-voice">
                  <audio controls preload="metadata" className="sgr-voice__audio">
                    <source src={resolveUploadUrl(voice.url)} type={voice.mime_type || 'audio/webm'} />
                    <a href={resolveUploadUrl(voice.url)}>Download voice note</a>
                  </audio>
                </div>
              ) : null}
            </div>
            {timeLabel ? (
              <time className="sgr-bubble__time sgr-bubble__time--tail" dateTime={ts || undefined} title={messageTimeTitle(ts)}>
                {timeLabel}
              </time>
            ) : null}
          </div>
        ) : (
          <>
            {file?.url ? <FileAttachmentCommunity file={file} /> : null}
            {voice?.url ? (
              <div className="sgr-voice">
                <audio controls preload="metadata" className="sgr-voice__audio">
                  <source src={resolveUploadUrl(voice.url)} type={voice.mime_type || 'audio/webm'} />
                  <a href={resolveUploadUrl(voice.url)}>Download voice note</a>
                </audio>
              </div>
            ) : null}
          </>
        )}

        {!bodyIsAuto ? (
          <p className="sgr-bubble__text">
            <span className="sgr-bubble__textBody">{renderMessageBody(message.body)}</span>
            {timeLabel ? (
              <time className="sgr-bubble__time sgr-bubble__time--stamp" dateTime={ts || undefined} title={messageTimeTitle(ts)}>
                {timeLabel}
              </time>
            ) : null}
          </p>
        ) : null}
      </div>
    </article>
  );
});

export default CommunityMessageBubble;
