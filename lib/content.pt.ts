/**
 * PT-PT mirrors of lib/content.ts's story copy (shapes enforced by `satisfies`).
 * The PT-PT paragraphs are the client's own (Site Vila Leku_textos.docx); the
 * rest (homes' specs, headings' accents) is ours, pending the client's review.
 */

import {
  AMENITIES,
  CONCEPT,
  HEART,
  HOMES,
  LOCATION,
  VILLA_FLOORS,
  type HomeContent,
  type PlaceContent,
} from "./content";

export const CONCEPT_PT = {
  title: "Vila Leku: um Castro moderno.",
  intro:
    "Inspirados no vigor da fortificação ancestral do Castro de Leceia, traduzimos a herança da povoação num ecossistema residencial contemporâneo e resiliente.",
  pillars: [
    {
      title: "Santuário Pedonal",
      text: "Ao acolher a circulação automóvel em garagens subterrâneas discretas, devolve-se a superfície à experiência humana. Um oásis onde as crianças brincam em liberdade e os adultos caminham em harmonia, numa reinterpretação contemporânea da segurança, do silêncio e do encontro.",
    },
    {
      title: "Solidez",
      text: "A construção em Light Steel Frame (LSF) assegura resistência, durabilidade e um processo construtivo limpo e ecológico, associado a um conforto térmico e acústico que confere a todas as casas a classificação energética A.",
    },
    {
      title: "Autonomia",
      text: "A energia solar integrada e a gestão inteligente da água oferecem independência da rede (off-grid). Uma escolha que se sustenta, e se valoriza, com o tempo.",
    },
    {
      title: "Durabilidade",
      text: "A união da pedra calcária portuguesa com a cortiça natural desenha uma beleza intemporal e sem esforço de manutenção, concebida para envelhecer com elegância ao longo de gerações.",
    },
  ],
} satisfies typeof CONCEPT;

export const AMENITIES_PT = [
  { id: "garden", title: "O Jardim", text: "Desenhado em harmonia com a flora autóctone, é um espaço verde contínuo e seguro." },
  { id: "aqua", title: "Aqua Garden", text: "Piscina biológica aquecida, perfeitamente integrada no relevo natural do terreno." },
  { id: "fitness", title: "Fitness Studio", text: "Desenhado para o movimento e para o foco." },
  { id: "hub", title: "Residents' Hub", text: "Uma extensão da sua casa dedicada à produtividade." },
] satisfies typeof AMENITIES;

/** The docx keeps the first floor's name ("Open Living Space") in PT too. */
export const VILLA_FLOORS_PT = [
  {
    title: "Open Living Space",
    text: "A arte de bem viver, sem fronteiras. Desenhadas em três pisos, estas moradias harmonizam a energia do convívio com o recolhimento e quietude dos espaços privados.",
  },
  { title: "O Piso Superior Privado", text: "O piso superior é um espaço de repouso e privacidade." },
  { title: "Cave Privativa", text: "O espaço de arrumação privado integra-se, com discrição, no piso subterrâneo contínuo." },
] satisfies typeof VILLA_FLOORS;

export const LOCATION_PT = {
  lead: "Perto de tudo.",
  accent: "Longe do barulho.",
  body: "Posição elevada, com vistas panorâmicas e privacidade natural. Viva o silêncio das colinas a minutos das melhores comodidades urbanas.",
  groups: [
    { title: "Negócios e Inovação", places: [{ name: "Taguspark", min: 5 }, { name: "Lagoas Park", min: 7 }] },
    { title: "Educação", places: [{ name: "OIS School", min: 4 }, { name: "Nova SBE", min: 12 }] },
    {
      title: "Cultura e Lazer",
      places: [
        { name: "Parque dos Poetas", min: 10 },
        { name: "Oeiras Parque", min: 8 },
        { name: "Praias", min: 10 },
        { name: "Oeiras Green Valley (Golf)", min: 6 },
      ],
    },
    { title: "Acesso à Cidade", places: [{ name: "Centro de Lisboa", min: 15 }, { name: "Cascais", min: 15 }] },
  ],
} satisfies typeof LOCATION;

const HOMES_PT_SPECIFICS: Record<"v3" | "v4", { kind: string; status: string; specs: string[] }> = {
  v3: {
    kind: "Moradia",
    status: "Disponível já",
    specs: ["3 quartos", "3 casas de banho", "Jardim privado", "Suite principal com terraço", "Sala em open-space", "2 lugares de estacionamento"],
  },
  v4: {
    kind: "Villa premium",
    status: "Chega em 2028",
    specs: ["4 quartos", "4 casas de banho", "Piscina privada", "Elevador privado", "Escritório em casa", "Garagem ampla"],
  },
};

export const HOMES_PT: HomeContent[] = HOMES.map((h) => ({ ...h, ...HOMES_PT_SPECIFICS[h.id] }));

export const HEART_PT = {
  ...HEART,
  kind: "Espaços partilhados",
  status: "Para residentes",
  area: "Pavilhão e piscina",
} satisfies PlaceContent;
