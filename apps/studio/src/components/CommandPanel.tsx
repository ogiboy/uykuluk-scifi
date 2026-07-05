import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { commandGroups } from "@/lib/studioData";

export function CommandPanel() {
  return (
    <section id='workflow' aria-labelledby='workflow-heading'>
      <div className='mb-4 space-y-2'>
        <h2 className='text-2xl font-semibold tracking-tight' id='workflow-heading'>
          Workflow Commands
        </h2>
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        {commandGroups.map((group) => (
          <Card key={group.title}>
            <CardHeader>
              <CardTitle>{group.title}</CardTitle>
              <CardDescription>{group.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyableCommand command={group.command} label={`${group.title} command`} />
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
