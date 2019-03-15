import {chartData} from './chart_data.js';
import {Chart} from './Chart.js';
import {ChartMap} from './ChartMap.js';
import {Stream} from './Stream.js';

// entry point
window.onload = () => {
    const canvas = document.querySelector('.subscribers-chart');
    const chartContainer = document.querySelector('.chart-container');
    const minimapCanvas = document.querySelector('.mini-map');
    const legend = document.querySelector('.chart-legend');
    const chartIndex = 0;

    const viewport$ = new Stream({start: 0.7, end: 1.0});
    const displayedCharts$ = new Stream(new Set(Object.keys(chartData[chartIndex].names)));
    const chart = new Chart(canvas, chartContainer, legend, chartData[chartIndex], viewport$, displayedCharts$);
    const minimap = new ChartMap(minimapCanvas, chartData[chartIndex], viewport$, displayedCharts$);

    viewport$.subscribe(value => {
        console.log(value);
    });

    chart.init();
    minimap.init();
};
