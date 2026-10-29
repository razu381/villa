/**
 * PT-PT mirror of the shared interface copy (lib/ui-copy.ts). The 3D demo keeps
 * the EN object; the invitation (shared) switches with the language.
 */

import { UI } from "./ui-copy";

export const UI_PT = {
  ...UI,
  nav: { ...UI.nav, visit: "Visita privada", classic: "Site clássico" },
  form: {
    ...UI.form,
    legend: "A sua visita privada",
    name: "O seu nome",
    phone: "Telefone",
    optional: "opcional",
    home: "Casa preferida",
    homeOptions: [
      { id: "v3", label: "V3 Townhouse" },
      { id: "v4", label: "V4 Premium Villa" },
    ],
    date: "Data preferida",
    time: "Hora do dia",
    timeOptions: [
      { id: "morning", label: "Manhã" },
      { id: "afternoon", label: "Tarde" },
      { id: "evening", label: "Fim de tarde" },
    ],
    submit: "Pedir a sua visita privada",
    sending: "A preparar o seu convite",
    errors: {
      name: "Diga-nos o seu nome, por favor.",
      email: "Introduza um email válido, por favor.",
      date: "Escolha um dia para a visita, por favor.",
    },
    edit: "Alterar os dados",
  },
  card: {
    ...UI.card,
    title: "Um convite",
    for: "para",
    visit: "para visitar",
    the: "a ",
    thanks: "Obrigado",
    confirmBody: "A sua assessora confirmará a visita no prazo de um dia.",
  },
  footer: { ...UI.footer, copyright: "© 2026 Phidias. Vila Leku." },
} satisfies typeof UI;

export const TIME_WORDS_PT = {
  morning: "de manhã",
  afternoon: "à tarde",
  evening: "no fim de tarde",
} as const;
