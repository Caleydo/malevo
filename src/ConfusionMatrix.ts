import {IAppView} from './app';
import * as d3 from 'd3';
import * as events from 'phovea_core/src/event';
import {AppConstants} from './AppConstants';
import {MalevoDataset, IMalevoEpochInfo, ILoadedMalevoEpoch, ILoadedMalevoDataset} from './MalevoDataset';
import {INumericalMatrix} from 'phovea_core/src/matrix';
import {ITable} from 'phovea_core/src/table';
import {ChartColumn} from './ChartColumn';
import {HeatCellRenderer, MatrixLineCellRenderer} from './confusion_matrix_cell/ACellRenderer';
import {ACell} from './confusion_matrix_cell/Cell';
import {adaptTextColorToBgColor, zip} from './utils';
import {BarChartCalculator, LineChartCalculator} from './MatrixCellCalculation';
import * as confMeasures from './ConfusionMeasures';
import {Language} from './language';
import {NumberMatrix, SquareMatrix, transformSq, setDiagonal} from './DataStructures';
import {DataStoreCellSelection, dataStoreTimelines, DataStoreTimelineSelection} from './DataStore';
import {
  HeatCellCalculator, Line, LineCellCalculator, MatrixHeatCellContent} from './confusion_matrix_cell/CellContent';


enum RenderMode {
  CLEAR = 0,
  SINGLE = 1,
  MULTI = 2,
  COMBINED = 3
}

export class ConfusionMatrix implements IAppView {
  private readonly $node: d3.Selection<any>;
  private $confusionMatrix: d3.Selection<any>;
  private $labelsTop: d3.Selection<any>;
  private $labelsLeft: d3.Selection<any>;
  private fpColumn: ChartColumn;
  private fnColumn: ChartColumn;
  private precisionColumn: ChartColumn;
  private classSizeColumn: ChartColumn;
  private renderMode: RenderMode = RenderMode.COMBINED;

  constructor(parent:Element) {
    this.$node = d3.select(parent)
      .append('div')
      .classed('grid', true);
    DataStoreCellSelection.$grid = this.$node;
  }

  /**
   * Initialize the view and return a promise
   * that is resolved as soon the view is completely initialized.
   * @returns {Promise<ConfusionMatrix>}
   */
  init() {
    this.attachListeners();
    this.setupLayout();
    // return the promise directly as long there is no dynamical data to update
    return Promise.resolve(this);
  }

  private setupLayout() {
    this.$node.append('div')
      .classed('cfm-axis', true)
      .classed('axis-top', true)
      .text(Language.PREDICTED);

    this.$node.append('div')
      .classed('cfm-axis', true)
      .classed('axis-left', true)
      .append('span')
      .text(Language.GROUND_TRUTH);

    const $labelRight = this.$node.append('div')
      .classed('malevo-label', true)
      .classed('label-right', true);

    $labelRight.append('div')
      .text(Language.FP);

    $labelRight.append('div')
      .text(Language.PRECISION);

    $labelRight.append('div')
      .text(Language.CLASS_SIZE);

    this.$node.append('div')
      .classed('malevo-label', true)
      .classed('label-bottom', true)
      .text(Language.FN);

    this.$labelsTop = this.$node.append('div')
      .classed('malevo-label', true)
      .classed('label-top', true)
      .append('div')
      .classed('labels', true);

    this.$labelsLeft = this.$node.append('div')
      .classed('malevo-label', true)
      .classed('label-left', true)
      .append('div')
      .classed('labels', true);

    const $mwrapper = this.$node.append('div')
      .classed('matrix-wrapper', true)
      .attr('data-aspect-ratio','one-by-one');

    this.$confusionMatrix = $mwrapper.append('div').classed('matrix', true);

    const $chartRight = this.$node.append('div').classed('chart-right', true);
    this.fpColumn = new ChartColumn($chartRight.append('div'));
    this.precisionColumn = new ChartColumn($chartRight.append('div'));
    this.classSizeColumn = new ChartColumn($chartRight.append('div'));

    const $chartBottom = this.$node.append('div').classed('chart-bottom', true);
    this.fnColumn = new ChartColumn($chartBottom.append('div'));
  }

