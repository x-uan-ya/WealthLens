# WealthLens

### From Portfolio Monitoring to Client Intelligence

**WealthLens** is a private-banking wealth intelligence prototype designed to help Relationship Managers identify which portfolio developments require attention, understand why they matter to a specific client, and prepare for more informed client conversations.

> **Relationship Managers don't need more alerts. They need to know which information matters, to which client, and why.**

---

## Overview

Relationship Managers may oversee many clients, portfolios, market developments, and alerts at the same time.

Traditional portfolio-monitoring systems can identify changes, but the Relationship Manager may still need to manually determine:

* Which clients are actually affected?
* How significant is the impact?
* Why does the development matter to this particular client?
* Does it conflict with the client's goals, risk profile, or liquidity requirements?
* Which clients should be prioritised?
* What should the Relationship Manager review before speaking with the client?

WealthLens explores how portfolio monitoring can evolve into **client-specific wealth intelligence**.

Instead of simply generating more alerts, WealthLens connects:

**Market Developments → Portfolio Exposure → Client Context → Relevance → Relationship Manager Action**

---

## Core Principle

WealthLens is designed to **augment Relationship Managers, not replace them**.

The platform does not autonomously make investment decisions or execute buy/sell recommendations.

Instead, it helps Relationship Managers:

1. Identify situations requiring attention.
2. Understand why a particular client may be affected.
3. Review supporting evidence.
4. Explore potential portfolio scenarios.
5. Prepare for a more informed client conversation.

The Relationship Manager remains responsible for the final judgement and client interaction.

---

## Key Features

### RM Intelligence Dashboard

A central dashboard gives Relationship Managers a prioritised overview of their client base.

It highlights:

* Clients monitored
* Market developments analysed
* Clients requiring attention
* Low-relevance alerts filtered out
* High-priority intelligence

Rather than reviewing every market movement, the RM can focus on situations that are most relevant.

---

### Client Management

Relationship Managers can browse and search their clients using information such as:

* Portfolio value
* Risk profile
* Investment objective
* Current priority
* Relevance score
* Last interaction

Each client has a dedicated profile containing portfolio and wealth-planning context.

---

### Portfolio Overview

Client profiles provide a clear view of:

* Total portfolio value
* Asset allocation
* Portfolio performance
* Cash position
* Risk profile
* Investment horizon
* Liquidity requirements
* Client objectives

This information provides the context required to determine whether a market development is actually relevant to a client.

---

### Intelligence Feed

WealthLens converts portfolio developments into prioritised intelligence.

Example:

**High Priority — Relevance Score: 92/100**

> Semiconductor Concentration Requires Attention

Instead of only reporting that the market moved, WealthLens explains why the development may matter to the individual client.

---

### Client Relevance Score

The **Client Relevance Score** is a core concept within WealthLens.

It represents how important a particular development may be for a specific client.

The prototype considers factors such as:

* Portfolio Exposure
* Market Impact
* Goal Sensitivity
* Urgency

Example:

| Factor                |  Score |
| --------------------- | -----: |
| Portfolio Exposure    |     91 |
| Market Impact         |     82 |
| Goal Sensitivity      |     94 |
| Urgency               |     88 |
| **Overall Relevance** | **92** |

The current prototype uses mock scores for demonstration purposes. The scoring engine is designed to be replaced with real portfolio data and analytical logic in future development.

---

### Why This Client?

Explainability is an important part of WealthLens.

Instead of displaying only a risk or relevance score, the system explains the reasoning behind an intelligence item.

For example:

**Market Development**

↓

**Portfolio Exposure**

↓

**Client Risk Profile**

↓

**Financial Goals**

↓

**Liquidity Requirements**

↓

**Urgency**

↓

**Client Relevance**

Relationship Managers can inspect the underlying evidence before deciding whether action is required.

---

### Evidence & Traceability

Each intelligence item can display supporting information from sources such as:

* Portfolio holdings
* Client profile
* Client objectives
* Market developments
* Scenario analysis

This allows the Relationship Manager to understand where an insight originated rather than relying on an unexplained AI-generated conclusion.

---

### Scenario Lab

The Scenario Lab allows Relationship Managers to explore hypothetical market developments.

Example scenarios include:

* Technology sector −10%
* Equity market −8%
* Interest rates +1%
* USD −5%
* Custom scenarios

The interface displays potential effects on:

* Portfolio value
* Individual holdings
* Portfolio concentration
* Risk thresholds
* Affected clients

