import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from "eden-institute";

export function QuizFAQ() {
  return (
    <Accordion type="single" collapsible defaultValue="q1" style={{ width: 440 }}>
      <AccordionItem value="q1">
        <AccordionTrigger className="font-serif">
          What is the Pattern of Eden quiz?
        </AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            A twenty-question constitutional assessment that places your body
            along three classical axes: Hot/Cold, Damp/Dry, and Tense/Relaxed.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="q2">
        <AccordionTrigger className="font-serif">
          Is this medical advice?
        </AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            No. The Materia Medica is educational. Clinical claims are
            dual-sourced, and formularies are reserved for the Practitioner tier.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="q3">
        <AccordionTrigger className="font-serif">
          Do I need an account?
        </AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            A free account saves your body pattern and unlocks the Seed tier of
            the apothecary. Root and Practitioner add deeper monographs.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function ApothecaryTiers() {
  return (
    <Accordion type="single" collapsible style={{ width: 440 }}>
      <AccordionItem value="free">
        <AccordionTrigger className="font-serif">Free · Seedling</AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            The quiz, your body pattern, and a handful of starter monographs.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="root">
        <AccordionTrigger className="font-serif">Root</AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            The full Materia Medica with actions, energetics, and cautions for
            every herb in the garden.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="practitioner">
        <AccordionTrigger className="font-serif">Practitioner</AccordionTrigger>
        <AccordionContent>
          <p className="font-body text-muted-foreground">
            Formularies, dosing, and pattern-matched protocols for clinical work.
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
