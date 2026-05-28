import { requestFourtochkiTyres } from './request';
import { transformTyres, transformDiscs } from '../4tochki/transformers';

const fourtochki = {
    key: 'fourtochki',
    label: 'Форточки',
    fetchTyres: requestFourtochkiTyres,
    transformTyres,
    transformDiscs
}

export default fourtochki;