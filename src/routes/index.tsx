import { createFileRoute, Link } from '@tanstack/react-router'
import { buttonVariants } from '#/components/ui/button'

export const Route = createFileRoute('/')({ component: LandingPage })

function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 pb-8 pt-14">
      <section className="rounded-xl border bg-card p-8 shadow-sm sm:p-12">
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Vedtatt
        </p>
        <h1 className="mb-5 max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Demokratiske avstemninger, enkelt og trygt.
        </h1>
        <p className="mb-8 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Gjennomfor effektive og gode demokratiske prosesser. Vedtatt
          tilbyr sanntidsavstemninger med flere valgmetoder, inkludert
          preferansevalg (STV), for organisasjoner av alle storrelser.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/auth" className={buttonVariants({ variant: 'default' }) + ' no-underline'}>
            Kom i gang
          </Link>
          <Link to="/about" className={buttonVariants({ variant: 'outline' }) + ' no-underline'}>
            Les mer
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [
            'Sanntidsavstemning',
            'Se stemmene komme inn i sanntid mens voteringen pagar.',
          ],
          [
            'Flere valgmetoder',
            'Simpelt flertall, kvalifisert flertall og preferansevalg (STV).',
          ],
          [
            'Hemmelig valg',
            'Systemet sporer hvem som har stemt, men ikke hva de stemte.',
          ],
          [
            'QR-registrering',
            'Deltakere kan registrere seg via QR-kode eller delbar lenke.',
          ],
        ].map(([title, desc]) => (
          <article
            key={title}
            className="rounded-xl border bg-card p-5 shadow-sm"
          >
            <h2 className="mb-2 text-base font-semibold text-foreground">
              {title}
            </h2>
            <p className="m-0 text-sm text-muted-foreground">{desc}</p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          For hvem?
        </p>
        <ul className="m-0 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Studentorganisasjoner og linjeforeninger</li>
          <li>
            Ideelle organisasjoner med behov for formelle generalforsamlinger
          </li>
          <li>
            Enhver organisasjon som trenger revisjonssikre, strukturerte
            demokratiske beslutningsprosesser
          </li>
        </ul>
      </section>
    </main>
  )
}
