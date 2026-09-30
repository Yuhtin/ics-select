# Mock route plugins

One file per screen group, for example `member-extra.mjs` or `admin-library.mjs`. Each file default-exports:

```js
export default async function ({ req, url, role, body, path, method, db, notFound }) {
  if (method === 'GET' && path === '/me/calendar') return { body: { ... } };
  // Return undefined when the request isn't yours.
}
```

- `role` is `'member'` or `'admin'`. Enforce admin-only endpoints yourself by returning `{ status: 403, body: { error: { code: 'FORBIDDEN', message } } }`.
- `db` is the shared in-memory state in `../server.mjs` (members, cycle, library, plans, feed, alerts, and helpers). Mutate it in place.
- Plugins run before the built-in routes, so a plugin can override a built-in endpoint.
- To send a non-JSON body, like CSV, return `{ raw: '<text>', contentType: 'text/csv' }`.
