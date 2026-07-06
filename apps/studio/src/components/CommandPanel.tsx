import { CliFallbackCommand } from "@/components/studio/CliFallbackCommand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { commandGroups } from "@/lib/studioData";

export function CommandPanel() {
  return (
    <section id='workflow' aria-labelledby='workflow-heading'>
      <div className='mb-4 space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight' id='workflow-heading'>
          Workflow Fallbacks
        </h2>
        <p className='text-sm text-muted-foreground'>
          Studio controls should be used first. Reveal these CLI/core commands only for audit,
          recovery, or terminal-driven operation.
        </p>
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        {commandGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <CliFallbackCommand
                align='start'
                command={group.command}
                label={`${group.title} command`}
                triggerLabel='Show fallback'
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