The current prototype uses deterministic mock calculations rather than real market forecasting.

---

### RM Intelligence Brief

WealthLens can transform an intelligence item into a structured briefing containing:

* Situation
* Why it matters
* Client context
* Key evidence
* Scenario impact
* Suggested discussion points

The purpose is to reduce preparation time while keeping the Relationship Manager responsible for the final advice.

---

### Client View

WealthLens also demonstrates how complex intelligence could be translated into a simpler client experience.

Relationship Managers receive detailed analysis, while clients receive understandable explanations of:

* What happened
* How their portfolio may be affected
* Why it may matter
* When they may want to speak with their Relationship Manager

This supports the human advisory relationship rather than replacing it.

---

## Technology Stack

The current prototype uses:

* **React**
* **Vite**
* **JavaScript**
* **CSS**
* **Recharts**
* **Lucide React**
* **React Router**

The application is designed for deployment using **Vercel**.

---

## Architecture

```text
                    WealthLens

Market / Portfolio / Client Data
              │
              ▼
      Intelligence Engine
              │
              ▼
      Client Relevance Layer
              │
      ┌───────┴────────┐
      ▼                ▼
 Evidence &        Scenario
 Explanation       Analysis
      │                │
      └───────┬────────┘
              ▼
       RM Intelligence
              │
              ▼
     Relationship Manager
              │
              ▼
       Client Conversation
```

The current prototype uses mock data and simulated intelligence.

The architecture is intentionally modular so that future APIs, AI models, databases, and financial datasets can be integrated without rebuilding the frontend.

---

## Project Structure

```text
wealthlens/
│
├── public/
│
├── src/
│   ├── components/
│   │   ├── Sidebar
│   │   ├── Header
│   │   ├── KPICard
│   │   ├── IntelligenceCard
│   │   ├── RelevanceScore
│   │   ├── EvidencePanel
│   │   └── PortfolioChart
│   │
│   ├── pages/
│   │   ├── Dashboard
│   │   ├── Clients
│   │   ├── ClientProfile
│   │   ├── Intelligence
│   │   ├── ScenarioLab
│   │   ├── Briefings
│   │   └── ClientView
│   │
│   ├── data/
│   │   ├── clients.js
│   │   ├── portfolios.js
│   │   ├── intelligence.js
│   │   ├── marketEvents.js
│   │   └── scenarios.js
│   │
│   ├── services/
│   │   ├── clientService.js
│   │   ├── portfolioService.js
│   │   └── intelligenceService.js
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── index.html
├── package.json
├── vite.config.js
├── vercel.json
└── README.md
```

The exact structure may change as development progresses.

---

## Running Locally

Clone the repository:

```bash
git clone <repository-url>
cd wealthlens
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Create a production build:

```bash
npm run build
```

---

## Deployment

The application is configured for deployment on Vercel.

### Deploy through GitHub

1. Push the project to GitHub.
2. Sign in to Vercel.
3. Select **Add New → Project**.
4. Import the GitHub repository.
5. Select **Vite** as the framework if it is not automatically detected.
6. Confirm the build configuration.

```text
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

7. Deploy the project.

Future pushes to the connected GitHub branch can automatically trigger new deployments.

---

## Current Prototype Limitations

WealthLens is currently a hackathon prototype.

The current version:

* Uses fictional client data
* Uses mock portfolio information
* Uses simulated market events
* Uses mock intelligence results
* Does not provide real financial advice
* Does not execute trades
* Does not connect to real client banking information
* Does not currently implement production authentication or security
* Does not currently use a live AI model

These components are intentionally separated from the frontend so that real services can be integrated later.

---

## Future Development

The architecture can later support:

### Real Data Integration

Replace mock data services with APIs for:

* Client information
* Portfolio holdings
* Market information
* Research
* Investment events

### Intelligence Engine

Future versions could incorporate AI and analytical models to:

* Analyse market developments
* Identify affected portfolios
* Connect events with client circumstances
* Generate explainable intelligence
* Prioritise Relationship Manager attention

### Responsible AI

Future AI integration should maintain:

* Human oversight
* Explainability
* Evidence traceability
* Data privacy
* Auditability
* Appropriate financial-services controls

AI-generated information should support professional judgement rather than independently making investment decisions.

---

## Vision

Traditional portfolio monitoring answers:

**“What changed?”**

WealthLens aims to answer:

**“What changed, which client does it matter to, why does it matter, and what should the Relationship Manager review next?”**

### WealthLens

**Turning portfolio monitoring into client intelligence.**
