import { createFileRoute } from '@tanstack/react-router'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '#/components/ui/accordion'

export const Route = createFileRoute('/about')({
  component: About,
})

function About() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Om oss
        </p>
        <h1 className="mb-3 text-3xl font-bold text-foreground sm:text-4xl">
          Demokrati gjort digitalt.
        </h1>
        <p className="m-0 mb-6 max-w-3xl text-base leading-8 text-muted-foreground">
          Vedtatt er en plattform for gjennomforing av formelle demokratiske
          avstemninger i organisasjoner. Vi gjor det enkelt a opprette moter,
          definere voteringer, invitere deltakere og gjennomfore sanntids
          avstemninger med automatisk opptelling.
        </p>
      </section>

      <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Valgmetoder
        </h2>
        <Accordion className="w-full">
          <AccordionItem value="simple">
            <AccordionTrigger>Simpelt flertall</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">
                Alternativet med flest stemmer vinner. Den enkleste
                valgmetoden, egnet for ja/nei-avstemninger og enkle valg mellom
                flere alternativer. Ved stemmelikhet erklares ingen vinner.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="qualified">
            <AccordionTrigger>Kvalifisert flertall</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">
                Et alternativ ma oppna mer enn en gitt prosentandel av alle
                stemmeberettigede for a vinne. Vanlige terskler er 50% (alminnelig
                flertall) og 67% (to tredjedels flertall). Merk at terskelen
                beregnes ut fra alle stemmeberettigede, ikke bare de som stemte.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="stv">
            <AccordionTrigger>Preferansevalg (STV)</AccordionTrigger>
            <AccordionContent>
              <p className="text-muted-foreground">
                Rangert stemmegivning hvor du rangerer alternativene etter
                preferanse. Systemet bruker Droop-kvoten for a beregne
                vinnere over flere runder. Overskuddsstemmer omfordeles med
                redusert vekt, og det alternativet med farrest stemmer
                elimineres i hver runde til nok vinnere er funnet. Ideelt for
                valg med flere vinnere, som styrevalg.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </section>

      <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm sm:p-8">
        <h2 className="mb-4 text-2xl font-bold text-foreground">
          Personvern
        </h2>
        <p className="text-muted-foreground">
          Vedtatt tar personvern pa alvor. Systemet sikrer hemmelig valg ved a
          holde informasjonen om hvem som har stemt atskilt fra selve stemmene.
          Vi lagrer kun e-postadressen din for brukeridentifikasjon og
          moteinvitasjoner. Alle stemmedata er anonymiserte og kan ikke spores
          tilbake til enkeltpersoner.
        </p>
      </section>
    </main>
  )
}
