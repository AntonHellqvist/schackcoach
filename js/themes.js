// Brädfärger. Valet sparas i inställningarna.

import { getState, onStateChange } from './store.js';

export const BOARD_THEMES = [
  { id: 'green', name: 'Grön', light: '#eeeed2', dark: '#769656' },
  { id: 'wood', name: 'Trä', light: '#f0d9b5', dark: '#b58863' },
  { id: 'walnut', name: 'Valnöt', light: '#e6c8a0', dark: '#8b5a3c' },
  { id: 'blue', name: 'Blå', light: '#dee3e6', dark: '#8ca2ad' },
  { id: 'ice', name: 'Is', light: '#e3eef4', dark: '#6f9bb8' },
  { id: 'purple', name: 'Lila', light: '#efefef', dark: '#8877b7' },
  { id: 'coral', name: 'Korall', light: '#f7e4d7', dark: '#d9826a' },
  { id: 'stone', name: 'Sten', light: '#dcdcd6', dark: '#8e9089' },
  { id: 'night', name: 'Natt', light: '#9aa7b4', dark: '#4b5868' },
];

export const boardTheme = () => getState().settings.boardTheme || 'green';

export function applyBoardTheme() {
  const id = boardTheme();
  if (id === 'green') delete document.documentElement.dataset.board;
  else document.documentElement.dataset.board = id;
}

applyBoardTheme();
onStateChange(applyBoardTheme);
