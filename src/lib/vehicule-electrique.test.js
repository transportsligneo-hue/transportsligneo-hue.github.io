import { test, expect } from 'bun:test';
import { isElectricVehicle, isElectricEnergie } from './vehicule-electrique';
test('Master livré électrique selon la recherche de plaque', () => { expect(isElectricVehicle({ marque: 'RENAULT', modele: 'MASTER', energie: 'electrique', carburant: 'EL' })).toBe(true); });
test('Trafic livré électrique selon la recherche de plaque', () => { expect(isElectricVehicle({ marque: 'RENAULT', modele: 'TRAFIC', carburant: 'EE' })).toBe(true); });
test('Clio restituée thermique sans éclair', () => { expect(isElectricVehicle({ marque: 'RENAULT', modele: 'CLIO', energie: 'essence' })).toBe(false); });
test('Master diesel ne devient pas électrique par son modèle', () => { expect(isElectricVehicle({ marque: 'RENAULT', modele: 'MASTER', energie: 'diesel' })).toBe(false); });
test('Codes SIV électriques', () => { expect(isElectricEnergie('EL')).toBe(true); expect(isElectricEnergie('EE')).toBe(true); expect(isElectricEnergie('GO')).toBe(false); });
