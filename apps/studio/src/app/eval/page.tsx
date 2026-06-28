import Link from "next/link";
import { ModelEvalOverviewView } from "@/components/eval/ModelEvalOverviewView";
import { getStudioModelEvalOverview } from "@/lib/modelEvalOverview";

export const dynamic = "force-dynamic";

/**
 * Renders the read-only local model evaluation page.
 *
 * @returns The local model evaluation page.
 */
export default async function ModelEvalPage() {
  const overview = await getStudioModelEvalOverview();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only local model evidence</p>
          <h1>Local model evaluation</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <ModelEvalOverviewView overview={overview} />
    </main>
  );
}
