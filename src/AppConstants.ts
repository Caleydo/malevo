/**
 * Created by Martin on 25.12.2017.
 */
export class AppConstants {

  /**
   * Static constant as identification for malevo views
   * Note: the string value is referenced for multiple view definitions in the package.json,
   *       i.e. be careful when refactor the value
   */
  static VIEW = 'malevoView';

  static EVENT_RESIZE = 'eventResize';

  static BW_COLOR_SCALE = ['white', 'gray'];

  /**
   * Ids for different detail view tabs
   * @type {string}
   */
  static CHART_VIEW = 'chartView';
  static IMAGE_VIEW = 'imageView';
  static SOFTMAX_STAMP_VIEW = 'softmaxStampView';

  /**
   * Fires when the use selects a dataset from the selector
   * @type {string}
   */
  static EVENT_DATA_COLLECTION_SELECTED = 'eventDataCollectionSelected';

  /**
   * Fires when the detail view should be cleared
   */
  static CLEAR_DETAIL_VIEW = 'clearDetailView';

  /**
   * Fires when the user selects a timepoint (epoch)
   * @type {string}
   */
  static EVENT_EPOCH_SELECTED = 'eventEpochSelected';

  /**
   * Represent the different cell types
   * @type {string}
   */
  static HEATMAP_CELL_PRECISION = 'heatmapCellPrecision';
  static SINGLE_LINE_PRECISION = 'singleLinePrecision';

  static BAR_CHART_CELL_FP = 'barChartCellFP';
  static BAR_CHART_CELL_FN = 'barChartCellFN';

  static MULTI_LINE_CHART_CELL_FP = 'multiLineChartCellFP';
  static MULTI_LINE_CHART_CELL_FN = 'multiLineChartCellFN';

  static COMBINED_MATRIX_CELL = 'combinedMatrixCell';
  static SINGLE_LINE_MATRIX_CELL = 'singleLineMatrixCell';

  static LABEL_CLASS_SIZE = 'labelClassSize';

    /**
     * Initial size of a heatmap cell
     * @type {number}
     */
  static HEATMAP_CELL_SIZE = 5;

  static MAXIMAL_HEATMAP_LABEL_SIZE = 70;
}
