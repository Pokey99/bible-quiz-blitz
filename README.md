# Bible Quiz Blitz

A mobile-friendly Bible quiz flash-card PWA built with static HTML, CSS, and JavaScript. It can be hosted on GitHub Pages and does not require a backend. The interface uses a black, white, and sky-blue palette, with light, dark, and system appearance options.

On opening, the app starts a continuous shuffled session across all chapters in the newest available year. Use the vertical menu to change year, chapter/week filters, question types, session goal, or appearance, or to open practice history. The logo returns to the default continuous session.

## Current study material

The 2027 Life of David set contains 1 Samuel chapters 16–25, stored as one `.txt` file per chapter under `questions/2027/`. The eight study-week ranges are configured in the app. Weeks 1–3 overlap the currently supplied chapters; Weeks 4–8 will become available as their chapter files are added.

## GitHub Pages

Publish the repository root with GitHub Pages. The app uses relative paths for its assets and service worker, so it works from a user or project Pages URL. HTTPS is required for service workers, and GitHub Pages provides it. The app caches the registered chapter text files after loading them online, so they are available for later offline sessions.

## Adding study material

Add each chapter as a `.txt` file under that study year's folder, then add its path and study year to the `files` array in `question-files.json`:

```json
{
  "files": [
    {
      "path": "questions/2027/1Samuel26Questions.txt",
      "year": 2027
    }
  ]
}
```

The 2027 week ranges are:

1. 1 Samuel 16–18
2. 1 Samuel 19–22:10
3. 1 Samuel 22:11–25
4. 1 Samuel 26–30
5. 1 Samuel 31–2 Samuel 3:25
6. 2 Samuel 3:26–7
7. 2 Samuel 8–12
8. 1 Kings 1:28–2

Selecting a week filters questions by their chapter and verse headings. The prior-material checkbox includes the selected week and all earlier weeks. A week without any registered question files is shown as unavailable.

Each text file uses a book name, a `Chapter N` heading, verse headings such as `16:1`, and question/answer pairs:

```text
1 Samuel
Chapter 16

16:1
SitQ. Who to whom, “How long will you grieve over Saul?”
A. God to Samuel.
FQ. What can youngest also mean?
A. smallest
Q. Who has God rejected from being king over Israel?
A. Saul
```

Use `Q.` for regular questions, `FQ.` for footnote questions, and `SitQ.` for situation questions. Chapter and verse headings supply the ESV reference; the `year` in the registry controls which study year contains the file. The selectors are populated from the registered text files. GitHub Pages does not provide directory listing, so every added chapter file must be registered in `question-files.json`. For example, add new 2027 chapters to `questions/2027/` and use paths like `questions/2027/1Samuel26Questions.txt`.
