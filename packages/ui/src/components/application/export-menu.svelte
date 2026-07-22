<script lang="ts">
  import { Button, type ButtonSize } from "@glyphx/ui/button";
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
  } from "@glyphx/ui/dropdown-menu";
  import { toast } from "@glyphx/ui/sonner";
  import {
    IconCheck,
    IconChevronDown,
    IconCode,
    IconCopy,
    IconDownload,
    IconFileTypePdf,
    IconFileZip,
  } from '@glyphx/ui/icons';
  /**
   * ExportMenu — Export / Share. Every export goes through the host-injected
   * `saveFile` (desktop = Tauri's native "Save As") when present, else a plain
   * browser download. A compiled PDF is saved from its bytes; until the document
   * has been compiled the PDF item stays disabled (it needs real bytes). When a
   * folder project is open, the whole working directory can be exported as a Zip
   * (delegated to the host via `onExportZip`).
   */
  let {
    source = "",
    filename = "main.tex",
    pdfBytes,
    saveFile,
    onExportZip,
    canExportZip = false,
    size = "sm",
  }: {
    source?: string;
    filename?: string;
    pdfBytes?: Uint8Array;
    saveFile?: (
      bytes: Uint8Array,
      opts: { filename: string; extensions?: string[] },
    ) => Promise<boolean>;
    /** Host-provided "export the open folder project as a Zip". Desktop only. */
    onExportZip?: () => void | Promise<void>;
    /** Whether a folder project is open so the Zip export can run. */
    canExportZip?: boolean;
    size?: ButtonSize;
  } = $props();

  let open = $state(false);
  let root = $state<HTMLDivElement>();

  const baseName = $derived(filename.replace(/\.[^./\\]+$/, "") || "document");

  // Save via the host's native dialog when available (desktop = Tauri), else a
  // plain browser download. Stays quiet if the user cancels the dialog.
  async function saveOrDownload(
    bytes: Uint8Array,
    name: string,
    extensions: string[],
  ) {
    open = false;
    try {
      if (saveFile) {
        const saved = await saveFile(bytes, { filename: name, extensions });
        if (saved) toast.success(`Saved ${name}`);
        return;
      }
      const blob = new Blob([bytes as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${name}`);
    } catch (e) {
      toast.error(`Could not save ${name} — ${e}`);
    }
  }

  let copied = $state(false);

  function exportPdf() {
    // The PDF is the compiled artefact — without bytes there's nothing to save.
    // The menu item is disabled in that state, so this is a belt-and-braces guard.
    if (!pdfBytes) {
      toast.info("Compile the document first to export its PDF.");
      return;
    }
    saveOrDownload(pdfBytes, `${baseName}.pdf`, ["pdf"]);
  }
  const exportTex = () =>
    saveOrDownload(new TextEncoder().encode(source), `${baseName}.tex`, [
      "tex",
    ]);

  async function exportZip() {
    open = false;
    if (!onExportZip) return;
    await onExportZip();
  }

  async function copySource() {
    try {
      await navigator.clipboard.writeText(source);
      copied = true;
      toast.success("Source copied to clipboard");
      setTimeout(() => (copied = false), 1500);
    } catch {
      toast.error("Could not copy — clipboard blocked");
    }
  }

  type Item =
    | { separator: true }
    | {
        separator?: false;
        icon: typeof IconDownload;
        label: string;
        hint?: string;
        disabled?: boolean;
        run: () => void;
      };
  const items = $derived<Item[]>([
    {
      icon: IconFileTypePdf,
      label: "Export PDF",
      hint: pdfBytes ? "Save" : "Compile first",
      disabled: !pdfBytes,
      run: exportPdf,
    },
    {
      icon: IconCode,
      label: "Export .tex",
      hint: "Current file",
      run: exportTex,
    },
    // Zip the whole working directory — only when a folder project is open
    // (desktop). The host injects `onExportZip`; web builds never pass it.
    ...(onExportZip
      ? [
          { separator: true } as Item,
          {
            icon: IconFileZip,
            label: "Export as Zip",
            hint: canExportZip ? "Project" : "Open a folder",
            disabled: !canExportZip,
            run: exportZip,
          } as Item,
        ]
      : []),
    { separator: true } as Item,
    {
      icon: copied ? IconCheck : IconCopy,
      label: copied ? "Copied" : "Copy source",
      run: copySource,
    },
  ]);

  $effect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root && !root.contains(e.target as Node)) open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") open = false;
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
</script>

<DropdownMenu>
  <DropdownMenuTrigger>
    {#snippet child({ props })}
      <Button {...props} size="xs" variant="default_soft" class="rounded-full px-3">
        <IconDownload />
        Export
        <IconChevronDown />
      </Button>
    {/snippet}
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" class="w-52">
    {#each items as item, i (item.separator ? `sep-${i}` : item.label)}
      {#if item.separator}
        <DropdownMenuSeparator />
      {:else}
        {@const Icon = item.icon}
        <DropdownMenuItem disabled={item.disabled} onclick={item.run}>
          <Icon size={16} class="text-muted-foreground" />
          <span class="flex-1">{item.label}</span>
          {#if item.hint}
            <DropdownMenuShortcut>{item.hint}</DropdownMenuShortcut>
          {/if}
        </DropdownMenuItem>
      {/if}
    {/each}
  </DropdownMenuContent>
</DropdownMenu>
