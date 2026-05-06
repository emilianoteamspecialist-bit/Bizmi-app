import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"

const faqs = [
  {
    q: "How does escrow work?",
    a: "When you fund a job, your payment is held by Bizimi (not sent to the freelancer). The freelancer can only receive funds after you mark the work as approved. If anything goes wrong, our disputes team reviews both sides before releasing.",
  },
  {
    q: "What are the fees?",
    a: "Posting a job is free. Bizimi takes a small service fee on completed jobs — transparent, shown before you fund. Freelancers see the same breakdown on their side. No surprise charges, no monthly minimums.",
  },
  {
    q: "How are pros vetted?",
    a: "Every freelancer goes through an identity check (government ID + bank account verification) plus a skill review of their portfolio before they can take paid work. The verified badge means we've checked them.",
  },
  {
    q: "What if I'm not satisfied with the work?",
    a: "You don't release the escrow until you're happy. If you and the freelancer can't agree, you can open a dispute and our team reviews the brief, the deliverables, and the chat history before deciding.",
  },
]

export function LandingFAQ() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <span className="inline-block text-xs font-black tracking-widest text-primary uppercase mb-3">
            Common questions
          </span>
          <h2 className="font-heading font-black text-3xl md:text-5xl text-ink tracking-tight">
            Everything you need to know.
          </h2>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`item-${i}`}>
              <AccordionTrigger>{f.q}</AccordionTrigger>
              <AccordionContent>{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
