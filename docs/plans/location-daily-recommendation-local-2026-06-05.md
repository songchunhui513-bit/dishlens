# Location Daily Recommendation Local Implementation Plan

**Goal:** Land the approved option 1 locally: the home daily recommendation card shows a nearby restaurant source and the dish detail page supports restaurant navigation, while keeping the current H5 visual language intact.

**Architecture:** Keep the existing knowledge-base daily dish selection as the fallback. Add a small location recommendation layer that resolves nearby restaurant candidates through a provider abstraction: Amap for mainland China and Google Places for overseas. The UI receives optional restaurant metadata and renders only incremental additions.

**Scope guardrails:**
- Local development only. Do not deploy or change production environment variables.
- Preserve existing home and dish detail layout, typography, colors, and rounded illustration style.
- If map API keys are absent or the provider fails, silently fall back to the current daily recommendation.

## Files

- Create: `/Users/julian/AI点菜/dishlens/src/lib/location-recommendation.ts`
- Create: `/Users/julian/AI点菜/dishlens/src/app/api/v1/recommendations/location/route.ts`
- Modify: `/Users/julian/AI点菜/dishlens/src/hooks/useDailyRecommendation.ts`
- Modify: `/Users/julian/AI点菜/dishlens/src/components/home/HomePage.tsx`
- Modify: `/Users/julian/AI点菜/dishlens/src/components/dish/DishDetailPage.tsx`
- Modify: `/Users/julian/AI点菜/dishlens/src/app/page.tsx`
- Modify: `/Users/julian/AI点菜/dishlens/tests/logic-regressions.test.mjs`

## Behavior

- User grants location permission: choose provider by country.
- China / Hong Kong / Macau / Taiwan: use Amap nearby restaurant search when `AMAP_WEB_SERVICE_KEY` exists.
- Other countries: use Google Places Nearby Search when `GOOGLE_PLACES_API_KEY` exists.
- Radius expands through 2km, 5km, 10km, 20km, 50km. Hide distance text if best candidate is over 50km.
- Card copy prioritizes nearby and good restaurants, but leaves the visual hierarchy close to the approved prototype.
- Detail restaurant card opens navigation. China uses Amap URI URL; overseas uses Google Maps directions URL.
- No API key / API failure / denied location: preserve current today recommendation with no restaurant row.

## Verification

- Unit-level regression test for distance formatting, provider selection, navigation URL generation, and no-key fallback.
- TypeScript build / lint as available.
- Browser check on local H5 at `http://localhost:3101/`.
