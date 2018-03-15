/**
 * Created by Martin on 04.01.2018.
 */

import {MalevoDataset, IMalevoEpochInfo} from '../MalevoDataset';
import * as d3 from 'd3';
import {AppConstants} from '../AppConstants';
import {extractEpochId} from '../utils';
import {DataStoreEpochSelection} from '../DataStore';
import * as events from 'phovea_core/src/event';

class SingleEpochSelector {
  public $node: d3.Selection<any>;
  hidden = true;
  public curPos = -1;
  constructor($parent: d3.Selection<any>, offsetH: number) {
    this.$node = $parent.append('rect').classed('single-epoch-selector', true).attr('width', 2).attr('height', 30).attr('y', 0)
      .attr('transform', `translate(${offsetH}, 0)`)
      .classed('hidden', this.hidden);
  }

  setPosition(pos: number) {
    if(this.curPos !== pos || this.hidden === true) {
      this.hidden = false;
    } else {
      this.hidden = true;
    }
    this.curPos = pos;
  }

  hideNode(val: boolean) {
    this.hidden = val;
    this.$node.classed('hidden', val);
  }
}

export class NodeWrapper {
  public canBeRemoved = false;
  public condense = false;
  constructor(public name, public dps: DataPoint[]) {
  }
}

export class OverallTimeline {
  public dataPoints: NodeWrapper[] = [];
}

export class TimelineData {
  constructor(epochs: IMalevoEpochInfo[]) {
    this.build(epochs);
  }
  datapoints: DataPoint[] = [];

  build(epochs: IMalevoEpochInfo[]) {
    function sortNumber(a: IMalevoEpochInfo, b: IMalevoEpochInfo) {
      return extractEpochId(a) - extractEpochId(b);
    }

    epochs.sort(sortNumber);
    const length = extractEpochId(epochs[epochs.length - 1]);
    for(let i = 0; i <= length; i++) {
      const epoch = epochs.find((x) => extractEpochId(x) === i);
      const dp = epoch ? new DataPoint(true, i, epoch) : new DataPoint(false, i, epoch);
      this.datapoints.push(dp);
    }
  }
}

class DataPoint {
  public canBeRemoved = false;
  public condense = false;
  constructor(public exists: boolean, public position: number, public epoch: IMalevoEpochInfo) {

  }
}

export class Timeline {
  private $node: d3.Selection<any> = null;
  private $label: d3.Selection<any> = null;
  data:TimelineData = null;
  singleEpochSelector = null;

  constructor(public datasetName: string, $parent: d3.Selection<any>) {
   this.build($parent);
  }

  build($parent) {
    if(this.$node) {
      this.$node.remove();
    }
    this.$node = $parent.append('g')
      .classed('timeline', true);
    this.createLabel(this.datasetName);
  }

  createLabel(datasetName: string) {
    this.$label = this.$node.append('g')
      .attr('transform', 'translate(0,' + 15 +')')
      .append('text')
      .classed('tml-label', true)
      .text(datasetName);
  }

  getDSLabelWidth(): number {
    return (<any>this.$label[0][0]).getBBox().width;
  }

  node(): d3.Selection<any> {
    return this.$node;
  }

  render($parent, offsetH: number, offsetV: number, otl: OverallTimeline) {
    this.build($parent);
    this.$node.attr('transform', 'translate(0,' + offsetV + ')');

    offsetH += 10;
    const width = otl.dataPoints.length * 5;
    const x = d3.scale.ordinal()
      .rangePoints([0, width])
      .domain(otl.dataPoints.map(function (d) {
        return String(d.name);
      }));

    const xAxis = d3.svg.axis()
      .scale(x)
      .tickValues(x.domain().filter((d, i) => {
        const cond = i < this.data.datapoints.length && this.data.datapoints[i].exists && i % 5 === 0;
        return cond;
      }))
      .orient('bottom')
      .tickSize(-7);

    this.$node.append('g')
      .attr('class', 'axis')
      .attr('transform', `translate(${offsetH}, 15)`)
      .call(xAxis);

    const that = this;
    // Draw the brush
    const brush = d3.svg.brush()
      .x(<any>x);


    const $brushg = this.$node.append('g')
      .attr('transform', `translate(${offsetH}, 0)`)
      .attr('class', 'brush')
      .call(brush);

    brush.on('brush', () => this.brushmove(x, brush))
         .on('brushend', () => that.brushend(x, brush));

    $brushg.selectAll('rect')
      .attr('height', 15);

    this.createSingleSelector(width, offsetH, x);
    this.setBrush(brush, x, width);

    this.$label.on('dblclick', () => {
      // if at least 1 epoch was selected
      if(!brush.empty()) {
        //to clear the brush, call this.setBrush(brush, x, 0);
        this.setBrush(brush, x, width);
      }

    });
  }

  setBrush(brush: any, x: any, width: number) {
    brush.extent([0, width]);
    this.brushmove(x, brush);
    this.brushend(x, brush);
  }

