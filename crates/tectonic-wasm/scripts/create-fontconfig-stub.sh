#!/bin/sh
set -e
SYSROOT=${1:-/work/emsdk/upstream/emscripten/cache/sysroot}
mkdir -p $SYSROOT/include/fontconfig

cat > $SYSROOT/include/fontconfig/fontconfig.h << 'H'
#ifndef _FONTCONFIG_H_
#define _FONTCONFIG_H_
typedef int FcBool;
typedef unsigned char FcChar8;
typedef unsigned int FcChar32;
typedef struct _FcPattern FcPattern;
typedef struct _FcConfig FcConfig;
typedef struct _FcFontSet FcFontSet;
typedef struct _FcObjectSet FcObjectSet;
typedef enum { FcResultMatch, FcResultNoMatch, FcResultTypeMismatch, FcResultNoId, FcResultOutOfMemory } FcMatchKind;
#define FcTrue 1
#define FcFalse 0
#define FC_FAMILY "family"
#define FC_STYLE "style"
#define FC_FILE "file"
#define FC_INDEX "index"
#define FC_SLANT "slant"
#define FC_WEIGHT "weight"
#define FC_WIDTH "width"
#define FC_FULLNAME "fullname"
#define FC_POSTSCRIPT_NAME "postscriptname"
#endif
H

cat > /tmp/fc_stub.c << 'C'
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

typedef int FcBool;
typedef unsigned char FcChar8;
typedef unsigned int FcChar32;

#define FcTrue 1
#define FcFalse 0
#define FC_FAMILY "family"
#define FC_STYLE "style"
#define FC_FILE "file"
#define FC_INDEX "index"
#define FC_FULLNAME "fullname"

typedef enum { FcResultMatch = 0, FcResultNoMatch } FcResult;
typedef enum { FcMatchPattern, FcMatchFont, FcMatchScan } FcMatchKind;

typedef struct _FcPattern {
    char family[256];
    char file[256];
    int has_file;
} FcPattern;

typedef struct _FcFontSet { int nfont; FcPattern **fonts; } FcFontSet;
typedef struct _FcObjectSet { int dummy; } FcObjectSet;
typedef struct _FcConfig { int dummy; } FcConfig;

typedef struct { const char *name; const char *file; } FontMapping;

static const FontMapping font_map[] = {
    {"lmroman10-regular",    "lmroman10-regular.otf"},
    {"lmroman10-bold",       "lmroman10-bold.otf"},
    {"lmroman10-italic",     "lmroman10-italic.otf"},
    {"lmroman10-bolditalic", "lmroman10-bolditalic.otf"},
    {"lmroman12-regular",    "lmroman12-regular.otf"},
    {"lmroman12-bold",       "lmroman12-bold.otf"},
    {"lmroman17-regular",    "lmroman17-regular.otf"},
    {"lmroman7-italic",      "lmroman7-italic.otf"},
    {NULL, NULL}
};

static const char* find_font(const char *family) {
    if (!family) return "lmroman10-regular.otf";
    for (int i = 0; font_map[i].name; i++)
        if (strcasecmp(family, font_map[i].name) == 0) return font_map[i].file;
    char lower[256]; int len = strlen(family);
    if (len >= 255) len = 255;
    for (int i = 0; i < len; i++)
        lower[i] = (family[i] >= 'A' && family[i] <= 'Z') ? family[i] + 32 : family[i];
    lower[len] = '\0';
    int is_bold = strstr(lower, "bold") != NULL;
    int is_italic = strstr(lower, "italic") != NULL;
    if (strstr(lower, "roman") || strstr(lower, "lmr") || strstr(lower, "latin modern")) {
        if (is_bold && is_italic) return "lmroman10-bolditalic.otf";
        if (is_bold) return "lmroman10-bold.otf";
        if (is_italic) return "lmroman10-italic.otf";
        return "lmroman10-regular.otf";
    }
    fprintf(stderr, "[fontconfig] unknown font '%s' -> lmroman10-regular.otf\n", family);
    return "lmroman10-regular.otf";
}

FcBool FcInit(void) { return FcTrue; }
void* FcInitLoadConfigAndFonts(void) { static FcConfig c={0}; return &c; }
void* FcConfigGetCurrent(void) { static FcConfig c={0}; return &c; }
FcBool FcConfigSubstitute(void*c,void*p,int k) { return FcTrue; }
void FcDefaultSubstitute(void*p) {}

FcPattern* FcNameParse(const FcChar8 *name) {
    FcPattern *p = (FcPattern*)calloc(1, sizeof(FcPattern));
    if (p && name) {
        const char *s = (const char*)name;
        if (s[0] == '[') s++;
        int i = 0;
        while (s[i] && s[i] != ']' && s[i] != ':' && i < 255) { p->family[i] = s[i]; i++; }
        p->family[i] = '\0';
        fprintf(stderr, "[fontconfig] FcNameParse: '%s' -> '%s'\n", (const char*)name, p->family);
    }
    return p;
}

FcPattern* FcFontMatch(void*c, void*pattern, void*result) {
    FcPattern *p = (FcPattern*)pattern;
    if (!p) return NULL;
    const char *file = find_font(p->family);
    FcPattern *m = (FcPattern*)calloc(1, sizeof(FcPattern));
    if (m) { strncpy(m->family, p->family, 255); strncpy(m->file, file, 255); m->has_file = 1;
        fprintf(stderr, "[fontconfig] match: '%s' -> '%s'\n", p->family, file); }
    if (result) *(int*)result = FcResultMatch;
    return m;
}

FcPattern* FcPatternCreate(void) { return (FcPattern*)calloc(1, sizeof(FcPattern)); }
FcBool FcPatternAddString(void*p, const char*o, const FcChar8*v) {
    if (!p) return FcFalse;
    if (strcmp(o, FC_FAMILY)==0 || strcmp(o, FC_FULLNAME)==0) strncpy(((FcPattern*)p)->family, (const char*)v, 255);
    return FcTrue;
}
int FcPatternGetString(void*p, const char*o, int n, FcChar8**v) {
    FcPattern *fp = (FcPattern*)p; if (!fp) return 1;
    if (strcmp(o, FC_FILE)==0 && fp->has_file) { *v = (FcChar8*)fp->file; return 0; }
    if (strcmp(o, FC_FAMILY)==0 || strcmp(o, FC_FULLNAME)==0) { *v = (FcChar8*)fp->family; return 0; }
    return 1;
}
int FcPatternGetInteger(void*p, const char*o, int n, int*v) { if (v) *v = 0; return 0; }
void FcPatternDestroy(void*p) { if (p) free(p); }
void FcPatternReference(void*p) {}
void FcFontSetDestroy(void*s) { if (s) free(s); }
FcFontSet* FcFontSetCreate(void) { return (FcFontSet*)calloc(1, sizeof(FcFontSet)); }
FcObjectSet* FcObjectSetCreate(void) { return (FcObjectSet*)calloc(1, sizeof(FcObjectSet)); }
FcBool FcObjectSetAdd(void*os,const char*o) { return FcTrue; }
void FcObjectSetDestroy(void*os) { if(os) free(os); }
FcFontSet* FcFontList(void*c,void*p,void*o) { return FcFontSetCreate(); }
C
emcc -c /tmp/fc_stub.c -o /tmp/fc_stub.o -I$SYSROOT/include
emar rcs $SYSROOT/lib/wasm32-emscripten/libfontconfig.a /tmp/fc_stub.o
rm -f /tmp/fc_stub.c /tmp/fc_stub.o
echo "Fontconfig stub with Latin Modern font mapping installed"
