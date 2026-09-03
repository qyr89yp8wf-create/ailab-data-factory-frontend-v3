import { mockResult, readStore, updateStore } from './mockStore';

const EMPTY_STATE = {};

export const localStoreApi = {
  getState: async () => {
    const state = readStore('application-state', EMPTY_STATE);
    return mockResult({ exists: Object.keys(state).length > 0, ...state }, 40);
  },
  saveState: patch => mockResult(updateStore('application-state', EMPTY_STATE, state => ({ ...state, ...patch })), 40),
  getValidations: () => mockResult({ items: readStore('validations', []) }, 40),
  getActivity: () => mockResult({ items: readStore('activity', []) }, 40),
};

