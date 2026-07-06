import { Badge } from "../../../components/badge";
import { useGroupDetailContext } from "../context/GroupDetailContext";

export function GroupNotesTab() {
  const { group, noteItems, handleOpenNoteModal } = useGroupDetailContext();

  return (
    <section className="rounded-3xl border border-brand-tertiary/25 bg-brand-tertiary/[0.08] p-5 shadow-ambient">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-brand-tertiary" aria-hidden="true">
          sticky_note_2
        </span>
        <h3 className="text-lg font-bold text-brand-tertiary">Important Notes</h3>
      </div>

      <ul className="mt-3 space-y-2">
        {noteItems.map((note) => (
          <li
            key={note.id}
            className={`rounded-xl border px-3 py-2 ${
              note.pinned ? "border-brand-tertiary/35 bg-brand-neutral" : "border-brand-tertiary/25 bg-brand-neutral"
            }`}
          >
            <span className="mr-2 inline-block h-2 w-2 rounded-full bg-brand-tertiary" aria-hidden="true" />
            <div className="inline">
              <p className="inline text-sm text-on-surface-variant">{note.text}</p>
              {note.pinned ? (
                <Badge
                  status="error"
                  className="ml-2 px-2 py-0.5 text-[11px] font-bold leading-none rounded-lg border-none"
                >
                  Pinned
                </Badge>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!group.parentGroupId && (
        <button
          type="button"
          className="mt-4 inline-flex w-full items-center justify-center rounded-2xl border border-dashed border-brand-tertiary/55 bg-brand-neutral px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-brand-tertiary transition hover:bg-brand-tertiary/12"
          onClick={handleOpenNoteModal}
        >
          <span className="sm:hidden">Add Note</span>
          <span className="hidden sm:inline">Add New Note</span>
        </button>
      )}
    </section>
  );
}
