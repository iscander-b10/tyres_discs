/**
 * Реэкспорт тех же transform*, что использует фронт (esbuild бандлит из src/).
 */
export {
  transformTyres as transformShinserviceTyres,
  transformDiscs as transformShinserviceDiscs,
} from '../../../../src/services/suppliers/shinservice/transformers.js';

export {
  transformTyres as transformSemisotnovTyres,
  transformDiscs as transformSemisotnovDiscs,
} from '../../../../src/services/suppliers/semisotnov/transformers.js';

export {
  transformTyres as transformFourtochkiTyres,
  transformDiscs as transformFourtochkiDiscs,
} from '../../../../src/services/suppliers/4tochki/transformers.js';

export {
  transformTyres as transformShinasuTyres,
  transformDiscs as transformShinasuDiscs,
} from '../../../../src/services/suppliers/ShinaSu/transformers.js';

export {
  transformTyres as transformVershinaTyres,
  transformDiscs as transformVershinaDiscs,
} from '../../../../src/services/suppliers/Vershina/transformers.js';
