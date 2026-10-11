import './CompactInfoList.css';

// Title/body pairs as one tidy list instead of a grid of near-empty cards.
export default function CompactInfoList({ items }) {
  return (
    <dl className="compact-info-list">
      {items.map((item) => (
        <div key={item.title} className="compact-info-list__row">
          <dt>{item.title}</dt>
          <dd>{item.body}</dd>
        </div>
      ))}
    </dl>
  );
}
