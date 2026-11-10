---
title: "Open in GlyphTeX: link or POST a LaTeX project into the editor"
description: "Add an Open in GlyphTeX button to your site: send a snippet, a .tex URL or a zip URL to /open and the visitor edits and compiles it in their browser. Parameters, examples and the security model."
category: "Integrations"
order: 20
updated: "2026-11-10"
faq:
  - q: "Is there a hosted LaTeX compile API?"
    a: "No. GlyphTeX compiles in the visitor's browser, so there is no server to queue, rate-limit or secure against hostile TeX. Open in GlyphTeX hands the document to the visitor, who compiles it on their own device."
  - q: "Do I need an API key or account?"
    a: "No. The endpoint is public and free. Nothing is stored on a GlyphTeX server: the document is copied into the visitor's browser after they confirm."
  - q: "Can I open a multi-file project?"
    a: "Yes. Use zip_uri to point at a .zip of your project and main_document to name the entry file."
---

:::takeaways
- Link or POST to `https://glyphtex.nexonauts.com/open` with a snippet, a `.tex` URL or a `.zip` URL.
- The visitor sees what is being opened and confirms before anything is copied into their browser.
- Compiling happens on their device. There is no hosted compile API, key or quota.
:::

## Link to a snippet

For short documents, URL-encode the source into `encoded_snip`:

```html
<a href="https://glyphtex.nexonauts.com/open?encoded_snip=%5Cdocumentclass%7Barticle%7D%0A%5Cbegin%7Bdocument%7D%0AHello%0A%5Cend%7Bdocument%7D&snip_name=Hello">
  Open in GlyphTeX
</a>
```

## POST a larger document

Browsers cap URL length, so send long sources as a form:

```html
<form action="https://glyphtex.nexonauts.com/open" method="post" target="_blank">
  <input type="hidden" name="snip" value="\documentclass{article}\begin{document}Hello\end{document}">
  <input type="hidden" name="snip_name" value="Hello">
  <button type="submit">Open in GlyphTeX</button>
</form>
```

## Open a file or project from a URL

```html
<a href="https://glyphtex.nexonauts.com/open?snip_uri=https%3A%2F%2Fexample.org%2Fpaper.tex">Open the paper</a>
<a href="https://glyphtex.nexonauts.com/open?zip_uri=https%3A%2F%2Fexample.org%2Fproject.zip&main_document=main.tex">Open the project</a>
```

The visitor's browser downloads the file, so your host must be public HTTPS and send `Access-Control-Allow-Origin: *`.

## Parameters

Send exactly one of the four source parameters.

| Parameter | Meaning |
| --- | --- |
| `snip` | LaTeX source as plain text (POST, or short GET). |
| `encoded_snip` | The same source, URL-encoded. |
| `snip_uri` | Public HTTPS URL of a single `.tex` file. |
| `zip_uri` | Public HTTPS URL of a `.zip` project. |
| `snip_name` or `name` | Project name, up to 120 characters. |
| `main_document` | Entry file, a relative `.tex` path. Default `main.tex`. |
| `engine` | `pdflatex`, `xelatex`, `lualatex` or `latex_dvipdf`. Accepted for compatibility; GlyphTeX always compiles with XeTeX and says so on the confirm screen. |

Limits: 512 KB for a snippet or `.tex` file, 20 MB for a zip.

## Security model

- **Confirmation first.** The page shows the name, source host and a text preview, and imports only after the visitor clicks. A hostile site cannot silently fill someone's workspace.
- **Source is data.** It is shown as escaped plain text and never rendered as HTML.
- **No server-side fetching.** URLs are downloaded by the visitor's browser, anonymously and without a referrer, so GlyphTeX servers cannot be used to reach internal networks. Only public HTTPS hosts are accepted: no credentials, IP addresses or local names.
- **Hard caps.** Size is enforced before and while downloading, and zip paths are normalised so `..` entries cannot escape the project.
- **No clickjacking.** The page sends `frame-ancestors 'none'`, so it cannot be embedded in another site.
- **Nothing runs on open.** The document is not compiled until the visitor chooses to, and the in-browser engine has no shell access.
