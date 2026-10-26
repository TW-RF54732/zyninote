import type { Backlink } from "../../shared/types.ts";

/** "Linked from": pages (and their blocks) that link to this page. Links are previewable like note links. */
export function Backlinks({ backlinks, subjectTitle }: { backlinks: Backlink[]; subjectTitle?: string }) {
  if (!backlinks.length) return null;
  return (
    <section className="backlinks" aria-labelledby="backlinks-title">
      <h2 id="backlinks-title" className="eyebrow">
        連到本頁的筆記
      </h2>
      <ul className="backlink-list">
        {backlinks.map((backlink) => (
          <li key={backlink.page}>
            <a className="zn-link backlink-page" data-zn-link="visible" href={backlink.url}>
              {backlink.title}
            </a>
            {backlink.subjectTitle !== subjectTitle && <span className="card-meta backlink-subject">{backlink.subjectTitle}</span>}
            <ul className="backlink-refs">
              {backlink.refs
                .filter((ref) => ref.from || ref.to)
                .map((ref) => (
                  <li key={`${ref.from?.id ?? ""}\0${ref.to?.id ?? ""}`}>
                    {ref.from ? (
                      <a className="zn-link" data-zn-link="visible" href={`${backlink.url}#${encodeURIComponent(ref.from.id)}`}>
                        {ref.from.title}
                      </a>
                    ) : (
                      <span>開頭段落</span>
                    )}
                    {ref.to && <span className="backlink-to"> → {ref.to.title}</span>}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
