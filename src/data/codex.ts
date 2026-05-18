import type { CodexEntry, CodexSection, SectionKey } from '@/types'

// ─────────────────────────────────────────────
// ROOT — Core identity and operating principles
// ─────────────────────────────────────────────
const rootEntries: CodexEntry[] = [
  {
    id: 'root',
    title: 'Root',
    path: 'root',
    section: 'root',
    content: `# Root

The foundational layer of the Legacy Codex. Everything here is load-bearing.

> "The root is not visible, but nothing stands without it."

This section contains the core identity, values, mission, and operating principles that govern all downstream systems — Council, Territory, Artistic, and beyond.

## What Lives Here

- **Identity** — Who Edward Emory is, at the level of craft and character
- **Mission** — The singular directive that all systems serve
- **Values** — The non-negotiables that filter every decision
- **Principles** — The mental models that run on autopilot
`,
    children: [
      {
        id: 'root.identity',
        title: 'Identity',
        path: 'root.identity',
        section: 'root',
        content: `# Identity

**Edward Emory Photography** — Legacy portraiture and visual storytelling rooted in truth, craft, and permanence.

Edward Frye operating as Edward Emory — the name carried forward from family lineage, chosen deliberately as a signal that this work outlasts a single lifetime.

## Core Identity Statements

- I am a legacy photographer. I document people at the height of their humanity.
- I am a systems builder. The business is designed to run without constant friction.
- I am a neurodivergent founder. My mind works differently — this is the source, not the obstacle.
- I am building something that will outlast me.

## The Name

*Edward Emory* is the name of the craft. Emory — the family name — grounding the work in lineage.
Photography as legacy-making: not pictures, but artifacts. Not sessions, but records.
`,
      },
      {
        id: 'root.mission',
        title: 'Mission',
        path: 'root.mission',
        section: 'root',
        content: `# Mission

**To create lasting visual records of people at the height of their humanity — delivered through systems that run with precision and care.**

### The Long Form

Every family, every individual, every moment of significance deserves documentation that holds up in 100 years. Legacy Codex exists as the operational brain behind that mission — ensuring that the artistic work is never compromised by business friction, and the business never loses sight of the art.

### What Success Looks Like

- Clients receive work that becomes more meaningful over time
- The studio runs without Edward micromanaging every detail
- Each system feeds the next without manual effort
- Revenue supports the creative work, not the reverse
`,
      },
      {
        id: 'root.values',
        title: 'Values',
        path: 'root.values',
        section: 'root',
        content: `# Values

These are not aspirational. They are operational.

## The Five

### 1. Truth
The camera does not lie when the photographer refuses to. Every image should reflect a real moment, a real person, an honest rendering.

### 2. Craft
Technical excellence is not separate from artistic vision. It is its prerequisite.

### 3. Permanence
Build for a hundred years. The print, the system, the relationship — all should hold.

### 4. Precision
Details compound. Sloppiness in small systems creates catastrophic failure at scale.

### 5. Care
The client is not a transaction. They are a person entrusting you with the most important moments of their lives.
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// COUNCIL — Advisors, mentors, key relationships
// ─────────────────────────────────────────────
const councilEntries: CodexEntry[] = [
  {
    id: 'council',
    title: 'Council',
    path: 'council',
    section: 'council',
    content: `# Council

The people, voices, and mental models that inform strategic decisions.

> "A council is not people who agree with you. It is people who see you clearly."

## Structure

The Council is divided into three tiers:
- **Inner Circle** — Active advisors with regular contact
- **Reference Council** — Authors, practitioners, thinkers whose frameworks are load-bearing
- **Field Intelligence** — Peers in adjacent markets whose moves are worth tracking
`,
    children: [
      {
        id: 'council.inner',
        title: 'Inner Circle',
        path: 'council.inner',
        section: 'council',
        content: `# Inner Circle

These are the people with direct access and active advisory roles.

*[Populate with actual council members — names, roles, how they advise, cadence of contact]*

## Template for Each Member

\`\`\`
Name:
Role in my work:
What they see that I miss:
How often we connect:
Last key insight:
\`\`\`
`,
      },
      {
        id: 'council.reference',
        title: 'Reference Council',
        path: 'council.reference',
        section: 'council',
        content: `# Reference Council

Mental models and frameworks drawn from thinkers, authors, and practitioners.

## Active Frameworks

- **Systems Thinking** — Everything is connected. Optimize the system, not the parts.
- **The E-Myth** — Work *on* the business, not just *in* it.
- **Deep Work** — Cal Newport's framework for distraction-free, high-leverage work.
- **Traction / EOS** — Entrepreneurial Operating System for structured business growth.
- **The War of Art** — Pressfield on resistance, professionalism, and creative work.

*[Add frameworks specific to your practice as you build]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// TERRITORY — Geography, market, clientele
// ─────────────────────────────────────────────
const territoryEntries: CodexEntry[] = [
  {
    id: 'territory',
    title: 'Territory',
    path: 'territory',
    section: 'territory',
    content: `# Territory

The geographic, demographic, and market landscape in which Edward Emory Photography operates.

> "Know your terrain before you plant your flag."

## Scope

This section maps:
- **Primary market geography** — Where the studio operates and serves
- **Client demographics** — Who the work is for
- **Competitive landscape** — What else exists in this space
- **Growth vectors** — Where expansion makes sense
`,
    children: [
      {
        id: 'territory.market',
        title: 'Market',
        path: 'territory.market',
        section: 'territory',
        content: `# Market

## Primary Service Area

*[Define your primary geographic market]*

## Client Profile

The ideal Edward Emory Photography client:
- Values legacy over trend
- Has a milestone worth documenting
- Understands that craft takes time and costs accordingly
- Will become an advocate after their experience

## Price Point & Positioning

Legacy portraiture in the premium tier. This is not commodity photography.
The work is positioned alongside fine art, not alongside "best value" digital packages.

*[Add specific pricing tiers, minimum investments, and positioning statements]*
`,
      },
      {
        id: 'territory.competitive',
        title: 'Competitive Landscape',
        path: 'territory.competitive',
        section: 'territory',
        content: `# Competitive Landscape

## Market Segments

### Volume Photographers
Fast, affordable, high-volume. Not the competition — different customer, different promise.

### Premium Digital Studios
High-end digital, trend-forward, strong social. Adjacent competition. Differentiate on permanence and legacy framing.

### Fine Art / Film Photographers
Closest aesthetic kin. Compete on systems, client experience, and consistency.

## Our Differentiation

1. **Legacy framing** — The narrative is about permanence, not just beauty
2. **Systems precision** — The client experience is engineered, not improvised
3. **Neurodivergent creativity** — Different mind, different eye, genuinely original vision

*[Add specific local/regional competitors and analysis]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// ARTISTIC SYSTEMS — The craft layer
// ─────────────────────────────────────────────
const artisticEntries: CodexEntry[] = [
  {
    id: 'artistic',
    title: 'Artistic Systems',
    path: 'artistic',
    section: 'artistic',
    content: `# Artistic Systems

The documented craft — aesthetic frameworks, technical standards, and creative process.

> "Inspiration is for amateurs. The rest of us just show up and work." — Chuck Close

## What Lives Here

- **Aesthetic Philosophy** — The visual language of Edward Emory Photography
- **Technical Standards** — Non-negotiable quality benchmarks
- **Session Frameworks** — How shoots are structured and conducted
- **Post-Processing** — The edit as an extension of the capture
- **Print & Product** — The final form of the work
`,
    children: [
      {
        id: 'artistic.aesthetic',
        title: 'Aesthetic Philosophy',
        path: 'artistic.aesthetic',
        section: 'artistic',
        content: `# Aesthetic Philosophy

## The Visual Language

Edward Emory Photography operates in the space between photojournalism and fine art portraiture. The work is:

- **Quiet** — No drama for its own sake. Stillness as strength.
- **Honest** — The subject is seen, not performed.
- **Dimensional** — Light that reveals, not flatters.
- **Permanent** — Made to be printed large and hung on walls.

## Light

Natural light as the default, controlled light as the tool. Never the opposite.

## Color

Warm, rich tonality. Skin as the primary subject of color. Backgrounds as supporting context, never competition.

## Composition

Classically grounded. The rule of thirds as a starting point, not a rule. Eyes as the narrative center.
`,
      },
      {
        id: 'artistic.technical',
        title: 'Technical Standards',
        path: 'artistic.technical',
        section: 'artistic',
        content: `# Technical Standards

## Capture

- **Minimum resolution:** *[define per session type]*
- **File format:** RAW, always
- **Exposure:** ETTR (expose to the right) as standard practice
- **Focus:** Eye-detection AF as baseline; manual verification for critical shots

## Edit Standards

- Color correction before creative grading
- Skin tone neutrality as starting point
- Retouching: enhance without erasing — keep what makes the person real

## Delivery Standards

- Gallery delivered within *[your SLA]* days
- Full-resolution TIFF + web JPEG
- Print-ready files included at purchase
- Archive retained for *[define period]*

*[Update with your specific workflows and SLAs]*
`,
      },
      {
        id: 'artistic.sessions',
        title: 'Session Frameworks',
        path: 'artistic.sessions',
        section: 'artistic',
        content: `# Session Frameworks

## Session Types

### Legacy Portrait Session
*The flagship offering.*
- Duration: 2-3 hours
- Location: Studio + one location
- Wardrobe: Up to 3 looks
- Goal: The definitive portrait of this person at this time

### Family Legacy Session
- Duration: 3-4 hours
- Multiple configurations (full family, sub-groups, individuals)
- Goal: A complete record of this family at this chapter

### Milestone Session
- Tied to a specific life event (anniversary, graduation, new chapter)
- Duration variable to event

## Session Flow

1. **Pre-session consultation** — Connection, logistics, wardrobe review
2. **Arrival & settle** — Never rush the first 10 minutes
3. **Warm-up shots** — For the subject, not the portfolio
4. **The work** — When the subject forgets the camera
5. **Review & wrap** — Show one or two selects; close with warmth

*[Add your specific session runsheets and checklists]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// NEURO — Neurodivergent operating systems
// ─────────────────────────────────────────────
const neuroEntries: CodexEntry[] = [
  {
    id: 'neuro',
    title: 'Neuro',
    path: 'neuro',
    section: 'neuro',
    content: `# Neuro

The operational layer for a neurodivergent mind running a precision business.

> "The goal is not to overcome how your brain works. The goal is to build systems that work with it."

## What Lives Here

- **Operating Modes** — How energy and focus actually work
- **Environment Design** — The physical and digital spaces that support the work
- **Friction Reduction** — Systems that account for executive function variance
- **Recovery Protocols** — What happens when the system overtaxes itself
- **Strengths Inventory** — What the neurodivergent mind does *better*
`,
    children: [
      {
        id: 'neuro.modes',
        title: 'Operating Modes',
        path: 'neuro.modes',
        section: 'neuro',
        content: `# Operating Modes

## The Four Modes

### Flow State
- Trigger: Deep, uninterrupted creative or systems work
- Duration: 2-6 hours (variable)
- Protect at all costs
- Do not schedule meetings during predicted flow windows

### Executive Function Mode
- Administrative, decision-heavy, communication-heavy tasks
- Requires: Clear agenda, defined endpoint, shorter windows (60-90 min)
- Best time: *[define your personal optimal window]*

### Recovery Mode
- Post-session, post-deadline, post-social interaction
- Non-negotiable. Must be protected in the schedule.
- Activities: *[define what actually restores you]*

### Crisis/Emergency Mode
- Reactive, high-urgency
- Recognize it. Name it. Exit as quickly as possible.
- Do not make strategic decisions in this mode.

*[Refine with your actual experience — what triggers each mode, how long each lasts, what helps transition]*
`,
      },
      {
        id: 'neuro.environment',
        title: 'Environment Design',
        path: 'neuro.environment',
        section: 'neuro',
        content: `# Environment Design

## Studio Environment

- **Sensory defaults:** *[lighting level, sound environment, temperature preference]*
- **Session prep:** Everything staged before client arrives — no visible chaos
- **Cleanup protocol:** End-of-session reset before leaving

## Digital Environment

- **Single trusted system:** Legacy Codex as the single source of truth
- **Inbox zero:** Not as aspiration — as operating requirement
- **Notification hygiene:** *[which notifications, which times, which contexts]*
- **Tab discipline:** Close what is not active work

## Home Environment

*[Define what makes the home workspace work for your brain]*
`,
      },
      {
        id: 'neuro.strengths',
        title: 'Strengths Inventory',
        path: 'neuro.strengths',
        section: 'neuro',
        content: `# Strengths Inventory

The neurodivergent mind is not a broken neurotypical mind. It is a different kind of mind with genuine advantages — especially in creative and systems work.

## The Advantages

### Hyperfocus
When the conditions are right, the depth of focus exceeds what most people access. Use this deliberately.

### Pattern Recognition
Seeing connections others miss. The basis of both good photography and good systems design.

### Sensitivity
To light, to emotion, to what's off in a room. This is why the portraits work.

### Intensity
The work matters. That's not a defect.

### Creative Range
The mind moves laterally. This is generative when channeled.

## The Honest Trade-offs

*[Document your specific challenges without shame — knowing them is how you build around them]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// AUTOMATION — Systems and workflows
// ─────────────────────────────────────────────
const automationEntries: CodexEntry[] = [
  {
    id: 'automation',
    title: 'Automation',
    path: 'automation',
    section: 'automation',
    content: `# Automation

The systems that run the business without requiring Edward's attention for every step.

> "Every task you automate is a task you can never forget, never rush, and never do inconsistently."

## Philosophy

Automation is not about laziness. It is about precision. A system that runs the same way every time is a system that can be trusted. A business that runs on trusted systems is a business that can scale.

## What Lives Here

- **Client Journey** — From inquiry to delivery to follow-up
- **Financial Systems** — Invoicing, tracking, reporting
- **Communication Templates** — The words that go out on schedule
- **Workflows & SOPs** — Step-by-step operational procedures
- **Tools Stack** — The software that powers the automation
`,
    children: [
      {
        id: 'automation.client-journey',
        title: 'Client Journey',
        path: 'automation.client-journey',
        section: 'automation',
        content: `# Client Journey

## The Eight Stages

\`\`\`
INQUIRY → CONSULTATION → BOOKING → PRE-SESSION → SESSION → EDIT → DELIVERY → FOLLOW-UP
\`\`\`

### Stage 1: Inquiry
- **Trigger:** Form submission / direct contact
- **Response time:** Within 24 hours (automated acknowledgment within 1 hour)
- **Automation:** CRM trigger → welcome email → calendar link
- **Human touch point:** Personal response within 24 hours

### Stage 2: Consultation
- **Format:** Video call (preferred) or in-person
- **Duration:** 30-45 minutes
- **Purpose:** Qualify, connect, understand the legacy they want documented
- **System:** Automated follow-up with booking link same day

### Stage 3: Booking
- **Contract:** Digital, signed before any prep
- **Deposit:** *[define your terms]*
- **Confirmation:** Automated + personal note

### Stage 4: Pre-Session
- **Timeline:** Communication cadence beginning *[X weeks]* before session
- **Prep guide:** Automated delivery *[X days]* before session
- **Logistics confirmation:** *[X days]* before

### Stage 5: Session
- *See Artistic Systems → Session Frameworks*

### Stage 6: Edit
- **Cull → Select → Grade → Retouch → Export**
- **SLA:** *[define your timeline commitment]*
- **Client update:** Mid-edit check-in at day *[X]*

### Stage 7: Delivery
- **Gallery delivery** with viewing guide
- **Ordering window:** *[X days]* open
- **Follow-up:** Day 3 and Day *[X]* before close

### Stage 8: Follow-Up
- **Thank you:** Personal, within 48 hours of order
- **Review request:** *[X weeks]* post-delivery
- **Nurture:** Quarterly touchpoint (milestone check-in)
- **Anniversary:** Annual legacy check-in

*[Populate with your actual CRM, email platform, and specific automations]*
`,
      },
      {
        id: 'automation.tools',
        title: 'Tools Stack',
        path: 'automation.tools',
        section: 'automation',
        content: `# Tools Stack

## Current Stack

| Function | Tool | Status |
|---|---|---|
| CRM | *[your CRM]* | Active |
| Email Marketing | *[platform]* | Active |
| Scheduling | *[platform]* | Active |
| Contracts | *[platform]* | Active |
| Gallery Delivery | *[platform]* | Active |
| Invoicing | *[platform]* | Active |
| Project Management | *[platform]* | Active |
| Knowledge Base | Legacy Codex | Active |

## Stack Principles

1. Each tool does one thing well
2. Tools talk to each other (no manual bridge work)
3. The client never sees the machinery
4. The photographer never has to remember what happens next

*[Update with your actual tools — include API keys location, login source, and purpose]*
`,
      },
      {
        id: 'automation.sops',
        title: 'SOPs',
        path: 'automation.sops',
        section: 'automation',
        content: `# Standard Operating Procedures

## The SOP Library

SOPs are the written version of "how we do things." Every repeatable task that matters should have one.

### Active SOPs

- [ ] New inquiry response
- [ ] Consultation call runsheet
- [ ] Booking confirmation sequence
- [ ] Session day checklist
- [ ] Cull and selection workflow
- [ ] Edit and delivery workflow
- [ ] Gallery delivery and ordering
- [ ] End-of-year archive process

### SOP Template

\`\`\`
SOP Title:
Last Updated:
Owner: Edward Emory Photography
Frequency: [when this runs]

TRIGGER: [what starts this SOP]

STEPS:
1.
2.
3.

COMPLETION CONDITION: [how you know it's done]
NOTES:
\`\`\`

*[Build each SOP as a separate entry or sub-entry in this section]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// BUSINESS — Revenue, finance, strategy
// ─────────────────────────────────────────────
const businessEntries: CodexEntry[] = [
  {
    id: 'business',
    title: 'Business',
    path: 'business',
    section: 'business',
    content: `# Business

The financial and strategic layer of Edward Emory Photography.

> "Art without a viable business is a hobby. A business without art is just work. The goal is both."

## What Lives Here

- **Financial Model** — Revenue targets, cost structure, margins
- **Offers** — What is sold and how it is priced
- **Strategy** — Annual objectives and quarterly priorities
- **Metrics** — What gets measured and why
- **Legal & Admin** — Business structure, contracts, compliance
`,
    children: [
      {
        id: 'business.offers',
        title: 'Offers',
        path: 'business.offers',
        section: 'business',
        content: `# Offers

## The Product Line

### Collections

| Collection | Investment | Deliverables |
|---|---|---|
| *[Define]* | *[Price]* | *[What they receive]* |
| *[Define]* | *[Price]* | *[What they receive]* |
| *[Define]* | *[Price]* | *[What they receive]* |

### À La Carte

- Prints: *[sizes and prices]*
- Albums: *[sizes and prices]*
- Wall art: *[options and prices]*
- Digital files: *[terms and pricing]*

## Pricing Philosophy

The price reflects the value of permanence, not the cost of labor. A $50 print from a $5,000 session is not expensive — it is the most cost-effective luxury the client will ever buy.

*[Add current, accurate pricing — this file should be the source of truth]*
`,
      },
      {
        id: 'business.financials',
        title: 'Financial Model',
        path: 'business.financials',
        section: 'business',
        content: `# Financial Model

## Annual Targets

| Metric | Target | Current |
|---|---|---|
| Gross Revenue | *[target]* | *[current]* |
| Sessions Booked | *[#]* | *[#]* |
| Average Sale | *[target]* | *[current]* |
| Profit Margin | *[%]* | *[%]* |

## Cost Structure

| Category | Monthly | Annual |
|---|---|---|
| Studio / Space | | |
| Software & Tools | | |
| Marketing | | |
| Equipment | | |
| Education | | |
| Administrative | | |
| Total COGS | | |

## Breakeven

*[Calculate: what you must sell each month to cover costs]*

*[Update quarterly with actuals — this file should not be aspirational, it should be accurate]*
`,
      },
      {
        id: 'business.strategy',
        title: 'Strategy',
        path: 'business.strategy',
        section: 'business',
        content: `# Strategy

## Annual Vision

*[Define what this year should accomplish for the business]*

## Quarterly Priorities

### Q1
1.
2.
3.

### Q2
1.
2.
3.

### Q3
1.
2.
3.

### Q4
1.
2.
3.

## Strategic Bets

*[The 2-3 things you're betting on that are not obvious — the moves others aren't making]*

## What You're Not Doing

*[Equally important: what you are explicitly NOT pursuing this year, and why]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// PERSONAL OS — How Edward runs himself
// ─────────────────────────────────────────────
const personalosEntries: CodexEntry[] = [
  {
    id: 'personalos',
    title: 'Personal OS',
    path: 'personalos',
    section: 'personalos',
    content: `# Personal OS

The system for running Edward Emory as a person — not just as a photographer or business owner.

> "You cannot pour from an empty vessel. But you also cannot scale a vessel that has no structure."

## What Lives Here

- **Rhythms & Routines** — The daily and weekly architecture
- **Energy Management** — What fills and drains the tank
- **Goals & Growth** — Personal development as a system
- **Health** — Physical and mental maintenance protocols
- **Relationships** — How personal relationships are tended
`,
    children: [
      {
        id: 'personalos.rhythms',
        title: 'Rhythms & Routines',
        path: 'personalos.rhythms',
        section: 'personalos',
        content: `# Rhythms & Routines

## Daily Architecture

### Morning Protocol
*[What happens from wake to first work task]*

### Work Blocks
- **Deep work window:** *[time range]*
- **Communication window:** *[time range]*
- **Admin window:** *[time range]*

### Evening Close
*[How the work day ends — what gets reviewed, reset, and put down]*

## Weekly Architecture

| Day | Focus |
|---|---|
| Monday | *[theme]* |
| Tuesday | *[theme]* |
| Wednesday | *[theme]* |
| Thursday | *[theme]* |
| Friday | *[theme]* |
| Saturday | *[off / session]* |
| Sunday | *[off / review]* |

## Weekly Review

Every *[day]* — a brief review:
- What did I accomplish?
- What's incomplete?
- What does next week need?

*[Document your actual routines — aspirational routines do not belong here]*
`,
      },
      {
        id: 'personalos.energy',
        title: 'Energy Management',
        path: 'personalos.energy',
        section: 'personalos',
        content: `# Energy Management

## What Fills the Tank

*[List what genuinely restores your energy — be specific and honest]*

Examples (replace with yours):
- Unstructured time in nature
- Reading (not screens)
- Physical movement that isn't performative
- Meals without devices
- *[your actual list]*

## What Drains the Tank

*[What reliably depletes you — so you can manage exposure]*

Examples (replace with yours):
- Open-ended social obligations
- Context switching without buffer
- Reactive workdays
- *[your actual list]*

## Recovery Protocols

When the tank is low or empty:

**Tier 1 (30 minutes):** *[quick reset activities]*
**Tier 2 (half day):** *[deeper recovery]*
**Tier 3 (full day or more):** *[serious restoration — define when this is warranted and how]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// CONVERGENCE — Where everything meets
// ─────────────────────────────────────────────
const convergenceEntries: CodexEntry[] = [
  {
    id: 'convergence',
    title: 'Convergence',
    path: 'convergence',
    section: 'convergence',
    content: `# Convergence

Where the systems meet, integrate, and become something larger than their parts.

> "Convergence is what happens when every system is pointed in the same direction."

## What Lives Here

- **The Integrated View** — How Root, Council, Territory, Artistic, Neuro, Automation, Business, and Personal OS connect
- **Tension Points** — Where systems create friction with each other (and how to resolve it)
- **The Legacy Statement** — The thing this is all in service of
- **Year-End Reviews** — Annual synthesis documents
- **Future Vision** — Where this is going in 3, 5, 10 years
`,
    children: [
      {
        id: 'convergence.integrated',
        title: 'The Integrated View',
        path: 'convergence.integrated',
        section: 'convergence',
        content: `# The Integrated View

## How the Systems Connect

\`\`\`
ROOT (Identity + Values)
    ↓
COUNCIL (Who advises) + TERRITORY (What market)
    ↓
ARTISTIC SYSTEMS (How the work is made)
    ↓
AUTOMATION (How it runs) + BUSINESS (What it earns)
    ↓
PERSONAL OS (Who runs all of it)
    ↓
CONVERGENCE (Does it cohere?)
\`\`\`

## The Test of Convergence

When a decision needs to be made, ask:

1. Does this align with **Root** (my values and identity)?
2. Would my **Council** endorse it?
3. Does it serve my **Territory** (my market and clients)?
4. Does it produce better **Artistic** outcomes?
5. Is it **Automated** or can it be?
6. Does it serve the **Business** model?
7. Can my **Personal OS** sustain it?

If the answer to all seven is yes — move. If even one is no — understand why before proceeding.
`,
      },
      {
        id: 'convergence.legacy',
        title: 'The Legacy Statement',
        path: 'convergence.legacy',
        section: 'convergence',
        content: `# The Legacy Statement

## What This Is All For

*[Write this yourself — this is the most important document in the Codex. What is the legacy you are building? What should exist in 10, 20, 50 years because you built this?]*

## Prompt to Write It

Imagine someone reads about Edward Emory Photography 50 years from now. What do they read? What did it mean? What did it create in the world? What do the people who were photographed say about what those images meant to their families?

*Write that. Then build backward from it.*

---

*"The Legacy Codex is not a business tool. It is a record of a life deliberately lived in service of something permanent."*
`,
      },
      {
        id: 'convergence.review',
        title: 'Year-End Reviews',
        path: 'convergence.review',
        section: 'convergence',
        content: `# Year-End Reviews

## Annual Synthesis Template

### *[Year]*

**The headline:** *[One sentence: what did this year accomplish?]*

**Revenue:** *[actual vs. target]*
**Sessions:** *[actual vs. target]*
**Average sale:** *[actual vs. target]*

**What worked:**
-
-
-

**What didn't:**
-
-
-

**What surprised me:**
-

**What I'm carrying forward:**
-
-

**What I'm leaving behind:**
-

**The single most important thing I learned this year:**

---

*[Add a review for each completed year — this becomes the institutional memory of the business]*
`,
      },
    ],
  },
]

// ─────────────────────────────────────────────
// ASSEMBLED SECTIONS
// ─────────────────────────────────────────────
export const CODEX_SECTIONS: CodexSection[] = [
  {
    key: 'root',
    label: 'Root',
    emoji: '⬡',
    color: 'text-codex-root',
    description: 'Core identity, values, mission, and operating principles',
    entries: rootEntries,
  },
  {
    key: 'council',
    label: 'Council',
    emoji: '◈',
    color: 'text-codex-council',
    description: 'Advisors, mentors, and reference frameworks',
    entries: councilEntries,
  },
  {
    key: 'territory',
    label: 'Territory',
    emoji: '◉',
    color: 'text-codex-territory',
    description: 'Geography, market, and competitive landscape',
    entries: territoryEntries,
  },
  {
    key: 'artistic',
    label: 'Artistic Systems',
    emoji: '◎',
    color: 'text-codex-artistic',
    description: 'Aesthetic philosophy, technical standards, and session craft',
    entries: artisticEntries,
  },
  {
    key: 'neuro',
    label: 'Neuro',
    emoji: '◇',
    color: 'text-codex-neuro',
    description: 'Operating as a neurodivergent mind building a precision business',
    entries: neuroEntries,
  },
  {
    key: 'automation',
    label: 'Automation',
    emoji: '⬡',
    color: 'text-codex-automation',
    description: 'Systems and workflows that run the business with precision',
    entries: automationEntries,
  },
  {
    key: 'business',
    label: 'Business',
    emoji: '◈',
    color: 'text-codex-business',
    description: 'Revenue, financial model, offers, and strategy',
    entries: businessEntries,
  },
  {
    key: 'personalos',
    label: 'Personal OS',
    emoji: '◉',
    color: 'text-codex-personalos',
    description: 'Rhythms, energy management, and personal architecture',
    entries: personalosEntries,
  },
  {
    key: 'convergence',
    label: 'Convergence',
    emoji: '◎',
    color: 'text-codex-convergence',
    description: 'Where all systems integrate and cohere into legacy',
    entries: convergenceEntries,
  },
]

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Flatten all entries (and their children) into a single array */
export function flattenEntries(entries: CodexEntry[]): CodexEntry[] {
  const result: CodexEntry[] = []
  for (const entry of entries) {
    result.push(entry)
    if (entry.children) {
      result.push(...flattenEntries(entry.children))
    }
  }
  return result
}

/** Get all entries across all sections, flat */
export function getAllEntries(): CodexEntry[] {
  return CODEX_SECTIONS.flatMap(s => flattenEntries(s.entries))
}

/** Find an entry by id */
export function findEntryById(id: string): CodexEntry | undefined {
  return getAllEntries().find(e => e.id === id)
}

/** Find a section by entry id */
export function findSectionByEntryId(id: string): CodexSection | undefined {
  return CODEX_SECTIONS.find(s =>
    flattenEntries(s.entries).some(e => e.id === id)
  )
}

/** Get entries for a given section key */
export function getSectionEntries(key: SectionKey): CodexEntry[] {
  const section = CODEX_SECTIONS.find(s => s.key === key)
  return section ? flattenEntries(section.entries) : []
}
