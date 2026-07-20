<script lang="ts">
  import { Button } from "@glyphx/ui/button";
  import { PanelSection } from "@glyphx/ui/panel-section";
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
  } from "@glyphx/ui/select";
  import {
    AUTO_SAVE_LABELS,
    EDITOR_FONT_LABELS,
    settings,
    type Appearance,
    type AutoSaveMode,
    type EditorFont,
    type LatexGrammar,
    type SidebarPosition,
  } from "@glyphx/ui/settings";
  import { SettingsField } from "@glyphx/ui/settings-field";
  import { SliderControl } from "@glyphx/ui/slider-control";
  import { Spinner } from "@glyphx/ui/spinner";
  import { Switch } from "@glyphx/ui/switch";
  import { IconCheck } from "@tabler/icons-svelte";

  import type { EngineManager } from "../engine-settings.svelte";
  import EngineSettings from "../engine-settings.svelte";
  import type { SidePanelStore } from "./store.svelte";

  /**
   * Settings view — live editor / appearance preferences grouped into titled
   * PanelSections (single-choice dropdowns + Mac-style switches), the engine
   * manager, and the optional OS shell-integration button.
   */
  let {
    store,
    engine,
    hasShellIntegration,
  }: {
    store: SidePanelStore;
    engine?: EngineManager;
    hasShellIntegration: boolean;
  } = $props();

  const appearanceOpts: { value: Appearance; label: string }[] = [
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
    { value: "system", label: "System" },
  ];
  const sidebarOpts: { value: SidebarPosition; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
  ];
  const grammarOpts: { value: LatexGrammar; label: string }[] = [
    { value: "legacy", label: "stex" },
    { value: "lezer", label: "lezer" },
  ];
  const fontOpts = (Object.keys(EDITOR_FONT_LABELS) as EditorFont[]).map(
    (id) => ({ value: id, label: EDITOR_FONT_LABELS[id] }),
  );
  const autoSaveOpts = (Object.keys(AUTO_SAVE_LABELS) as AutoSaveMode[]).map(
    (id) => ({ value: id, label: AUTO_SAVE_LABELS[id] }),
  );
</script>

<!-- A single-choice setting: label on the left, a compact dropdown on the right
     (label + control share one line to save vertical space). -->
{#snippet selectField(
  label: string,
  opts: readonly { value: string; label: string }[],
  current: string,
  onChange: (v: string) => void,
  description = "",
)}
  <SettingsField size="sm" {label} {description} layout="row">
    <Select type="single" value={current} onValueChange={onChange}>
      <SelectTrigger size="sm" class="min-w-[7.5rem] text-xs" aria-label={label}>
        {opts.find((o) => o.value === current)?.label ?? current}
      </SelectTrigger>
      <SelectContent>
        {#each opts as o (o.value)}
          <SelectItem value={o.value}>{o.label}</SelectItem>
        {/each}
      </SelectContent>
    </Select>
  </SettingsField>
{/snippet}

<div class="flex flex-col gap-4 px-1 pt-1 pb-3">
  <PanelSection title="Appearance">
    {@render selectField(
      "Theme",
      appearanceOpts,
      settings.appearance,
      (v) => (settings.appearance = v as Appearance),
    )}
  </PanelSection>

  <PanelSection title="Layout">
    {@render selectField(
      "Side panel",
      sidebarOpts,
      settings.sidebarPosition,
      (v) => (settings.sidebarPosition = v as SidebarPosition),
    )}
  </PanelSection>

  <PanelSection title="Editor">
    {@render selectField(
      "Font",
      fontOpts,
      settings.font,
      (v) => (settings.font = v as EditorFont),
    )}

    <SliderControl
      label="Font size"
      value={settings.fontSize}
      min={8}
      max={80}
      step={2}
      unit="px"
      onchange={(v) => (settings.fontSize = v)}
    />

    {@render selectField(
      "LaTeX grammar",
      grammarOpts,
      settings.grammar,
      (v) => (settings.grammar = v as LatexGrammar),
    )}

    <SettingsField size="sm" label="Line wrapping" layout="row">
      <Switch
        checked={settings.lineWrapping}
        onCheckedChange={(v) => (settings.lineWrapping = v)}
        aria-label="Line wrapping"
      />
    </SettingsField>
  </PanelSection>

  <PanelSection title="Compilation">
    <SettingsField size="sm" label="Live compile" layout="row">
      <Switch
        checked={settings.autoCompile}
        onCheckedChange={(v) => (settings.autoCompile = v)}
        aria-label="Live compile"
      />
    </SettingsField>

    {@render selectField(
      "Auto save",
      autoSaveOpts,
      settings.autoSave,
      (v) => (settings.autoSave = v as AutoSaveMode),
    )}
  </PanelSection>

  {#if engine}
    <PanelSection title="Engine">
      <EngineSettings {engine} />
    </PanelSection>
  {/if}

  {#if hasShellIntegration}
    <PanelSection title="System">
      <SettingsField size="sm" label="Shell integration" layout="row">
        <Button
          variant={store.shellStatus === "done" ? "success_soft" : "default_soft"}
          size="xs"
          disabled={store.shellStatus === "busy"}
          title="Add an “Open with GlyphX” entry to the folder right-click menu"
          onclick={() => store.addShellIntegration()}
        >
          {#if store.shellStatus === "busy"}
            <Spinner class="size-3" /> Adding…
          {:else if store.shellStatus === "done"}
            <IconCheck size={13} /> Added
          {:else}
            Add to menu
          {/if}
        </Button>
      </SettingsField>
    </PanelSection>
  {/if}
</div>
