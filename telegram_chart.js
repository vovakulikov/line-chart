import {chartData} from './data_mock.js';
import {formatDate, getDimension, getMultiplier, getLabelWidth} from './helpers.js';

const main = async () => {
    const data = await getData();

    const canvas = document.getElementById('subscribers-chart');
    const container = document.querySelector('.chart-container');

    let isDragging = false;
    let lastX = 0;
    let marginLeft = 0;

    canvas.addEventListener('touchstart', event => {
        isDragging = true;
        lastX = event.touches[0].clientX;

        event.preventDefault();
    });

    canvas.addEventListener('touchmove', event => {
        if (isDragging) {
            const x = event.touches[0].clientX;
            const delta = x - lastX;

            lastX = x;
            marginLeft = Math.max(-(container.clientWidth), Math.min(marginLeft + delta, 0));

            console.log(`translateX(${marginLeft} + px)`);
            canvas.style.transform = `translateX(${marginLeft}px)`;
        }

        event.preventDefault();
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    draw(canvas, data);
};

const getData = async () => {
    // replace with a call to actual API
    return Promise.resolve(chartData);
};

const draw = (canvas, chartData) => {
    console.log('init draw');

    const horizontalLines = 5;

    const ctx = canvas.getContext('2d');
    const {width, height} = canvas;

    const labelsOffset = 40;
    const chartHeight = height - labelsOffset;
    const chartWidth = width;

    // calculations
    const maxPoint = Math.max(...chartData.map(chart => Math.max(...chart.dataPoints)));
    console.log(`maxPoint: ${maxPoint}`);

    const dimension = getDimension(maxPoint, horizontalLines);
    console.log(`dimension: ${dimension}`);

    const multiplier = getMultiplier(chartHeight, maxPoint);
    console.log(`multiplier: ${multiplier}`);

    const dates = chartData[0].dates.map(d => new Date(...d));
    const step = width / chartData[0].dataPoints.length;

    // drawing
    drawGrid(ctx, width, height, labelsOffset, dimension, step, dates);

    chartData.forEach(chart => {
        drawChart(ctx, chartWidth, chartHeight, chart, step, multiplier);
    });
};

const drawGrid = (ctx, canvasWidth, canvasHeight, labelsOffset, dimension, step, dates) => {
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
        ctx.fillText(dimension * i, 0, height - 6);
        ctx.stroke();
    }

    ctx.lineWidth = 1;

    for (let i = 1; i < dates.length; i++) {

        ctx.beginPath();
        ctx.moveTo(step * i, chartHeight);
        ctx.lineTo(step * i, 0);
        ctx.stroke();

        const label = formatDate(dates[i]);
        const offset = getLabelWidth(label, 18) / 2;

        ctx.fillText(label, step * i - offset, chartHeight + 20);
    }
};

const drawChart = (ctx, chartWidth, chartHeight, chart, step, multiplier) => {
    console.log('drawing chart');

    const {dataPoints, color} = chart;

    // styling
    ctx.lineWidth = 1;

    let curX = 0;
    let curY = chartHeight - dataPoints[0] * multiplier;

    // drawing
    ctx.beginPath();
    ctx.moveTo(curX, curY);
    ctx.strokeStyle = color;

    for (let i = 1; i < dataPoints.length; i++) {
        curX += step;
        curY = chartHeight - dataPoints[i] * multiplier;
        ctx.lineTo(curX, curY);
    }

    ctx.stroke();
};

window.onload = main;
