export interface HerbAction {
  term: string;
  translation: string;
}

export interface FullHerb {
  name: string;
  latin: string;
  actions: HerbAction[];
  constitutionalMatch: string;
  preparation: string;
  safety: string;
}

export interface CautionHerb {
  name: string;
  latin: string;
  reason: string;
}

export interface FullGuideContent {
  slug: string;
  constitutionType: string;
  nickname: string;
  tagline: string;

  chapterOne: {
    subtitle: string;
    paragraphs: string[];
    physicalTendencies: string[];
    emotionalTendencies: string[];
    whenImbalanced: string;
  };

  chapterTwo: {
    subtitle: string;
    paragraphs: string[];
  };

  chapterThree: {
    subtitle: string;
    paragraphs: string[];
    scriptureVerse: string;
    closingParagraph: string;
  };

  chapterFour: {
    subtitle: string;
    intro: string;
    herbs: FullHerb[];
  };

  cautionHerbs: CautionHerb[];

  chapterFive: {
    subtitle: string;
    dietary: string;
    movement: string;
    restRhythm: string;
    spiritualPractice: string;
  };

  coachingCTA: {
    title: string;
    intro: string;
    body: string;
    bullets: string[];
  };

  courseCTA: {
    title: string;
    subtitle: string;
    body: string;
    bullets: string[];
  };
}
