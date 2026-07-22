<div align="center">

# GlyphTeX

### The LaTeX editor Overleaf should have been.

Write papers, proofs, and theses in real LaTeX, on a tool that runs on your own
computer. Your files stay on your disk, your work compiles without a server, and
nothing has to leave your machine.

**Free in your browser · Free as a desktop app · Open source**

<img src="screenshot.png" alt="GlyphTeX logo" />
</div>

---

## What it is

GlyphTeX is a place to write LaTeX that keeps your work where you can see it: on
your computer.

There are two ways to use it, and they run the same editor.

**In your browser.** Open the page, start typing, and watch the document render
beside you. No account, nothing to install.

**As a desktop app.** The editor, the compiler, and your files all live on your
machine. It keeps working with the wifi switched off.

It is built for the people who spend weeks inside one long document full of math:
researchers, PhD students, and anyone writing a thesis, a proof, or a paper.

## Why we built it

Overleaf did something useful. It took LaTeX, which used to mean a heavy install
and a wall of package errors, and put it one click away. A lot of people wrote
their first paper because of that.

The browser was also the catch. Your project lives on someone else's servers. A
long chapter starts to lag because every keystroke makes a round trip. Let a
build run too long on the free plan and you get a timeout instead of a PDF. Want
version history, a few more collaborators, or Git, and you are reading a pricing
page. None of that has much to do with writing LaTeX. It has to do with running a
cloud.

GlyphTeX starts from the other side. The editor and the compiler run on your
computer. Opening a project means reading a folder. Saving means writing a file.
There is no server in the loop, so there is nothing to time out, nothing to
subscribe to, and nothing of yours sitting on a machine you cannot see.

## What you can do with it

- **Write real LaTeX.** Full math, figures, BibTeX, and the packages a journal
  template or thesis class actually needs. What you write is standard `.tex`
  that any LaTeX setup can read, and the PDF you get is the PDF your reviewer
  gets.
- **Compile on your own machine.** The desktop app ships with a LaTeX engine
  ([Tectonic](https://tectonic-typesetting.github.io/)) built in. No multi
  gigabyte TeX install to fight, no shared build queue, no timeout the night
  before a deadline. The preview keeps up while you type.
- **See the page as you write.** Source on the left, the rendered document on the
  right, updating as you go. Double click a spot in the PDF to jump to the line
  that produced it, and jump the other way too.
- **Open a folder and start.** A project is a normal directory of `.tex` and
  `.bib` files. Open it, edit it, drag files between folders, and back it up the
  way you back up everything else.
- **Use Git without paying for it.** The desktop app has a built in Git client:
  stage and commit, see a side by side diff, browse history, clone a repository,
  and push, pull, or sync with your own remote. Real version control, no
  subscription tier.
- **Read your own errors.** When a build fails, the problems panel lists the
  errors with line numbers you can click. The last good PDF stays on screen
  instead of going blank.
- **Stay private.** Unpublished results, a grant draft, a thesis under embargo:
  none of it is uploaded, indexed, or fed to a model. It sits on your disk and
  nowhere else.

## Where your data goes

The heavy and private work stays local. You reach the cloud only through accounts
you already own.

- **Compiling is local.** The engine runs on your computer. There is no build
  sitting on our servers and nothing to time out.
- **History is yours.** Commits live in your own Git repository, on your disk and
  on the remote you choose.
- **Sharing is opt in.** Nothing leaves your machine unless you send it. We never
  hold a copy of work you did not choose to share.

## Getting started

- **Try it in your browser.** No download and no account.
- **Download the desktop app** for macOS, Windows, and Linux from the
  [Releases](https://github.com/kanakkholwal/glyphtex/releases) page. The desktop
  app updates itself, so you stay on the latest build without reinstalling.

Already have Overleaf projects? They are plain LaTeX underneath. Download the
project folder, drop it into GlyphTeX, and keep writing.

## On the roadmap

These are planned, not shipped, and we would rather say so plainly.

- **Bring your own AI key.** Connect an API key from a provider you trust and use
  it to rephrase a paragraph, draft an equation, or decode a compiler error. The
  request goes from the app straight to your provider, on your own account and
  billing.
- **Dropbox and Google Drive sync.** Keep a project in cloud storage you already
  pay for and pick it up on another machine, under your own account.
- **Share a project.** Hand a project to a collaborator from the desktop app,
  stored only while it is shared and only under your account.

## Contributing

GlyphTeX is open source, and bug reports, ideas, and pull requests are all welcome.
See **[CONTRIBUTING.md](CONTRIBUTING.md)** for how to set the project up on your
machine and submit a change.

## License

GlyphTeX is licensed under the **[GNU General Public License v3.0](LICENSE)**. You
are free to use, study, share, and modify it. If you distribute a modified
version, it has to stay under the same license.
