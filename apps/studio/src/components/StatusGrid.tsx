import { Card, CardContent } from "@/components/ui/card";
import { statusCards } from "@/lib/studioData";

export function StatusGrid() {
  return (
    <section id='runs' aria-labelledby='status-heading'>
      <div className='mb-4 space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight' id='status-heading'>
          Run Control
        </h2>
      </div>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {statusCards.map((card) => (
          <Card key={card.label}>
            <CardContent className='space-y-2 pt-6'>
              <p className='text-muted-foreground text-sm font-medium'>{card.label}</p>
              <strong
                className={
                  card.tone === "blocked"
                    ? "text-destructive text-2xl font-semibold"
                    : "text-2xl font-semibold"
                }
              >
                {card.value}
              </strong>
              <p className='text-muted-foreground text-sm'>{card.detail}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
