import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  Animated,
  Alert,
} from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  DAILY_WORD_ZIP,
  WordZipPuzzle,
} from './data/wordZipData';

const { width } = Dimensions.get('window');

const GRID_SIZE = Math.min(width - 48, 340);
const CELL_SIZE = GRID_SIZE / 4;

const STORAGE_KEY = '@ecc_word_zip_daily';

type SelectedCell = {
  row: number;
  col: number;
};

type SavedGame = {
  puzzleIndex: number;
  startedAt: number;
  foundWords: string[];
};

const getDistance = (
  a: SelectedCell,
  b: SelectedCell,
) => {
  return Math.max(
    Math.abs(a.row - b.row),
    Math.abs(a.col - b.col),
  );
};

const getDailyPuzzle = (
  puzzleIndex: number,
): WordZipPuzzle => {
  return DAILY_WORD_ZIP[puzzleIndex];
};

const getPuzzleIndex = () => {
  const dayNumber = Math.floor(
    Date.now() / (24 * 60 * 60 * 1000),
  );

  return dayNumber % DAILY_WORD_ZIP.length;
};

const getCellFromPosition = (
  x: number,
  y: number,
): SelectedCell | null => {
  const col = Math.floor(x / CELL_SIZE);
  const row = Math.floor(y / CELL_SIZE);

  if (
    row < 0 ||
    row >= 4 ||
    col < 0 ||
    col >= 4
  ) {
    return null;
  }

  return {
    row,
    col,
  };
};

