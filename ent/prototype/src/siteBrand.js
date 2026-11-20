// En-tête des documents imprimés selon le site (reçus, relevés, certificats, contrats, courriers).
import { activeSite } from './site.js';
import logoTmv from './assets/logo-tamatave.png';
import ticketTmv from './assets/logo-tamatave-ticket.png';
import logoTana from './assets/logo-tana.png';
import ticketTana from './assets/logo-tana-ticket.png';

const BRANDS = {
  TMV: { logo: logoTmv, ticket: ticketTmv, city: 'Tamatave', town: 'Toamasina', address: '27 Rue Nationale, 501 Toamasina', phone: '+261 34 51 227 78', mail: 'chateaubetamatave@gmail.com' },
  TANA: { logo: logoTana, ticket: ticketTana, city: 'Tana', town: 'Tananarive', address: 'Lot II R 5 Betongolo, 101 Tananarive', phone: '+261 34 16 982 87', mail: 'chateaube@yahoo.fr' },
};
/** { logo, ticket, city, town, address, phone, mail } du site sur lequel on travaille. */
export const brand = () => BRANDS[activeSite()] ?? BRANDS.TMV;
