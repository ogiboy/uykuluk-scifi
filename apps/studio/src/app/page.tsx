import { AssetInventory } from "@/components/AssetInventory";
import { CommandPanel } from "@/components/CommandPanel";
import { StatusGrid } from "@/components/StatusGrid";
import { StudioTabs } from "@/components/studio/StudioTabs";
import { studioSections } from "@/lib/studioData";

export default function StudioHomePage() {
  return (
    <main className='studio-shell'>
      <aside className='studio-rail' aria-label='Studio navigation'>
        <div className='brand-lockup'>
          <span className='brand-mark'>USF</span>
          <div>
            <p>UykulukSciFi</p>
            <strong>Producer Studio</strong>
          </div>
        </div>
        <nav>
          {studioSections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.label}
            </a>
          ))}
        </nav>
      </aside>

      <section className='studio-main'>
        <header className='studio-header'>
          <div>
            <p className='eyebrow'>Local-first production desk</p>
            <h1>Manual approval-gated sci-fi video production</h1>
          </div>
          <span className='status-pill'>CLI source of truth</span>
        </header>

        <StatusGrid />
        <CommandPanel />
        <AssetInventory />
        <StudioTabs />
      </section>
    </main>
  );
}
