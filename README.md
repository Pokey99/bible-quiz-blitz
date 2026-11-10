# Bible Quiz Blitz

A mobile-friendly Bible quiz flash-card PWA built with static HTML, CSS, and JavaScript. It can be hosted on GitHub Pages and does not require a backend. The interface uses a black, white, and sky-blue palette, with light, dark, and system appearance options.

On opening, the app starts a continuous shuffled session across all chapters in the newest available year. Use the vertical menu to change year, chapter/week filters, question types, session goal, or appearance, or to open practice history. The logo returns to the default continuous session.

## Current study material

The 2027 Life of David set contains 303 question-and-answer cards from the supplied 1 Samuel 16 and 17 files. Each card keeps its year, book, chapter, verse, and question type (`regular`, `footnote`, or `situation`) in `questions.json`. The source files do not assign weeks or physical date ranges, so week selection remains unavailable until those dates are provided.

## GitHub Pages

Publish the repository root with GitHub Pages. The app uses relative paths for its assets and service worker, so it works from a user or project Pages URL. HTTPS is required for service workers, and GitHub Pages provides it.

## Adding study material

Append cards to `questions.json` with the same fields:

```json
{
  "year": 2027,
  "book": "1 Samuel",
  "chapter": 16,
  "verse": 1,
  "type": "footnote",
  "question": "Question text",
  "answer": "Answer text"
}
```

The year and chapter selectors are populated from the available questions in `questions.json`. Add each year/book/chapter/verse question with the same fields; chapter order follows the order of its first appearance in the data. When weekly material and dates are available, add a `week`, `weekStart` (ISO date), and optionally `weekEnd` to each card; the week selector will order and label those groups by date.
