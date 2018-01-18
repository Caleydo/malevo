/**
 * Created by Martin on 15.01.2018.
 */
import * as d3 from 'd3';

export interface IDragSelection {
  dragEnd(sel: d3.Selection<any>);
  dragStart();
  dragging(start, end);
}

class SelectionRect {
  startPt: [number, number];
  endPt: [number, number];

  init(point: [number, number]) {
    this.startPt = point;
  }

  end(point: [number, number]) {
    this.endPt = point;
  }

  getOrderByX() {
    let startPt = this.startPt, endPt = this.endPt;
    if(this.startPt[0] > this.endPt[0]) {
      endPt = this.startPt;
      startPt = this.endPt;
    }
    return [startPt, endPt];
  }
}

export default class TimelineRangeSelector {
  selectionRect: SelectionRect;

  constructor($node: d3.Selection<any>, private candidates: d3.Selection<any>, private listeners: IDragSelection[]) {
    this.setup($node);
    this.selectionRect = new SelectionRect();
  }

  private getSelectionCandidates(dragStart: [number, number], dragEnd: [number, number], $candidates: d3.Selection<any>) {
    const isInRange = (element: HTMLElement, startPx: number, endPx: number): boolean => {
      const leftBounds = element.offsetLeft + 10;
      const rightBounds = element.offsetLeft + 10 + 25;
      return startPx <= rightBounds && endPx >= leftBounds;
    };
    const res = $candidates.filter(function(d, i) {
      return isInRange(this, dragStart[0], dragEnd[0]);
    });
    return res;
  }

  private setup($node: d3.Selection<any>) {
    const that = this;
      const dragBehavior = d3.behavior.drag()
        .on('drag', function() {that.dragMove(this);})
        .on('dragstart', function() {that.dragStart(this);})
        .on('dragend', function() {that.dragEnd(this);});

      $node.call(dragBehavior);
  }

  private dragStart(ele: HTMLElement) {
    this.listeners.forEach((l) => l.dragStart());
    const p = d3.mouse(ele);
    this.selectionRect.init(p);
  }

  private dragMove(ele: HTMLElement) {
    const p = d3.mouse(ele);
    this.selectionRect.end(p);
    const range = this.selectionRect.getOrderByX();
    this.listeners.forEach((l) => l.dragging(range[0], range[1]));
  }

  private dragEnd(ele: HTMLElement) {
    this.selectionRect.end(d3.mouse(ele));
    const range = this.selectionRect.getOrderByX();
    const selection = this.getSelectionCandidates(range[0], range[1], this.candidates);
    this.listeners.forEach((l) => l.dragEnd(selection));
  }


}

