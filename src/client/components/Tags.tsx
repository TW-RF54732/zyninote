export function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <ul className="tags" aria-label="標籤">
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}
