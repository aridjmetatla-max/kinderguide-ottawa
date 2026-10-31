# KinderGuide Ottawa (Prototype 2)

A University of Ottawa SED3111 student project. KinderGuide helps Ottawa parents find licensed child care in 4 clear steps:
**1 Find → 2 Shortlist → 3 Visit → 4 Apply**, with every official City of Ottawa and Government of Ontario service in one place.

**Not an official City of Ottawa service.** It is not affiliated with or endorsed by the City of Ottawa.

- Live site: https://aridjmetatla-max.github.io/kinderguide-ottawa/
- Prototype 1 (for comparison): https://aridjmetatla-max.github.io/kinderguide-ottawa/prototype-1/

## What is new in Prototype 2
- A 4-step journey with a progress stepper instead of 8 tabs, and a "Next" button on every step
- An "All services" hub: 11 official tools grouped by task, with search and short answers ("Ask Kip")
- Ottawa Public Health inspection results for 282 of 315 centres (matched by address and name; unsure matches left out)
- Search near home or along the way to work; compare programs side by side; share a shortlist with a partner by link
- Visit checklist (Top 10 first), a 5-task application plan with calendar reminders, and a cost estimator based on Ontario's official cap
- Your child's timeline: from the birth or due date and the date care is needed, KinderGuide searches the right age group (with a 2-year wait, a baby is usually a toddler when care starts)
- A warning with a one-tap fix when there are fewer than 5 options, and a printable "My child care plan"
- "Data insights for the City": infant spaces by postal area, inspection patterns and data gaps, with recommendations
- Full French version; works on phones; no accessibility errors found by axe (WCAG 2 A/AA)
- Google ratings and reviews are built in but switched off until the team adds a restricted API key in `config.js`

## Data and sources
- Contains information licensed under the [Open Government Licence – City of Ottawa](https://ottawa.ca/en/city-hall/open-transparent-and-accountable-government/open-data) (Licensed Child Care Providers dataset).
- Ottawa Public Health inspections of child care premises (data feed of Oct 21, 2026).
- Visit questions paraphrased from the Government of Ontario; staff ratios from Ontario's child care licensing manual.
- Map and address search: © OpenStreetMap contributors.
- Where the licensee is a private person rather than an organisation, their name is not shown.
- KinderGuide shows licensed spaces, not open spots, fees or waitlist lengths.

## Privacy
No account, no cookies, no tracking or analytics. Shortlists, notes and checklist answers stay in the visitor's own browser. A postal code typed in the search is sent to OpenStreetMap's search service only to place it on the map. "Use my location" is used only in the browser and is never sent anywhere. A shared shortlist link contains only program codes.