export default function WordZipGameScreen() {
  const [puzzle, setPuzzle] =
    useState<WordZipPuzzle | null>(null);

  const [selectedCells, setSelectedCells] =
    useState<SelectedCell[]>([]);

  const [currentWord, setCurrentWord] =
    useState('');

  const [foundWords, setFoundWords] =
    useState<string[]>([]);

  const [isDragging, setIsDragging] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState('Swipe letters to make words');

  const selectedRef =
    useRef<SelectedCell[]>([]);

  const foundWordsRef =
    useRef<string[]>([]);

  const puzzleRef =
    useRef<WordZipPuzzle | null>(null);

  useEffect(() => {
    loadDailyGame();
  }, []);

  const loadDailyGame = async () => {
    try {
      const todayIndex = getPuzzleIndex();

      const saved =
        await AsyncStorage.getItem(STORAGE_KEY);

      if (saved) {
        const data: SavedGame =
          JSON.parse(saved);

        const hoursPassed =
          (Date.now() - data.startedAt) /
          (1000 * 60 * 60);

        // 24 hours complete
        if (
          hoursPassed < 24 &&
          data.puzzleIndex === todayIndex
        ) {
          const currentPuzzle =
            getDailyPuzzle(data.puzzleIndex);

          setPuzzle(currentPuzzle);
          puzzleRef.current =
            currentPuzzle;

          setFoundWords(data.foundWords);
          foundWordsRef.current =
            data.foundWords;

          setLoading(false);
          return;
        }
      }

      const newPuzzle =
        getDailyPuzzle(todayIndex);

      const newGame: SavedGame = {
        puzzleIndex: todayIndex,
        startedAt: Date.now(),
        foundWords: [],
      };

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(newGame),
      );

      setPuzzle(newPuzzle);
      puzzleRef.current = newPuzzle;

      setFoundWords([]);
      foundWordsRef.current = [];

      setLoading(false);
    } catch (error) {
      console.log(
        'Word Zip load error:',
        error,
      );

      setLoading(false);
    }
  };

  const saveGame = async (
    words: string[],
  ) => {
    if (!puzzle) return;

    try {
      const saved =
        await AsyncStorage.getItem(STORAGE_KEY);

      const data: SavedGame = saved
        ? JSON.parse(saved)
        : {
            puzzleIndex:
              getPuzzleIndex(),
            startedAt: Date.now(),
            foundWords: [],
          };

      data.foundWords = words;

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(data),
      );
    } catch (error) {
      console.log(
        'Word Zip save error:',
        error,
      );
    }
  };

  const buildWord = (
    cells: SelectedCell[],
  ) => {
    if (!puzzleRef.current) return '';

    return cells
      .map(
        cell =>
          puzzleRef.current!.grid[
            cell.row
          ][cell.col],
      )
      .join('');
  };

  const addCell = (
    cell: SelectedCell,
  ) => {
    const existing =
      selectedRef.current.find(
        item =>
          item.row === cell.row &&
          item.col === cell.col,
      );

    // Same tile dobara select nahi karna
    if (existing) {
      return;
    }

    const previous =
      selectedRef.current[
        selectedRef.current.length - 1
      ];

    // First alphabet can be ANYWHERE
    if (previous) {
      const distance =
        getDistance(previous, cell);

      // Only adjacent tiles
      if (distance > 1) {
        return;
      }
    }

    const newSelection = [
      ...selectedRef.current,
      cell,
    ];

    selectedRef.current =
      newSelection;

    setSelectedCells(
      newSelection,
    );

    const word =
      buildWord(newSelection);

    setCurrentWord(word);

    checkWord(word);
  };

  const checkWord = (
    word: string,
  ) => {
    if (!puzzleRef.current) return;

    const target =
      puzzleRef.current.words.find(
        item =>
          item.word.toUpperCase() ===
          word.toUpperCase(),
      );

    if (!target) return;

    if (
      foundWordsRef.current.includes(
        target.word,
      )
    ) {
      return;
    }

    const updated = [
      ...foundWordsRef.current,
      target.word,
    ];

    foundWordsRef.current =
      updated;

    setFoundWords(updated);

    saveGame(updated);

    setMessage(
      `✨ ${target.word} found!`,
    );

    // clear current selection
    setTimeout(() => {
      selectedRef.current = [];
      setSelectedCells([]);
      setCurrentWord('');

      if (
        puzzleRef.current &&
        updated.length ===
          puzzleRef.current.words.length
      ) {
        setMessage(
          '🎉 Daily puzzle completed!',
        );

        Alert.alert(
          '🎉 Amazing!',
          'You completed today’s Word Zip challenge.',
        );
      } else {
        setMessage(
          'Swipe letters to make words',
        );
      }
    }, 350);
  };

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () => true,

          onMoveShouldSetPanResponder:
            () => true,

          onPanResponderGrant: event => {
            const {
              locationX,
              locationY,
            } = event.nativeEvent;

            const cell =
              getCellFromPosition(
                locationX,
                locationY,
              );

            if (!cell) return;

            selectedRef.current = [
              cell,
            ];

            setSelectedCells([
              cell,
            ]);

            const word =
              buildWord([cell]);

            setCurrentWord(word);

            setIsDragging(true);
          },

          onPanResponderMove: event => {
            if (!isDragging) {
              setIsDragging(true);
            }

            const {
              locationX,
              locationY,
            } = event.nativeEvent;

            const cell =
              getCellFromPosition(
                locationX,
                locationY,
              );

            if (!cell) return;

            addCell(cell);
          },

          onPanResponderRelease:
            () => {
              setIsDragging(false);

              const word =
                currentWord.toUpperCase();

              const isCorrect =
                puzzleRef.current?.words.some(
                  item =>
                    item.word.toUpperCase() ===
                    word,
                );

              if (!isCorrect) {
                setMessage(
                  'Try another word 👆',
                );
              }

              selectedRef.current = [];
              setSelectedCells([]);
              setCurrentWord('');
            },

          onPanResponderTerminate:
            () => {
              setIsDragging(false);

              selectedRef.current = [];
              setSelectedCells([]);
              setCurrentWord('');
            },
        }),
      [
        isDragging,
        currentWord,
      ],
    );

  const isSelected = (
    row: number,
    col: number,
  ) => {
    return selectedCells.some(
      cell =>
        cell.row === row &&
        cell.col === col,
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingIcon}>
          🧩
        </Text>

        <Text style={styles.loadingText}>
          Loading Word Zip...
        </Text>
      </View>
    );
  }

  if (!puzzle) {
    return (
      <View style={styles.loading}>
        <Text>
          Unable to load puzzle.
        </Text>
      </View>
    );
  }

  const progress =
    foundWords.length /
    puzzle.words.length;

  return (
    <View style={styles.container}>
      {/* HEADER */}

      <View style={styles.header}>
        <View>
          <Text style={styles.smallTitle}>
            DAILY CHALLENGE
          </Text>

          <Text style={styles.title}>
            Word Zip 🧩
          </Text>

          <Text style={styles.subtitle}>
            Swipe letters & make words
          </Text>
        </View>

        <View style={styles.counter}>
          <Text style={styles.counterNumber}>
            {foundWords.length}
          </Text>

          <Text style={styles.counterText}>
            / {puzzle.words.length}
          </Text>
        </View>
      </View>

      {/* PROGRESS */}

      <View style={styles.progressContainer}>
        <View
          style={[
            styles.progress,
            {
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      {/* CURRENT WORD */}

      <View style={styles.wordBox}>
        <Text style={styles.wordLabel}>
          CURRENT WORD
        </Text>

        <Text
          style={[
            styles.currentWord,
            !currentWord &&
              styles.placeholder,
          ]}
        >
          {currentWord ||
            'Swipe from any letter'}
        </Text>
      </View>

      {/* GAME GRID */}

      <View
        style={styles.grid}
        {...panResponder.panHandlers}
      >
        {puzzle.grid.map(
          (row, rowIndex) =>
            row.map(
              (letter, colIndex) => {
                const selected =
                  isSelected(
                    rowIndex,
                    colIndex,
                  );

                return (
                  <View
                    key={`${rowIndex}-${colIndex}`}
                    style={[
                      styles.cell,
                      selected &&
                        styles.selectedCell,
                    ]}
                  >
                    <Text
                      style={[
                        styles.letter,
                        selected &&
                          styles.selectedLetter,
                      ]}
                    >
                      {letter}
                    </Text>
                  </View>
                );
              },
            ),
        )}
      </View>

      {/* MESSAGE */}

      <View style={styles.messageBox}>
        <Text style={styles.message}>
          {message}
        </Text>
      </View>

      {/* FOUND WORDS */}

      <View style={styles.wordsSection}>
        <Text style={styles.sectionTitle}>
          Words Found
        </Text>

        <View style={styles.wordsWrap}>
          {puzzle.words.map(item => {
            const found =
              foundWords.includes(
                item.word,
              );

            return (
              <View
                key={item.word}
                style={[
                  styles.wordChip,
                  found &&
                    styles.wordChipFound,
                ]}
              >
                <Text
                  style={[
                    styles.wordChipText,
                    found &&
                      styles.wordChipTextFound,
                  ]}
                >
                  {found
                    ? `✓ ${item.word}`
                    : '• • •'}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* BOTTOM */}

      <View style={styles.bottomInfo}>
        <Text style={styles.bottomText}>
          🔥 New puzzle every 24 hours
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FF',
    paddingHorizontal: 20,
    paddingTop: 18,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FF',
  },

  loadingIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  loadingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#20245C',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  smallTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6754F5',
    letterSpacing: 1,
  },

  title: {
    marginTop: 3,
    fontSize: 28,
    fontWeight: '900',
    color: '#121747',
  },

  subtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#72789A',
  },

  counter: {
    minWidth: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#5B4BFF',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 4,
  },

  counterNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#5544F5',
  },

  counterText: {
    fontSize: 11,
    color: '#858BA7',
    fontWeight: '700',
  },

  progressContainer: {
    height: 7,
    marginTop: 18,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#E3E6F6',
  },

  progress: {
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#5B45F5',
  },

  wordBox: {
    marginTop: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',

    shadowColor: '#4C45C9',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: 5,
    },
    elevation: 3,
  },

  wordLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9AA0B8',
    letterSpacing: 1,
  },

  currentWord: {
    marginTop: 5,
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: 4,
    color: '#5544F5',
  },

  placeholder: {
    color: '#A6ABC2',
    fontSize: 15,
    letterSpacing: 0,
  },

  grid: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    alignSelf: 'center',
    marginTop: 20,

    flexDirection: 'row',
    flexWrap: 'wrap',

    borderRadius: 28,
    padding: 7,

    backgroundColor: '#E9EBFF',

    shadowColor: '#5544F5',
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: {
      width: 0,
      height: 9,
    },
    elevation: 7,
  },

  cell: {
    width: CELL_SIZE - 3.5,
    height: CELL_SIZE - 3.5,

    margin: 1.75,

    borderRadius: 18,
    backgroundColor: '#FFFFFF',

    alignItems: 'center',
    justifyContent: 'center',

    shadowColor: '#6C6F9B',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 2,
  },

  selectedCell: {
    backgroundColor: '#5A43F4',

    transform: [
      {
        scale: 1.06,
      },
    ],
  },

  letter: {
    fontSize: 25,
    fontWeight: '900',
    color: '#1D2354',
  },

  selectedLetter: {
    color: '#FFFFFF',
  },

  messageBox: {
    alignSelf: 'center',
    marginTop: 15,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 30,
    backgroundColor: '#EDEBFF',
  },

  message: {
    fontSize: 12,
    fontWeight: '700',
    color: '#5B4CF2',
  },

  wordsSection: {
    marginTop: 18,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#171C4C',
    marginBottom: 9,
  },

  wordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  wordChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: '#E8EAF5',
  },

  wordChipFound: {
    backgroundColor: '#DDF8EA',
  },

  wordChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#8B90A8',
  },

  wordChipTextFound: {
    color: '#14945B',
  },

  bottomInfo: {
    marginTop: 'auto',
    paddingVertical: 14,
    alignItems: 'center',
  },

  bottomText: {
    fontSize: 11,
    color: '#858BA6',
    fontWeight: '600',
  },
});