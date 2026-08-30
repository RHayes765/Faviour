# Backlog

Ideas and known rough edges, in no particular order. Not commitments.

## Scanner: disclose the data source's limits
The barcode lookup uses Open Food Facts, a crowdsourced open database.
Two things the scanner UI should gently set expectations about:
- **Coverage is groceries.** Food and grocery items match well; non-food
  products (ammo, hardware, cosmetics, etc.) almost certainly won't.
- **Data is crowdsourced.** Entries can be wrong or vandalized (a Zyn can
  once came back as "haram"). The prefilled name is a suggestion to edit,
  not a fact — the UI should frame it that way (e.g. "Found: …" wording
  plus a one-time hint about the source).

## Friendlier error when an OAuth provider is misconfigured
If a provider isn't enabled in Supabase, the app currently opens the browser
and lets Supabase's raw JSON error page show. Detect/handle it in-app instead.

## Insights: "include shared" toggle
Insights currently covers only your own items. Add a toggle to fold shared
lists into the tallies.

## Sharing granularity: per-profile shares
Sharing is currently all-or-nothing for your whole list. Allow sharing a
single profile (e.g. share only the kids' lists with a babysitter).
