# Search Console / Indexing Checklist

Canonical domain assumed: `https://www.rohanstutoring.com`

## Before submission

- Confirm the final live domain is serving the new Vercel site
- Confirm `robots.txt` is reachable:
  - `https://www.rohanstutoring.com/robots.txt`
- Confirm `sitemap.xml` is reachable:
  - `https://www.rohanstutoring.com/sitemap.xml`
- Confirm canonicals on the homepage and main product pages point to `https://www.rohanstutoring.com`

## Search Console setup order

1. Open the property for the final canonical domain
2. Submit the sitemap:
   - `https://www.rohanstutoring.com/sitemap.xml`
3. Use URL Inspection on the homepage first
4. Request indexing for the highest-value money pages next
5. Request indexing for the main discovery pages next
6. Request indexing for major blog and SEO support pages after that

## First URLs to inspect and request indexing for

### Tier 1: do these first

- `https://www.rohanstutoring.com`
- `https://www.rohanstutoring.com/courses`
- `https://www.rohanstutoring.com/courses/comprehensive`
- `https://www.rohanstutoring.com/courses/mastery`
- `https://www.rohanstutoring.com/courses/blueprint`
- `https://www.rohanstutoring.com/courses/advanced`

### Tier 2: do these second

- `https://www.rohanstutoring.com/courses/essay-collection`
- `https://www.rohanstutoring.com/courses/essay-marking`
- `https://www.rohanstutoring.com/courses/private-mentoring`
- `https://www.rohanstutoring.com/courses/starter-pack`
- `https://www.rohanstutoring.com/courses/s1-comprehensive`
- `https://www.rohanstutoring.com/courses/s2-comprehensive`

### Tier 3: discovery and support pages

- `https://www.rohanstutoring.com/about`
- `https://www.rohanstutoring.com/contact`
- `https://www.rohanstutoring.com/blog`
- `https://www.rohanstutoring.com/uk-gamsat`
- `https://www.rohanstutoring.com/ireland-gamsat`

### Tier 4: free tools and lead-gen pages

- `https://www.rohanstutoring.com/quiz`
- `https://www.rohanstutoring.com/quote-generator`
- `https://www.rohanstutoring.com/s1-mock`
- `https://www.rohanstutoring.com/s2-slam-system`
- `https://www.rohanstutoring.com/section-1-tracker`
- `https://www.rohanstutoring.com/webinar`

### Tier 5: blog articles

- `https://www.rohanstutoring.com/blog/how-i-aced-section-1-gamsat`
- `https://www.rohanstutoring.com/blog/ideation`
- `https://www.rohanstutoring.com/blog/mastering-gamsat-s2-task-a-essay`
- `https://www.rohanstutoring.com/blog/poetry-guide`
- `https://www.rohanstutoring.com/blog/stop-falling-for-this-common-gamsat-section-1-trap`
- `https://www.rohanstutoring.com/blog/the-biggest-s2-mistake`

## Do not request indexing for

- `https://www.rohanstutoring.com/webinar/thanks`
- `https://www.rohanstutoring.com/checkout/`
- `https://www.rohanstutoring.com/checkout/success`
- non-canonical legacy `.html` URLs
- legacy redirect source URLs such as `/store/*`

## What to confirm in URL Inspection

- URL is on Google
- Canonical selected by Google matches the declared canonical
- Page is crawlable
- Page is not blocked by `robots.txt`
- Referring page or sitemap is detected where expected

## First 72-hour checks

- Search Console shows sitemap fetch success
- No spike in excluded or redirect-only indexed URLs
- No canonical mismatch warnings on main pages
- No soft-404 warnings on course pages
- No mobile usability issues on the main money pages

## Signoff

- Sitemap submitted: `yes / no`
- Tier 1 URLs requested: `yes / no`
- Tier 2 URLs requested: `yes / no`
- Tier 3 URLs requested: `yes / no`
- Tier 4 URLs requested: `yes / no`
- Tier 5 URLs requested: `yes / no`
