import * as Crypto from 'expo-crypto';

export const makeId = () => Crypto.randomUUID();
