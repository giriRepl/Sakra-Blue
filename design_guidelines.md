# Sakra IKOC Design Guidelines

## Design Approach: Healthcare-Focused Design System

**Selected Approach:** Design System (Material Design foundation) with healthcare industry adaptations
**Justification:** Healthcare applications require trust, clarity, and accessibility. The utility-focused nature (package management, purchases, redemptions) demands consistency and ease of use over visual experimentation. Material Design's elevation system and clear component hierarchy align well with medical contexts where information hierarchy is critical.

**Key Design Principles:**
1. Trust & Credibility: Professional healthcare aesthetic
2. Clarity First: Information hierarchy over decoration  
3. Mobile Accessibility: Large touch targets, clear CTAs
4. Efficiency: Streamlined flows for both customers and staff

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts CDN) - clean, highly legible for medical context
- Display: Inter (consistent family, weight variations for hierarchy)

**Type Scale:**
- Headings (H1): text-4xl font-bold (mobile), text-5xl (desktop)
- Headings (H2): text-3xl font-semibold  
- Headings (H3): text-2xl font-semibold
- Body Large: text-lg font-normal (package descriptions, important info)
- Body: text-base font-normal
- Small/Meta: text-sm text-gray-600
- Buttons: text-base font-semibold

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 24** (e.g., p-4, mb-8, gap-6)

**Container Strategy:**
- Customer pages: max-w-md (mobile-optimized, centered on desktop)
- Admin pages: Full-width with max-w-7xl container for content areas
- Package cards grid: 2-column layout on admin (grid-cols-2), single column on mobile

**Vertical Rhythm:**
- Section spacing: py-12 (mobile), py-16 (desktop)
- Component spacing: mb-6 to mb-8 between major elements
- Card internal padding: p-6

---

## Component Library

### Customer-Facing Components

**Landing Page:**
- Clean header with "Sakra IKOC" branding and Login button (right-aligned)
- Hero section (h-64): Welcoming message about health packages, background using soft medical imagery (abstract health/wellness theme)
- Package cards grid: Single column on mobile, prominent cards with service count badges, "View Details" button
- Trust indicators: Icons with text (e.g., "Flexible validity", "Expert consultations")

**Package Detail Card:**
- Full-width card with elevation shadow
- Package title (H2), price (text-3xl font-bold), validity period
- Services list: Each service as a row with checkmark icon (Heroicons), service name, description (text-sm)
- Bottom sticky CTA: "Buy Now" button (full-width on mobile)

**Purchase Flow:**
- Single-column forms with large input fields (h-12)
- OTP input: 4-6 digit boxes, centered
- Progress indicator at top (steps: Details → Verify → Payment → Success)
- Payment page: Mock card form with standard fields
- Success screen: Centered success icon (Heroicons check-circle), package summary card, "View My Card" button

**User Dashboard:**
- Active card display: Card-style component showing package name, services remaining (progress bars), validity countdown
- Redemption history: Timeline view with service name, date, location

### Admin Components

**Admin Layout:**
- Left sidebar navigation (w-64, fixed on desktop): Logo top, menu items with icons (Heroicons), active state highlighting
- Top bar: Page title (H1), user info dropdown (right)
- Main content area: Full-width with max-w-7xl padding

**Dashboard Cards:**
- Metric cards in 3-column grid: Large number (text-4xl), label below, icon top-right
- Cards have subtle border and padding (p-6)

**Packages Management:**
- 2-column equal-height grid (gap-6)
- Each package card: Title, service count, status toggle switch (top-right), Edit/View buttons (bottom)
- "Create New Package" button: Prominent, top-right of page
- Active/inactive visual distinction: Subtle opacity change on inactive cards

**Create/Edit Package Form:**
- Single column form with clear sections
- Services: Dynamic list with "Add Service" button, each service as removable row with text inputs
- Terms & Conditions: Textarea (h-32)
- Actions: Save (primary) and Cancel buttons at bottom

**Redeem Services Page:**
- Search/filter bar at top: Mobile number search
- User card appears on search: Shows active packages
- Service redemption: Checkbox list of available services with "Redeem Selected" button

---

## Icons & Assets

**Icon Library:** Heroicons (via CDN) - clean, professional style
**Key Icons:**
- Navigation: home, clipboard-list, gift, logout
- Actions: check-circle, x-circle, plus, pencil
- Services: beaker (lab), user-group (consultation), sparkles (therapy)

**Images:**
- Landing hero: Soft-focus medical/wellness background image (people in consultation, modern hospital interior, or abstract health iconography)
- No images needed elsewhere; focus on clean, professional interface

---

## Accessibility & Polish

- All buttons: Minimum h-12 touch target on mobile
- Form inputs: Clear labels, h-12 minimum height, visible focus states
- Error states: Red text with error icon (Heroicons exclamation-circle)
- Loading states: Simple spinner (border-2 border-t-transparent animate-spin)
- No distracting animations; use subtle transitions (transition-all duration-200) for hover states only