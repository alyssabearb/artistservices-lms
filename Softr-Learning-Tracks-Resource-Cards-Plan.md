# Plan: Fix Resource Cards Showing Only Titles

## What’s going wrong

Resource cards show **only the title** because **full Resource Library records are never loaded**. Description, photos, links, type, etc. all come from that full record. Here’s the data flow and where it breaks.

### Data flow today

1. **Section record**  
   The block is connected to **Training Sections**.  
   `useRecord({ recordId: sectionId })` correctly loads the current section and its **Linked Resources** field.  
   So we get: `section.fields.linkedResources` = array of linked items (e.g. `[{ id: "recXXX", label: "Resource Title - 2025" }, ...]`).

2. **“Full” resource data**  
   The code then calls **`useRecords({ where: q.text("recordId").isOneOf(resourceIds), select: resourcesSelect })`** to load full records (Description, Resource Photo, Resource Link, etc.).

3. **Why that returns nothing**  
   In Softr, a Custom Code block’s **data source is fixed**: it’s the table the block is connected to. So this block is bound to **Training Sections**.  
   So **`useRecords` is querying the Training Sections table**, not the Resource Library table.  
   We’re filtering by `recordId` in `resourceIds`, but those IDs are **Resource Library** record IDs. No Training Section has a `recordId` equal to a Resource Library id, so **we get 0 records back**.

4. **What we actually use**  
   Because `useRecords` returns no rows, `fetchedById` is empty. For each resource we only have the **linked item** from the section (`r` in `linkedArray`). In Airtable/Softr, linked record fields usually return at most **id + primary field (e.g. `label`)**. So we have:
   - **Title** → from `label` (and we strip the year suffix). That’s why titles work.
   - **Description, photo, link, type, etc.** → we try to read from `fetched.fields` or `o.fields` / `o`, but there is no `fetched`, and `o` only has `id` and `label`. So those stay empty and the cards show only the title.

**Root cause:** We need full records from the **Resource Library** table, but we only run `useRecords` on the **Training Sections** table (the block’s data source), so we never get that data.

---

## Ways to fix it

### Option 1: Second block connected to Resource Library (recommended)

Use **two Custom Code blocks** on the Section Detail page:

- **Block A (Training Sections)**  
  - Stays as today: section content, “Back to Course”, and when the section has **no** linked resources, show Prev/Next.  
  - When the section **has** linked resources, **add resource IDs to the URL** (e.g. `resourceIds=rec1,rec2,rec3`) so the other block can read them (e.g. with `replaceState` so the page doesn’t reload).

- **Block B (Resource Library)**  
  - **Connect this block’s data source to the Resource Library table.**  
  - Read `resourceIds` from the URL (same param above).  
  - Call **`useRecords({ where: q.text("recordId").isOneOf(resourceIds), select: resourcesSelect })`** — this will now query **Resource Library**, so you get full records.  
  - Render the resource cards (and Prev/Next when there are resources) using that data.

Result: titles still come from your existing logic (no change to title behavior). Descriptions, photos, links, type-based layout, etc. all work because they come from real Resource Library records.

**Implementation steps:**

1. **Block A (current Resources block, Training Sections)**  
   - When `linkedArray.length > 0`, update the URL to include `resourceIds=<id1>,<id2>,...` (e.g. `window.history.replaceState` with the current path + existing query params + `resourceIds`).  
   - Do **not** render the resource cards in this block when you’re using Block B for that (or keep a minimal fallback that only shows titles if you want).  
   - Keep this block responsible for: section content, and Prev/Next when the section has **no** linked resources.

2. **Block B (new block, Resource Library)**  
   - New component that: reads `resourceIds` from `window.location.search`, runs `useRecords` for Resource Library with those IDs, then renders the full card layout (by Resource Type) and Prev/Next when there are resources.  
   - This block can live in the same file as a second export (e.g. `export function ResourceLibraryBlock()`) or in a separate file you paste into the second Custom Code block.

3. **Navigation**  
   - When a section **has** linked resources: only Block B shows the resource cards and Prev/Next.  
   - When a section has **no** linked resources: only Block A shows Prev/Next (no duplicate nav).

4. **Course Detail (Page 3)**  
   - When building the link to Section Detail, you can optionally append `resourceIds=...` for the current section’s linked resource IDs if you already have them (e.g. from expanded section data). That way the Section Detail page has `resourceIds` in the URL as soon as the user lands, and Block B can load immediately. If you don’t have IDs there, Block A can set `resourceIds` in the URL once the section is loaded, then Block B will run with the updated URL.

---

### Option 2: Rely only on linked-record data (no second block)

If Softr/Airtable can return **expanded** linked records for “Linked Resources” (not just id + label but Description, Resource Photo, etc.):

- In the **section** `useRecord` call, try to request “Linked Resources” with expanded fields (e.g. via select options or Softr docs).  
- If the section’s `linkedResources` array then contains full `fields` (or equivalent) for each resource, we can **stop using `useRecords` for resources** and build the cards from `section.fields.linkedResources` only.  
- No second block and no URL param.

**Caveat:** This only works if Softr actually supports and returns expanded linked-record fields for that field. Many setups only return id + primary field, in which case you’ll still only have titles. So this is worth trying as a diagnostic; if the API doesn’t expose more fields on the link, Option 1 is the reliable fix.

---

### Option 3: Lookup fields on Training Sections

In Airtable:

- Add **Lookup** (or Rollup) fields on **Training Sections** that pull from the linked Resource Library records (e.g. “Resource 1 Description”, “Resource 1 Photo”, or a rollup of multiple fields).  
- In the block, read `section.fields` and parse those lookup fields to get description, photo, etc., and match them to each linked resource by order or by a consistent convention.

**Caveat:** Structure can be awkward (one lookup per resource slot vs array), and you have to maintain lookups for every Resource Library field you need. Option 1 is usually simpler and more flexible.

---

## Recommendation

- **Implement Option 1:** add a second Custom Code block on Section Detail connected to **Resource Library**, pass resource IDs via URL, and have that block run `useRecords` and render the full cards.  
- **Optionally try Option 2** (request expanded Linked Resources in the section select) to see if you can get more data without a second block; if not, Option 1 is the way to get descriptions, photos, and type-based layouts working without changing title behavior.

---

## What not to change

- **Title logic:** Do not change how section, course, track, or resource **titles** are derived (e.g. `getResourceTitle`, `stripYearSuffix`, Section Title / Course Title / Resource Title preferences). The duplicate-nav fix and this plan leave all of that as-is.
