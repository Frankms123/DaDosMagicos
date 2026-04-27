import colors from './colors';

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const type = {
  tiny: 10,
  small: 12,
  body: 14,
  button: 16,
  title: 28,
  display: 40,
};

export const shadows = {
  purple: {
    shadowColor: colors.purple,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 10,
  },
  gold: {
    shadowColor: colors.gold,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.34,
    shadowRadius: 16,
    elevation: 10,
  },
  green: {
    shadowColor: colors.green,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 9,
  },
};

export {colors};
