export const TAXONOMY_VERSION = 1;

export const LABELS = {
  hiring: 'Hiring',
  opportunity: 'Opportunity',
  career_update: 'Career update',
  advice_learning: 'Advice & learning',
  news_announcement: 'News & announcement',
  promotion: 'Promotion',
  conversation: 'Conversation',
  other: 'Other'
} as const;

export type Label = keyof typeof LABELS;

export const CRITERIA: Record<Label, string> = {
  hiring: 'A specific open job or role, with an invitation to apply, contact someone, or refer a candidate. Includes a referral for a specific vacancy. When a post both announces a personal move and explicitly recruits for a role, choose this.',
  opportunity: 'Actionable career opportunities other than a specific vacancy: internships, fellowships, scholarships, career events, application deadlines, or broad lists of openings. A specific job vacancy belongs in hiring.',
  career_update: 'A personal career milestone: starting or leaving a role, promotion, graduation, certification, work anniversary, or similar change. Not a post whose main purpose is recruiting candidates.',
  advice_learning: 'Practical teaching, career advice, an explanation, a resource, or lessons readers can apply. Not mainly an advertisement for a paid offering.',
  news_announcement: 'Reporting an organization, product, or industry development or launch. Not mainly a sales pitch or personal career milestone.',
  promotion: 'Mainly pitching a product, service, course, newsletter, event ticket, or personal offering, including sponsored advertising.',
  conversation: 'Mainly an opinion, story, question, or discussion prompt without a more specific purpose above.',
  other: 'Readable post text whose main purpose does not match the other categories or cannot be determined from the supplied text.'
};

export interface PostInput {
  text: string;
  author?: string;
  repostText?: string;
}

export interface Classification {
  label: Label;
  confidence: number;
  probabilities: Record<Label, number>;
  model: string;
}

export function isLabel(value: unknown): value is Label {
  return typeof value === 'string' && Object.hasOwn(LABELS, value);
}

export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
