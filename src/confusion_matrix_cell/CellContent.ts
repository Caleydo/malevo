import {ILoadedMalevoDataset} from '../MalevoDataset';
import {AppConstants} from '../AppConstants';
import * as d3 from 'd3';
import {zip} from '../utils';

/**
 * Created by Martin on 19.03.2018.
 */

export class MatrixHeatCellContent {
  maxVal: number;
  counts: number[];
  classLabels: string[];
  indexInMultiSelection: number[];
  colorValues: string[];
}

export class Line {
  values: number[];
  valuesInPercent: number[];
  max: number;
  classLabel: string;
  color: string;
}

abstract class ACellContentCalculator {
  abstract calculate(datasets: ILoadedMalevoDataset[]): Line[] | MatrixHeatCellContent[];
}

export class SingleEpochCalculator extends ACellContentCalculator {
  constructor(private removeMainDiagonal = true) {
    super();
  }

  calculate(datasets: ILoadedMalevoDataset[]): MatrixHeatCellContent[] {
    const transformedData = datasets.map((x) => x.singleEpochData.confusionData.to1DArray());
    const res = zip(transformedData);

    if (this.removeMainDiagonal) {
      res.forEach((x, i) => {
        if (i % (AppConstants.CONF_MATRIX_SIZE + 1) === 0) {
          res[i] = res[i].map((x) => 0);
        }
      });
    }

    // find max value over all data points
    const maxVal = res.reduce((acc, val) => {
      const max = Math.max(...val);
      return acc > max ? acc : max;
    }, 0);

    return res.map((x, i) => {
      if (this.removeMainDiagonal && i % (AppConstants.CONF_MATRIX_SIZE + 1) === 0) {
        return {
          maxVal: 0, counts: [], classLabels: [],
          indexInMultiSelection: [], colorValues: []
        };
      } else {
        return {
          maxVal, counts: x, classLabels: x.map((y) => String(y)),
          colorValues: x.map((_, i) => datasets[i].datasetColor), indexInMultiSelection: datasets.map((x) => x.multiEpochData.findIndex((y) => y.id === x.singleEpochData.id))
        };
      }
    });
  }
}

export class MultiEpochCalculator extends ACellContentCalculator {
  constructor(private removeMainDiagonal = true) {
    super();
  }
  calculate(datasets: ILoadedMalevoDataset[]): Line[] {
    const datasetData = [];
    datasets.forEach((ds: ILoadedMalevoDataset) => {
      const confData = ds.multiEpochData.map((x) => x.confusionData.to1DArray());

      datasetData.push(zip(confData));
    });
    const zipped = zip(datasetData);

    if (this.removeMainDiagonal) {
      zipped.forEach((x, i) => {
        if (i % (AppConstants.CONF_MATRIX_SIZE + 1) === 0) {
          zipped[i] = zipped[i].map((x) => x.map((y) => 0));
        }
      });
    }

    const maxVal = zipped.reduce((acc: number, val) => {
      const res = val.map((x) => Math.max(...x.map((y) => y)));
      return Math.max(...res) > acc ? Math.max(...res) : acc;
    }, 0);

    const multiEpochData = [];
    zipped.map((x, i) => {
      const label = datasets[0].labels[i % datasets[0].labels.length];
      return multiEpochData.push(x.map((y, dsIndex) => {
        const classSize = datasets[dsIndex].classSizes[i % AppConstants.CONF_MATRIX_SIZE];
        if (this.removeMainDiagonal && (i % (AppConstants.CONF_MATRIX_SIZE + 1)) === 0) {
          return {values: [], valuesInPercent: [], max: 0, classLabel: label, color: datasets[dsIndex].datasetColor};
        } else {
          return {values: y, valuesInPercent: y.map((z) => z / classSize),  max: maxVal, classLabel: label, color: datasets[dsIndex].datasetColor};
        }
      }));
    });
    return multiEpochData;
  }
}
