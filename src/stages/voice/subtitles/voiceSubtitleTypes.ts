export type SubtitleCue = {
  index: number;
  startSeconds: number;
  endSeconds: number;
  lines: string[];
};

export type DisplayToken = { start: number; end: number; text: string; replacementSource: boolean };

export type AlignmentOffset = { start: number; end: number };
