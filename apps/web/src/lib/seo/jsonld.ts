import { absolute, AUTHOR, ORG, SITE_NAME, SITE_URL } from "./site";

type Json = Record<string, unknown>;

const person: Json = {
	"@type": "Person",
	name: AUTHOR.name,
	url: AUTHOR.url,
	image: absolute(AUTHOR.avatar),
	jobTitle: AUTHOR.role,
	sameAs: [...AUTHOR.sameAs]
};

const publisher: Json = {
	"@type": "Organization",
	name: ORG.name,
	url: ORG.url,
	logo: { "@type": "ImageObject", url: ORG.logo }
};

export function organisationLd(): Json {
	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		"@id": `${SITE_URL}/#organization`,
		name: SITE_NAME,
		url: SITE_URL,
		logo: ORG.logo,
		founder: person,
		sameAs: [...AUTHOR.sameAs]
	};
}

export function websiteLd(): Json {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		"@id": `${SITE_URL}/#website`,
		name: SITE_NAME,
		url: SITE_URL,
		publisher: { "@id": `${SITE_URL}/#organization` },
		inLanguage: "en-GB"
	};
}

export function personLd(): Json {
	return { "@context": "https://schema.org", ...person };
}

export function softwareLd(): Json {
	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: SITE_NAME,
		applicationCategory: "DeveloperApplication",
		applicationSubCategory: "LaTeX editor",
		operatingSystem: "Web, Windows, macOS, Linux",
		url: SITE_URL,
		license: "https://www.gnu.org/licenses/gpl-3.0.html",
		author: person,
		// Free with no tier above it, so the price is a fact rather than a lead-in.
		offers: { "@type": "Offer", price: "0", priceCurrency: "USD" }
	};
}

export function articleLd(input: {
	type?: "BlogPosting" | "TechArticle";
	title: string;
	description: string;
	url: string;
	image?: string;
	published?: string;
	modified?: string;
	tags?: readonly string[];
}): Json {
	return {
		"@context": "https://schema.org",
		"@type": input.type ?? "BlogPosting",
		headline: input.title,
		description: input.description,
		mainEntityOfPage: { "@type": "WebPage", "@id": absolute(input.url) },
		url: absolute(input.url),
		image: input.image ? absolute(input.image) : undefined,
		datePublished: input.published,
		dateModified: input.modified ?? input.published,
		author: person,
		publisher,
		keywords: input.tags?.length ? [...input.tags].join(", ") : undefined,
		isAccessibleForFree: true
	};
}

export function faqLd(items: readonly { q: string; a: string }[]): Json | null {
	if (!items.length) return null;
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.q,
			acceptedAnswer: { "@type": "Answer", text: item.a }
		}))
	};
}

export function breadcrumbLd(trail: readonly { name: string; url: string }[]): Json {
	return {
		"@context": "https://schema.org",
		"@type": "BreadcrumbList",
		itemListElement: trail.map((crumb, i) => ({
			"@type": "ListItem",
			position: i + 1,
			name: crumb.name,
			item: absolute(crumb.url)
		}))
	};
}

/** Drops undefined values so the emitted JSON-LD carries no empty keys. */
export function serialise(value: Json): string {
	return JSON.stringify(value, (_key, v) => (v === undefined ? undefined : v));
}
