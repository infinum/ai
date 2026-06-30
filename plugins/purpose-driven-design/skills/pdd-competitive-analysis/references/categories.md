# Competitive Analysis — Category & Metric Library

Use this reference to select and tailor categories for a given project. Always choose
categories most relevant to the client's goals. Each category lists default metrics; add,
remove, or reword them based on project context.

---

## Universal Categories (always consider these)

### Navigation + Information Architecture
**When to include:** Any website, app, or portal.
- Does the navigation structure make logical sense?
- Are pages and sections labeled appropriately?
- Do I land where I expect when clicking a link?
- Are calls to action (CTAs) clear and prominent?
- Is there a clear page/screen hierarchy?

### Visual Design + Layout
**When to include:** Any digital product.
- Is there a clear, consistent visual identity?
- Is white space used effectively (not too dense, not too sparse)?
- Is there a clear visual hierarchy on each page?
- Is the design consistent across all pages/screens?
- Does the design evoke the appropriate emotional tone?

### Content Quality + Writing
**When to include:** Any content-heavy product or website.
- Is content easy to scan (headers, bullets, short paragraphs)?
- Is the tone of voice appropriate for the audience?
- Is content accurate and up to date?
- Are acronyms and jargon explained?
- Does the site prefer visuals over dense text where appropriate?

### Trust + Credibility
**When to include:** B2C products, services requiring user trust, e-commerce.
- Does the organisation have clearly communicated history/background?
- Are social proof elements present (reviews, testimonials, case studies)?
- Are certifications, licenses, and awards displayed?
- Are privacy and security signals clear (SSL, policies)?
- Are statistics and data well-sourced and presented?

### Mobile + Responsive Experience
**When to include:** Any public-facing product where mobile traffic is expected.
- Does the experience adapt well to small screens?
- Are touch targets large enough to use comfortably?
- Is the mobile navigation pattern intuitive?
- Does content reflow cleanly (no horizontal scrolling)?
- Is performance acceptable on mobile networks?

---

## UX / Product Categories

### Onboarding + First-Run Experience
**When to include:** Apps, SaaS products, portals with login/registration.
- Is the sign-up / registration process simple and fast?
- Is the value proposition communicated before asking for commitment?
- Are empty states helpful rather than blank?
- Is there guidance or a walkthrough for new users?
- Can a user reach value without completing a full profile?

### Search + Filtering
**When to include:** Any product with large content sets, catalogues, or data.
- Can the user search from a persistent, prominent location?
- Do search results return relevant, ranked results?
- Does search tolerate typos and synonyms?
- Are filters and facets available and useful?
- Are zero-results states handled gracefully with suggestions?

### Forms + Data Entry
**When to include:** Any product with contact forms, intake flows, or checkout.
- Are form fields clearly labelled?
- Is required vs optional clearly marked?
- Are inline validation errors immediate and specific?
- Is the form broken into logical steps (if long)?
- Is progress clearly communicated in multi-step flows?

### Error Handling + Recovery
**When to include:** Any transactional or data-entry product.
- Are error messages written in plain language (not codes)?
- Do errors tell users exactly how to recover?
- Are errors shown in context (near the offending field)?
- Does the system prevent errors before they happen where possible?
- Is undo/back functionality available after destructive actions?

### Accessibility
**When to include:** Any product with public access requirements or inclusive design goals.
- Is keyboard navigation fully supported?
- Do images have descriptive alt text?
- Is colour contrast sufficient (WCAG AA minimum)?
- Are form fields associated with proper labels?
- Is the experience usable with a screen reader?

### Performance + Technical Quality
**When to include:** Websites and web apps where speed is a differentiator.
- What is the Page Speed Insights score (desktop)?
- What is the Page Speed Insights score (mobile)?
- Is Time to Interactive under 3 seconds on a standard connection?
- Are images optimised (not oversized)?
- Is there lazy loading for below-the-fold assets?

---