  private attachListeners() {
    events.on(AppConstants.EVENT_REDRAW, (evt) => {
	    this.clearDetailView();
      this.updateViews();
    });
  }

  clearDetailView() {
	  events.fire(AppConstants.CLEAR_DETAIL_VIEW);
  }

  chooseRenderMode(datasets: ILoadedMalevoDataset[]) {
    this.renderMode = RenderMode.CLEAR;

    const singleEpochDataExists = function(data: ILoadedMalevoDataset) {
      return !!data.singleEpochData;
    };

    const multiEpochDataExists = function(data: ILoadedMalevoDataset) {
      return !!data.multiEpochData && data.multiEpochData.length > 0;
    };
    // if at least one single epoch selection exists
    // => update render mode
    datasets.forEach((x) => {
      if(singleEpochDataExists(x)) {
        this.renderMode |= RenderMode.SINGLE;
        return;
      }
    });

    // if at least one multi epoch selection exist
    // => update render mode
    datasets.forEach((x) => {
      if(multiEpochDataExists(x)) {
        this.renderMode |= RenderMode.MULTI;
        return;
      }
    });

  }

  updateViews() {

    const allPromises0 = [];

    dataStoreTimelines.forEach((value: DataStoreTimelineSelection) => {
      const loadDataPromises0 = [];
      loadDataPromises0.push(this.loadEpochs(value.multiSelected, value.selectedDataset));
      loadDataPromises0.push(this.loadEpochs([value.singleSelected], value.selectedDataset));
      loadDataPromises0.push(this.loadLabels(value.selectedDataset.classLabels, value.selectedDataset));
      allPromises0.push(loadDataPromises0);
    });

    const allPromises1 = [];
    const allDatasets: ILoadedMalevoDataset[] = [];
    allPromises0.forEach((x) => {
      const pr = Promise.all(x).then((x: [ILoadedMalevoEpoch[], ILoadedMalevoEpoch, string[]]) => {
        const ds = {multiEpochData: x[0], singleEpochData: x[1][0], labels: x[2]};
        allDatasets.push(ds);
      });
      allPromises1.push(pr);
    });

    Promise.all(allPromises1).then((x) => {
      this.synchronizeData(allDatasets);
      this.chooseRenderMode(allDatasets);
      this.renderCMCells(allDatasets);
      this.addRowAndColumnLabels(allDatasets[0].labels);
      //this.renderCMPanels();
    });
  }

  private synchronizeData(ds: ILoadedMalevoDataset[]) {
    // find shortest timeline-selection
    const smallestValue = ds.reduce((acc, val) => {
      return val.multiEpochData.length < acc ? val.multiEpochData.length : acc;
    }, Number.MAX_VALUE);

    ds.forEach((x) => x.multiEpochData = x.multiEpochData.slice(0, smallestValue));
  }

  private loadEpochs(matrix: IMalevoEpochInfo[], dataset: MalevoDataset) {
    if(matrix === null || matrix[0] === null) { // if a single epoch or multiepoch-range was deselected
      return Promise.resolve([]);
    }
    const res = matrix.map((x) => {
      return x.confusionInfo.data();
    });
    return Promise.all(res).then((loadedEpochData: number[][][]) => {
      console.assert(loadedEpochData.length === matrix.length);
      if(loadedEpochData.length !== matrix.length) {
        throw new Error('The loaded epoch data does not conform with its description');
      }
      return loadedEpochData.map((val: number[][], index: number) => {
        const m = new SquareMatrix<number>(val.length);
        m.init(val);
        return {name: matrix[index].name, confusionData: m};
        });
    });
  }

  private loadLabels(table: ITable, dataset: MalevoDataset) : Promise<any> {
    return table.data()
      .then((x: [[number, string]]) => {
        return x.map((x) => x[1]);
      });
  }

