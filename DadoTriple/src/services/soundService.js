import Sound from 'react-native-sound';
import {Platform} from 'react-native';

Sound.setCategory('Playback');

const SOUND_FILES = {
  click: Platform.OS === 'android' ? 'click_01' : 'click_01.mp3',
  diceRoll: Platform.OS === 'android' ? 'dice_roll' : 'dice_roll.mp3',
  win: Platform.OS === 'android' ? 'win_01' : 'win_01.mp3',
  lose: Platform.OS === 'android' ? 'lose_01' : 'lose_01.mp3',
};

const sounds = {};
const soundState = {};

function playLoadedSound(name, volume) {
  const sound = sounds[name];
  if (!sound) {
    return;
  }

  sound.setVolume(volume);
  sound.stop(() => {
    sound.play(success => {
      if (!success) {
        console.warn(`[sound] Playback failed: ${name}`);
      }
    });
  });
}

Object.entries(SOUND_FILES).forEach(([name, file]) => {
  soundState[name] = {
    loaded: false,
    pending: null,
  };

  sounds[name] = new Sound(file, Sound.MAIN_BUNDLE, error => {
    if (error) {
      console.warn(`[sound] Could not load ${file}:`, error);
      return;
    }

    soundState[name].loaded = true;
    if (soundState[name].pending) {
      const {volume} = soundState[name].pending;
      soundState[name].pending = null;
      playLoadedSound(name, volume);
    }
  });
});

export function playSound(name, volume = 1) {
  const sound = sounds[name];
  const state = soundState[name];
  if (!sound || !state) {
    return;
  }

  if (!state.loaded) {
    state.pending = {volume};
    return;
  }

  playLoadedSound(name, volume);
}

export function releaseSounds() {
  Object.values(sounds).forEach(sound => sound.release());
}
