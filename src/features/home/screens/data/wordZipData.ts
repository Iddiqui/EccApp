export type WordZipPuzzle = {
  id: string;
  title: string;
  grid: string[][];
  words: {
    word: string;
    meaning: string;
  }[];
};

export const DAILY_WORD_ZIP: WordZipPuzzle[] = [
  {
    id: 'daily_1',
    title: "Today's Word Zip",
    grid: [
      ['B', 'R', 'A', 'V'],
      ['E', 'S', 'T', 'I'],
      ['M', 'A', 'K', 'E'],
      ['S', 'U', 'R', 'E'],
    ],
    words: [
      {
        word: 'BRAVE',
        meaning: 'Ready to face danger or fear with confidence.',
      },
      {
        word: 'MAKE',
        meaning: 'To form or create something.',
      },
      {
        word: 'SURE',
        meaning: 'Confident and free from doubt.',
      },
    ],
  },

  {
    id: 'daily_2',
    title: "Today's Word Zip",
    grid: [
      ['L', 'E', 'A', 'R'],
      ['N', 'G', 'T', 'O'],
      ['S', 'P', 'E', 'A'],
      ['K', 'B', 'C', 'D'],
    ],
    words: [
      {
        word: 'LEARN',
        meaning: 'To gain knowledge or skill.',
      },
      {
        word: 'SPEAK',
        meaning: 'To talk or communicate.',
      },
      {
        word: 'EARN',
        meaning: 'To receive something in return for work.',
      },
    ],
  },

  {
    id: 'daily_3',
    title: "Today's Word Zip",
    grid: [
      ['F', 'L', 'U', 'E'],
      ['N', 'T', 'A', 'R'],
      ['C', 'O', 'M', 'P'],
      ['S', 'H', 'I', 'K'],
    ],
    words: [
      {
        word: 'FLUENT',
        meaning: 'Able to speak smoothly and easily.',
      },
      {
        word: 'COM',
        meaning: 'A short practice word.',
      },
      {
        word: 'STAR',
        meaning: 'A bright object seen in the sky.',
      },
    ],
  },
];