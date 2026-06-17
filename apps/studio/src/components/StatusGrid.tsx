import { statusCards } from "@/lib/studioData";

export function StatusGrid() {
  return (
    <section id='runs' aria-labelledby='status-heading'>
      <h2 id='status-heading'>Run Control</h2>
      <div className='status-grid'>
        {statusCards.map((card) => (
          <article className='status-card' key={card.label}>
            <p>{card.label}</p>
            <strong className={card.tone === "blocked" ? "blocked" : undefined}>
              {card.value}
            </strong>
            <p>{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
