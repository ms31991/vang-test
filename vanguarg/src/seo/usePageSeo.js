import { useEffect } from "react";

function clip(text, max = 160) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function upsertMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!content) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!href) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement("link");
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

function absolute(origin, value) {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return new URL(value, origin).href;
}

function graph(origin, jsonLd) {
  if (!jsonLd) return null;
  if (jsonLd.kind === "home") {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "RealEstateAgent",
          name: "Vanguard",
          url: origin + "/",
          description: jsonLd.description,
          areaServed: { "@type": "Country", name: "Switzerland" },
          knowsAbout: [
            "Wohnungen kaufen",
            "Wohnungen mieten",
            "Renovation",
            "Laminat",
            "Parkett",
            "Elektrik",
          ],
        },
        {
          "@type": "WebSite",
          name: "Vanguard",
          url: origin + "/",
          inLanguage: ["de-CH", "en"],
          potentialAction: {
            "@type": "SearchAction",
            target: `${origin}/immobilien?ort={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        },
      ],
    };
  }

  if (jsonLd.kind === "list") {
    return {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: jsonLd.name,
      itemListElement: (jsonLd.items || []).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${origin}/immobilien/${item.id}`,
        name: item.name,
      })),
    };
  }

  if (jsonLd.kind === "listing") {
    const url = `${origin}/immobilien/${jsonLd.id}`;
    const available = jsonLd.status === "available";
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Vanguard", item: `${origin}/` },
            { "@type": "ListItem", position: 2, name: jsonLd.listName, item: `${origin}/immobilien` },
            { "@type": "ListItem", position: 3, name: jsonLd.name, item: url },
          ],
        },
        {
          "@type": "RealEstateListing",
          name: jsonLd.name,
          description: jsonLd.description,
          url,
          image: (jsonLd.images || []).map((src) => absolute(origin, src)),
          address: {
            "@type": "PostalAddress",
            addressLocality: jsonLd.city || undefined,
            streetAddress: jsonLd.address || undefined,
            addressCountry: "CH",
          },
          numberOfRooms: jsonLd.rooms || undefined,
          floorSize: jsonLd.area
            ? { "@type": "QuantitativeValue", value: jsonLd.area, unitCode: "MTK" }
            : undefined,
          offers: {
            "@type": "Offer",
            price: jsonLd.price,
            priceCurrency: "CHF",
            businessFunction: jsonLd.listingType === "rent"
              ? "http://purl.org/goodrelations/v1#LeaseOut"
              : "http://purl.org/goodrelations/v1#Sell",
            availability: available ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
            url,
          },
        },
      ],
    };
  }

  return null;
}

export function usePageSeo({ title, description, path = "/", image, noindex = false, jsonLd }) {
  const ldKey = jsonLd ? JSON.stringify(jsonLd) : "";

  useEffect(() => {
    const origin = window.location.origin;
    const url = new URL(path, origin).href;
    const text = clip(description);
    const locale = document.documentElement.lang === "en" ? "en_CH" : "de_CH";

    document.title = title;
    upsertMeta("name", "description", text);
    upsertMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");
    upsertLink("canonical", url);
    upsertMeta("property", "og:site_name", "Vanguard");
    upsertMeta("property", "og:type", jsonLd?.kind === "listing" ? "article" : "website");
    upsertMeta("property", "og:locale", locale);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", text);
    upsertMeta("property", "og:url", url);
    upsertMeta("property", "og:image", image ? absolute(origin, image) : `${origin}/logo-on-dark.svg`);
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", text);

    const data = graph(origin, jsonLd);
    let script = document.getElementById("page-jsonld");
    if (data) {
      if (!script) {
        script = document.createElement("script");
        script.id = "page-jsonld";
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = JSON.stringify(data);
    } else {
      script?.remove();
    }
  }, [title, description, path, image, noindex, ldKey]);
}
