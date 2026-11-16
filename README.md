# Receipt Truth

A responsive React and Vite receipt analyzer. Try the built-in sample to explore the results without running the backend, or upload a receipt photo and use the analysis API at `http://localhost:8000/analyze`.

The site has three pages: the story and demo at `/`, the receipt analyzer at `/analyze.html`, and a short guide at `/how-it-works.html`. “Analyze a receipt” opens the analyzer page; “Try a demo” opens it with the sample results loaded.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To analyze an uploaded receipt, start the backend separately at `http://localhost:8000`. The app sends the image as multipart form data in the `file` field. The sample receipt works without the backend.
