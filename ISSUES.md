# Tommy’s Club Fix and Improvement Checklist

This is the project’s shared, editable list of confirmed bugs and worthwhile improvements. It is deliberately practical: a short map of what needs attention, what is being worked on, and what has been verified.

## How to add an item

- Search this file and the GitHub issue tracker before adding a duplicate.
- Keep one bug or improvement per checklist item.
- Link the GitHub issue when one exists.
- Include the affected page or feature and a short, reproducible description.
- Put detailed logs, screenshots, expected behavior, and reproduction steps in the linked issue.
- Never include passwords, API keys, session cookies, verification links, private email addresses, or other personal data.
- Do not mark an item complete until the fix has been tested in the relevant local or deployed environment.
- Contributors without write access should edit this file in a fork and open a focused pull request.

## Active checklist

### Bugs

- [ ] Add a confirmed bug here — link: `#issue-number`

### Improvements

- [ ] Add a proposed improvement here — link: `#issue-number`

### Verification and maintenance

- [ ] Review dependency audit results before each production release.
- [ ] Recheck Supabase RLS, grants, and server-only tables after schema changes.
- [ ] Test login, confirmation, terms acceptance, transition, uploads, and chat after deployment changes.

## Completed

Move verified items here with the pull request or commit that fixed them.
