import {chartData} from './chart_data.js';
import {Chart} from './Chart.js';
import {ChartMap} from './ChartMap.js';

// entry point
window.onload = () => {
    const canvas = document.querySelector('.subscribers-chart');
    const chartContainer = document.querySelector('.chart-container');
    const minimapCanvas = document.querySelector('.mini-map');
    const chart = new Chart(canvas, chartContainer, chartData[0]);
    const minimap = new ChartMap(minimapCanvas, chart.updateViewport.bind(chart));

    chart.init();
    minimap.init();
};