  private addRowAndColumnLabels(labels: string[]) {
    this.renderLabels(this.$labelsLeft, labels);
    this.renderLabels(this.$labelsTop, labels);
  }

  private renderLabels($node: d3.Selection<any>, labels: string[]) {
    const classColors = d3.scale.category10();

    const $cells = $node.selectAll('div')
      .data(labels);

    $cells.enter()
      .append('div')
      .classed('cell', true)
      .classed('label-cell', true);

    $cells
      .text((datum: string) => datum)
      .style('background-color', (datum: string) => classColors(datum))
      .style('color', (datum: string) => adaptTextColorToBgColor(classColors(datum)));

    $cells.exit().remove();
  }

  private checkDataSanity(loadedMalevoEpochs: ILoadedMalevoEpoch[][], loadedClasslabels: string[][]) {

    if(loadedClasslabels.length === 0 || loadedClasslabels[0].length === 0) {
      throw new TypeError('No class labels were found');
    }

    loadedMalevoEpochs.forEach((v) => {
      const data = v;
      if(data.length === 0) {
        throw new TypeError('No confusion matrix was found');
      }

      const order = v[0].confusionData.order();

      for(let i = 1; i < data.length; i++) {
        if(order !== data[i].confusionData.order()) {
          throw new TypeError('The loaded confusion matrix is not valid');
        }
      }

      if(order !== loadedClasslabels[0].length) {
        throw new TypeError('The length of the labels does not fit with the matrix length');
      }
    });
  }

  renderCMCells(datasets: ILoadedMalevoDataset[]) {
    this.$confusionMatrix
      .selectAll('div')
      .remove();

    if(this.renderMode === RenderMode.CLEAR) {
      return;
    }

    const heatmapContent = new HeatCellCalculator().calculate(datasets);

    const lineContent = new LineCellCalculator().calculate(datasets);

    let $cells = null;
    let data = null;
    let renderer = null;
    if(this.renderMode === RenderMode.COMBINED) {
      const zippedData = zip([heatmapContent, lineContent]);
      $cells = this.$confusionMatrix
      .selectAll('div')
      .data(zippedData.map((x) => {
        return 0;
      }));

      data = zippedData.map((x) => {
        return {heatcell: x[0], linecell: x[1]};
      });

      renderer = new HeatCellRenderer();
      renderer.setNextRenderer(new MatrixLineCellRenderer());
    } else if(this.renderMode === RenderMode.SINGLE) {
      $cells = this.$confusionMatrix
        .selectAll('div')
        .data(heatmapContent.map((x) => {
          return 0;
        }));
      data = heatmapContent;
      renderer = new HeatCellRenderer();
    } else if(this.renderMode === RenderMode.MULTI) {
      $cells = this.$confusionMatrix
        .selectAll('div')
        .data(heatmapContent.map((x) => {
          return 0;
        }));
      renderer = new MatrixLineCellRenderer();
    }

    $cells.enter()
      .append('div')
      .classed('cell', true)
      .each(function (datum, index) {
        renderer.renderNext(new ACell(data[index], d3.select(this)));
      });
  }

  filterDiagonals(heatmapContent: {}[], lineContent: {}[]) {
    heatmapContent.map((x: MatrixHeatCellContent, i: number) => {
      if(i % 11 === 0) {
        x.colorValues = x.colorValues.map(() => '#00000');
        x.counts = x.counts.map(() => 0);
        x.classLabels = x.classLabels.map(() => '');
      }
    });

    lineContent.map((x: Line[], i: number) => {
      if(i % 11 === 0) {
        x.map((y) => {
          y.classLabel = '';
          y.max = 0;
          y.values = [];
        });
      }
    });
  }
}

/**
 * Factory method to create a new HeatMap instance
 * @param parent
 * @param options
 * @returns {ConfusionMatrix}
 */
export function create(parent:Element, options:any) {
  return new ConfusionMatrix(parent);
}
