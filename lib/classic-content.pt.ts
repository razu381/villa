/**
 * PT-PT mirrors of the classic site's chrome (shapes enforced by `satisfies`).
 * Section names follow the docx (it keeps "Village Heart", "Villas", "Aqua
 * Garden" in PT); everything else is ours, pending the client's review.
 */

import { ADVISOR, CLASSIC, GALLERY, NAV, PARTNERS, type GalleryCategory } from "./classic-content";

export const NAV_PT = [
  { id: "concept", label: "Conceito" },
  { id: "village-heart", label: "Village Heart" },
  { id: "villas", label: "Villas" },
  { id: "location", label: "Localização" },
  { id: "gallery", label: "Galeria" },
] satisfies typeof NAV;

export const CLASSIC_PT = {
  visitCta: "Pedir brochura",
  menu: "Menu",
  menuClose: "Fechar",
  top: "Vila Leku — voltar ao topo",
  scroll: "Deslize",
  pillars: "Quatro pilares",
  concept: { eyebrow: "Conceito" },
  villageHeart: { eyebrow: "Village Heart", lead: "Uma aldeia moldada", accent: "pela vida." },
  villas: {
    eyebrow: "Villas",
    lead: "Encontre o seu",
    accent: "lugar.",
    floors: "Três pisos",
    whatsapp: "Marcar uma visita privada",
    interest: "Registar interesse",
    pause: "Parar as fotografias",
    play: "Ver as fotografias",
    prev: "Fotografia anterior",
    next: "Fotografia seguinte",
  },
  location: {
    eyebrow: "Localização",
    band: { title: "A Vista", line: "Vistas panorâmicas sobre o rio" },
    openMap: "Abrir no Google Maps",
    marker: "Sobre o lugar",
    close: "Fechar",
  },
  gallery: { eyebrow: "Galeria", lead: "Explore", accent: "a Vila Leku.", view: "Ver", close: "Fechar", of: "de" },
  visit: {
    eyebrow: "Visita privada",
    lead: "Venha viver a",
    accent: "Vila Leku.",
    body: [
      "Descubra as casas, a paisagem e os espaços partilhados com a assessora dedicada da Vila Leku.",
      "Procura uma residência permanente, uma segunda casa ou um investimento de longo prazo: estamos aqui para ajudar a encontrar o lugar certo.",
    ],
  },
  footer: {
    line: "Uma aldeia contemporânea onde a harmonia natural e a vida moderna se encontram.",
    place: "Leceia, Oeiras · Portugal",
    explore: "Explorar",
    company: "Parceiros",
    contact: "Contacto",
    email: "info@phidias.com",
    privacy: "Política de Privacidade",
    complaints: "Livro de Reclamações",
  },
} satisfies typeof CLASSIC;

export const PARTNERS_PT = PARTNERS.map((p, i) => ({ ...p, ...[
  { role: "Construtora", note: "Excelência na construção" },
  { role: "Financiador", note: "Solidez financeira" },
  { role: "Mediação imobiliária", note: "Parceiro exclusivo" },
][i] })) satisfies typeof PARTNERS;

export const ADVISOR_PT = { ...ADVISOR, role: "Assessora de Clientes" } satisfies typeof ADVISOR;

const GALLERY_PT_TEXT: Record<GalleryCategory, string[]> = {
  architecture: ["Cortiça e calcário", "V4 Premium Villa", "As ruelas", "A entrada", "Muros de calcário"],
  interiors: ["Jantar", "Sala aberta", "Suite principal", "Terraço do quarto", "Quarto", "Casa de banho"],
  landscape: ["A Vista", "O Jardim", "A colina", "Hora dourada"],
  amenities: ["Piscina Natural", "Aqua Garden", "Fitness Studio", "Fitness Studio", "Residents' Hub"],
};
const GALLERY_PT_LABEL: Record<GalleryCategory, string> = {
  architecture: "Arquitetura",
  interiors: "Interiores",
  landscape: "Paisagem",
  amenities: "Comodidades",
};
const GALLERY_PT_LINE: Record<GalleryCategory, (string | undefined)[]> = {
  architecture: [
    "Calcário português e cortiça natural, pensados para envelhecer com elegância.",
    "Piscina e jardim privados.",
    "Caminhos sem carros entre as casas.",
    "Todos os carros chegam ao subsolo.",
    undefined,
  ],
  interiors: [undefined, "A arte de viver sem fronteiras.", undefined, undefined, undefined, undefined],
  landscape: ["Vistas panorâmicas sobre o rio.", "Onde as crianças brincam em liberdade.", "Leceia, Oeiras.", undefined],
  amenities: [
    "Uma piscina natural numa paisagem de lazer ampla e serena.",
    "Uma piscina natural aquecida, integrada no terreno.",
    "Pensado para o movimento e o foco.",
    undefined,
    "Uma extensão da sua casa, dedicada à produtividade.",
  ],
};

/** Same photos, same order (classic-content's GALLERY holds them); PT captions. */
export const GALLERY_PT = GALLERY.map((g) => ({
  ...g,
  label: GALLERY_PT_LABEL[g.id],
  items: g.items.map((it, i) => ({
    ...it,
    title: GALLERY_PT_TEXT[g.id][i] ?? it.title,
    line: GALLERY_PT_LINE[g.id][i] ?? it.line,
  })),
})) satisfies typeof GALLERY;
