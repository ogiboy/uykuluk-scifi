import { DoctorOverviewView } from "@/components/doctor/DoctorOverviewView";
import { getStudioDoctorOverview } from "@/lib/doctorOverview";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Renders the read-only producer doctor diagnostics page.
 *
 * @returns The producer doctor diagnostics page.
 */
export default async function DoctorPage() {
  const overview = await getStudioDoctorOverview();

  return (
    <main className='studio-main page-shell'>
      <header className='studio-header'>
        <div>
          <p className='eyebrow'>Read-only project diagnostics</p>
          <h1>Producer doctor diagnostics</h1>
        </div>
        <Link className='status-pill' href='/'>
          Studio home
        </Link>
      </header>
      <DoctorOverviewView overview={overview} />
    </main>
  );
}
