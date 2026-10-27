type CheckGroupProps = {
  label: string;
  /** `meta` is a faint trailing note, such as a count. */
  options: { value: string; label: string; meta?: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Lay the options out in a wrapping row (tags) rather than one per line (chapters). */
  inline?: boolean;
};

/** A labelled group of checkboxes, as used by filter menus. */
export function CheckGroup({ label, options, selected, onToggle, inline }: CheckGroupProps) {
  return (
    <fieldset className="cheat-check-group" data-inline={inline || undefined}>
      <legend>{label}</legend>
      {options.map((option) => (
        <label key={option.value} className="cheat-check">
          <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(option.value)} />
          {option.label}
          {option.meta && <span className="card-meta">{option.meta}</span>}
        </label>
      ))}
    </fieldset>
  );
}
