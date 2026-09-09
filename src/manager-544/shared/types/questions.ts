/**
 * The five strategic-question categories of a Law 544 request. Single
 * definition shared by the generator (questions/), the wizard UI and the
 * conversation hand-off type.
 */
export type QuestionCategory =
  | 'A_FINANCIAR'
  | 'B_RESPONSABILITATE'
  | 'C_PLANIFICARE'
  | 'D_MONITORIZARE'
  | 'E_CONFORMITATE';

/** Generated questions per category (the shape cached on the conversation hand-off). */
export type QuestionSet = Record<QuestionCategory, string[]>;
