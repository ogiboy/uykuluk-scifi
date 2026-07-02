import { CopyableCommand } from "@/components/studio/CopyableCommand";
import { commandGroups } from "@/lib/studioData";

export function CommandPanel() {
  return (
    <section id='workflow' aria-labelledby='workflow-heading'>
      <h2 id='workflow-heading'>Workflow Commands</h2>
      <div className='command-grid'>
        {commandGroups.map((group) => (
          <article className='panel' key={group.title}>
            <h3>{group.title}</h3>
            <CopyableCommand command={group.command} label={`${group.title} command`} />
            <p>{group.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
