import { chartData } from './data_mock.js';
import { getDimension, getMultiplier } from './helpers.js';


window.onload = main;

async function main() {
    const data = await getData();

    draw(data);
}

async function getData() {
    // replace with a call to actual API
    return Promise.resolve(chartData);
}

function draw(chartData) {
    console.log('init draw');

    const horizontalLines = 5;

	const canvas = document.getElementById('subscribers-chart');
    const ctx = canvas.getContext('2d');
    const {width, height} = canvas;

    const labelsOffset = 40;
    const chartHeight = height - labelsOffset;

    // calculations
    const maxPoint = Math.max(...chartData.map(chart => Math.max(...chart.points)));
    console.log(`maxPoint: ${maxPoint}`);

    const dimension = getDimension(maxPoint, horizontalLines);
    console.log(`dimension: ${dimension}`);

    const multiplier = getMultiplier(chartHeight, maxPoint);
    console.log(`multiplier: ${multiplier}`);

    // drawing
    drawGrid(ctx, width, height, labelsOffset, dimension);

    chartData.forEach(chart => {
        drawChart(ctx, width, chartHeight, chart, multiplier);
    });
}

function drawGrid(ctx, canvasWidth, canvasHeight, labelsOffset, dimension) {
    console.log('drawing grid');

    // styling
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 0.5;
    ctx.font = '18px Times New Roman';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';

    const verticalLineStep = Math.floor(canvasHeight / 6);
    const chartHeight = canvasHeight - labelsOffset;

    // drawing
    for (let i = 0; i < 6; i++) {
        const height = chartHeight - i * verticalLineStep;

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(canvasWidth, height);
        ctx.fillText(dimension * i, 12, height - 6);
        ctx.stroke();
    }
}

function drawChart(ctx, canvasWidth, chartHeight, chart, multiplier) {
    console.log('drawing chart');

    const {points, color} = chart;

    // styling
    ctx.lineWidth = 1;

    const step = canvasWidth / points.length;
    let curX = 0;
    let curY = chartHeight;

    // drawing
    ctx.beginPath();
    ctx.moveTo(curX, curY);
    ctx.strokeStyle = color;

    for (let i = 0; i < points.length; i++) {
        curX += step;
        curY = chartHeight - points[i] * multiplier;
        ctx.lineTo(curX, curY);
    }

    ctx.stroke();
}