  createSingleSelector(width: number, offsetH: number, x: any) {
    const invert = d3.scale.linear().range(<any>x.domain()).domain(x.range());
    const posFromCoordinates = (elem: HTMLElement) => {
      const coordinates = d3.mouse(elem);
      let pos = invert(coordinates[0]);
      pos = Math.round(pos);
      return pos;
    };

    const isValidPos = (pos: number) => {
      return pos < this.data.datapoints.length && this.data.datapoints[pos].exists;
    };

    const $singleSelectionArea = this.$node.append('rect').style('fill', 'rgb(0,0.255').attr('width', 2).attr('height', 15).attr('y', 0)
      .attr('transform', `translate(${offsetH}, 0)`);

    const tml = this;
    this.singleEpochSelector = new SingleEpochSelector(this.$node, offsetH);
    this.$node.append('rect').attr('transform', `translate(${offsetH}, ${16})`)
      .attr('width', width)
      .attr('height', 15)
      .style('opacity', 0)
      .on('mousemove', function () {
        const num = posFromCoordinates(this);
        if(isValidPos(num)) {
          $singleSelectionArea.classed('hidden', false);
          $singleSelectionArea.attr('x', x(String(num)));
        } else {
          $singleSelectionArea.classed('hidden', true);
        }
      })
      .on('mouseup', function () {
        const num = posFromCoordinates(this);
        if(isValidPos(num)) {
          tml.setSingleEpochSelector(x, num);
          tml.singleEpochSelector.hideNode(tml.singleEpochSelector.hidden);
          tml.updateSingleSelection(tml.singleEpochSelector);
          events.fire(AppConstants.EVENT_EPOCH_SELECTED);
        }
      })
      .on('mouseleave', function () {
        $singleSelectionArea.classed('hidden', true);
      });
  }

  setSingleEpochSelector(x: any, pos: number) {
    const posX = x(String(Math.round(pos)));
    this.singleEpochSelector.$node.attr('x', posX);
    this.singleEpochSelector.setPosition(pos);
  }

  ceil(val: number, timeline: Timeline) {
    for(let i = val; i < timeline.data.datapoints.length; i++) {
      if(timeline.data.datapoints[i].exists) {
        return i;
      }
    }
    return null;
  }

  brushmove(x: any, brush:any) {
    const extent = brush.extent();
    const y = d3.scale.linear().range(x.domain()).domain(x.range());

    if(!brush.empty()) {
      const range = this.getDataIndices(+y(<number>extent[0]), +y(<number>extent[1]));
      if(range[0] < range[1]) {
        this.$node.select('g.brush').call(<any>brush.extent([y.invert(range[0]), y.invert(range[1])]));
        this.setSingleEpochSelector(x, range[1]);
        this.singleEpochSelector.hideNode(false);
      } else {
        this.$node.select('g.brush').call(<any>brush.clear());
      }
    }
  }

  brushend(x: any, brush: any) {
    // if at least 1 epoch was selected
    if(!brush.empty()) {
      const extent = brush.extent();
      const y = d3.scale.linear().range(x.domain()).domain(x.range());
      const range = this.getDataIndices(+y(<number>extent[0]), +y(<number>extent[1]));
      const selEpochs = this.getSelectedEpochs(range)

      DataStoreEpochSelection.multiSelected = selEpochs;

      // set single epoch selector to the end
      this.setSingleEpochSelector(x, range[1]);
      this.singleEpochSelector.hideNode(false);
      this.updateSingleSelection(this.singleEpochSelector);
    } else {
      DataStoreEpochSelection.clearMultiSelection();
      this.$node.select('g.brush').call(<any>brush.clear());
    }
    events.fire(AppConstants.EVENT_EPOCH_SELECTED);
  }

  getSelectedEpochs(range: [number, number]) {
    const selEpochs = [];
    for(let i = range[0]; i <= range[1]; i++) {
      if(this.data.datapoints[i].exists) {
        selEpochs.push(this.data.datapoints[i].epoch);
      }
    }
    return selEpochs;
  }

  getDataIndices(n0: number, n1: number): [number, number] {
    if(n0 > n1) {
      const tmp = n1;
      n1 = n0;
      n0 = tmp;
    }

    n0 = Math.round(n0);
    n1 = Math.round(n1);
    const brushStart = this.ceil(Math.ceil(n0), this);
    const brushEnd =  this.ceil(Math.ceil(n1), this);

    return [brushStart, brushEnd];
  }

  updateSingleSelection(seSelector: SingleEpochSelector) {
    DataStoreEpochSelection.clearSingleSelection();
    if(!seSelector.hidden) {
      console.assert(this.data.datapoints[seSelector.curPos].exists);
      const epoch = this.data.datapoints[seSelector.curPos].epoch;
      console.assert(!!epoch);
      DataStoreEpochSelection.singleSelected = epoch;
    }
  }
}