## Business / Service Categories

### Value Proposition + Messaging
**When to include:** Marketing websites, SaaS, any product selling a service.
- Is the core value proposition clear within 5 seconds of landing?
- Is the target audience clearly addressed?
- Is differentiation from competitors communicated?
- Is the call to action prominent and specific?
- Is pricing or cost information clear and accessible?

### Conversion + Lead Generation
**When to include:** Any product with a growth or sales goal.
- Is there a clear primary conversion path?
- Are multiple conversion options available (call, form, chat)?
- Is the sign-up / contact flow frictionless?
- Is there a newsletter or retargeting mechanism?
- Are live chat or chatbot tools present and responsive?

### Customer Support + Help
**When to include:** Products where post-purchase or ongoing support matters.
- Is there a thorough, searchable FAQ / help centre?
- Is it easy to contact support (multiple channels)?
- What is the responsiveness of support (if testable)?
- Is self-service guidance available for common tasks?
- Are community forums or user documentation available?

### Social Proof + Community
**When to include:** B2C, marketplace, or community products.
- Are user reviews or ratings visible and prominent?
- Are case studies or success stories present?
- Is there active social media presence with engagement?
- Is user-generated content surfaced on the product?
- Are partner / client logos featured?

### Personalisation + Relevance
**When to include:** E-commerce, content platforms, apps with returning users.
- Does the experience adapt to returning users?
- Are content recommendations contextually relevant?
- Can users save preferences or history?
- Is location/context used to personalise the experience?
- Is the product available in multiple languages/regions?

---

## Domain-Specific Categories

### Hospitality / Property Management
**When to include:** Hotel, rental, or facilities management products.
- Is availability / booking clearly displayed?
- Is the property/room detail page comprehensive?
- Are pricing and fees transparent?
- Is the booking flow fast and intuitive?
- Are cancellation and modification policies easy to find?

### Healthcare / Wellness
**When to include:** Health services, telehealth, wellness apps.
- Is medical/clinical information presented in plain language?
- Are credentials and practitioner profiles visible?
- Is the booking or appointment flow simple?
- Is there a clear emergency / urgent care pathway?
- Is patient privacy and data security communicated?

### Finance / FinTech
**When to include:** Banking, payment, or financial services products.
- Is security and compliance messaging prominent?
- Is the fee structure transparent and easy to find?
- Are financial data visualisations clear and accurate?
- Is the onboarding KYC/verification flow streamlined?
- Are transaction history and reporting easy to access?

### E-commerce / Retail
**When to include:** Online stores, marketplaces.
- Is the product catalogue easy to browse and filter?
- Is the product detail page comprehensive (images, specs, reviews)?
- Is the add-to-cart and checkout flow fast?
- Are shipping costs and delivery times clear?
- Is the returns and refund policy easy to find?

### Education / Learning
**When to include:** EdTech, corporate training, content learning platforms.
- Is the course/content catalogue easy to explore?
- Is progress tracking visible and motivating?
- Are learning paths or curricula clearly structured?
- Is content available offline or asynchronously?
- Are assessments and feedback mechanisms present?

### SaaS / B2B Platforms
**When to include:** Business software, dashboards, admin tools.
- Is the core workflow discoverable without training?
- Is data visualisation clear and actionable?
- Are role-based permissions well-communicated?
- Is there integration/API documentation available?
- Are bulk actions and power-user features accessible?

---

## Scoring Guidance by Category Type

| Category type | Scoring notes |
|---|---|
| UX heuristics | Score based on direct observation / heuristic review |
| Performance metrics | Score based on tool output (PageSpeed, GTmetrix) |
| Content quality | Score based on reading / review of live content |
| Trust signals | Score based on presence and quality of specific trust elements |
| Business features | Score based on presence + effectiveness (Yes/No → 0 or 3) |

**Leave blank** if the product is not live, not accessible, or if the metric genuinely
cannot be evaluated without user testing data.
