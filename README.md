# Case Study Builder (React + AI)

Write client case studies by chatting with an AI instead of filling in forms. The AI:

1. asks for the client's website, reads it, and shows you what it found so you can confirm or correct it
2. asks only for what isn't public (the problem, what you built, the workflow, tools, stack, hosting, results), one or two questions at a time, with tap-to-answer options
3. writes polished copy into the case study as you go, and tells you when the draft is ready
4. lets you **Generate & preview**, download a **PDF** or **web page**, and request changes in chat ("shorter title", "add a step") or edit anything in the **Form** tab

It never invents numbers, client names or results, and anything it only guessed is marked as a guess until you confirm it.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
```

Then click the **gear icon** and set:

- **What should the AI call you?** Leave it empty and the AI calls you "storyteller".
- **Provider, API key and model.** Each provider keeps its own key, so you can switch between them. Click **Load my models** to get the exact list your key can use, then **Test connection**.

| Provider | Key from | Website reading |
|---|---|---|
| Claude (Anthropic) | console.anthropic.com | page reader + Claude web search |
| OpenAI (ChatGPT) | platform.openai.com | page reader + OpenAI web search |
| Google Gemini | aistudio.google.com | page reader |
| OpenRouter (many models, one key) | openrouter.ai/keys | page reader |
| Groq | console.groq.com | page reader |
| DeepSeek | platform.deepseek.com | page reader |
| Mistral | console.mistral.ai | page reader |
| Custom (OpenAI-compatible) | your own base URL, e.g. Ollama `http://localhost:11434/v1`, LM Studio, Together, Azure | page reader |

The model names in Settings are only suggestions, because providers rename models often. Use **Load my models** to see the real list. The AI needs a model that supports tool/function calling.

## Attach files in AI chat

Use the paperclip to attach up to four files, with a combined limit of 6 MB per message. Add a question, or send the files on their own for a case study summary. Images include JPEG, PNG and WebP.

| Provider | Attachments |
|---|---|
| Claude | Images up to 3 MB each and PDFs |
| OpenAI | Images and PDFs |
| Gemini | Images, PDFs, MP3, WAV, MP4 and WebM |
| OpenAI-compatible providers | Images with a model and endpoint that support image data URLs |

Attachments are sent to the selected provider. Use a model that supports both the attachment type and tool calling. The browser saves attachment names in the transcript. File contents are available during the current page session, with up to 12 MB kept for follow-up turns. Attach a file again if you need to revisit it after reloading or after its contents become unavailable.

To keep a file in the case study, ask the AI to include it or click **Add to case study** on the chat attachment. You can also upload files, remove them, and move images to the **Hero** from **Form → Attachments**. These files are saved with the draft in the browser and included in saved briefs. Images appear inline in both exports. The web page offers playback for audio and video and downloads for supporting files. The PDF embeds PDFs, audio, and video as files accessible from the PDF reader's attachments panel.

**Page reader:** when **Let the AI read websites** is on, the app's own server fetches the client's pages (`/api/fetch`). It returns the readable text, internal links and **platform clues** found in the page code and server headers: Shopify, WordPress, WooCommerce, Elementor, Wix, Webflow, Next.js, GTM/GA, Meta Pixel, Klaviyo, HubSpot, GoHighLevel, Stripe, Razorpay, Calendly, Cloudflare, Vercel, Netlify and more. The AI uses these to suggest the tech stack and hosting, then confirms them with you.

## Deploy

```bash
npm run build
npm start            # serves dist/ and the API proxy on http://localhost:3000 (PORT=xxxx to change)
```

All AI calls and page reading go through `/api/*` routes defined once in `proxy.mjs`. Vite serves them during `npm run dev` and `npm run preview`, and `server.mjs` serves them in production (Node 18+, no extra packages). This avoids browser CORS errors. On a static-only host (plain Netlify or Vercel static), the AI chat won't connect. Use `npm start` on any Node host (Render, Railway, a VPS, etc.). The form and exports work anywhere. `proxy.mjs` is meant for personal or internal use, so add authentication before exposing it on the public internet.

**About the API key:** it's stored in your browser's localStorage and sent only to the provider through the proxy. This setup suits personal or internal use. If you host it for clients, put the key on the server instead of in the browser.

## How the AI part works

```
src/ai/
  settings.js    provider list (Claude, OpenAI, Gemini, OpenRouter, Groq, DeepSeek, Mistral, Custom), per-provider keys/models, your name
  prompt.js      the interviewer's instructions + current draft; parses [[choices: …]] and [[ready]]
  tools.js       the update_case_study tool (JSON schema generated from schema.js), applyPatch, progress
  providers.js   tool loops for Claude Messages, OpenAI Responses, Gemini generateContent and OpenAI-compatible chat completions;
                 shared tools: update_case_study (save to draft) + fetch_webpage (page reader); Load models; Test connection
proxy.mjs        /api routes: provider proxies + /api/fetch page reader with platform detection
src/components/
  Chat.jsx           ChatGPT-style chat: bubbles, quick-reply chips, "draft ready" card, stop button
  SettingsModal.jsx  provider, API key, model, web browsing, test connection
  PreviewModal.jsx   full-screen preview with PDF / web page downloads and "Ask AI for changes"
```

- Each turn, the AI receives the chat so far and the **current draft** (including your manual edits in the Form tab), so the two stay in sync.
- When the AI saves something, the message shows a small "Updated: Hero, The challenge" label, and the Draft panel ticks off sections.
- The chat and draft autosave in the browser. **New** starts a fresh case study and keeps your brand details.

## Everything else

- `src/schema.js`: every section, field and list. Add a field here and it appears in the form, the AI's instructions and the save tool automatically. Then use it in `src/renderCaseStudy.js`.
- `src/renderCaseStudy.js` + `src/caseStudy.css`: the case-study design (green / navy / mint).
- `src/exporters.js`: PDF (one long page or A4), web page and brief downloads.
- The PDF is built from an image of the page, so its text can't be selected. If you need selectable text, open the downloaded web page in Chrome and use Print → Save as PDF.
