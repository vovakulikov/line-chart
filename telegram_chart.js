import {chartData} from './data_mock.js';
import {formatDate, getDimension, getMultiplier, getLabelWidth} from './helpers.js';

let chartViewConfig = {
    viewport: {},
    chartDisplayState: {},
    isNightMode: false,
    shouldUpdate: true,
};

const initViewport = {
    start: 0.0,
    end: 0.3,
};

const main = async () => {
    const data = await getData();
    initState(data);

    const canvas = document.getElementById('subscribers-chart');
    const chartContainer = document.querySelector('.chart-container');
    const legend = document.querySelector('.chart-legend');

    const legendButtons = makeLegendButtons(data);

    legendButtons.forEach(button => {
        legend.appendChild(button);
    });

    // scrolling
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
            marginLeft = Math.max(-(canvas.width - chartContainer.clientWidth), Math.min(marginLeft + delta, 0));

            canvas.style.transform = `translateX(${marginLeft}px)`;

            const viewportOffset = Math.abs(marginLeft / canvas.width);

            chartViewConfig = {
                ...chartViewConfig,
                viewport: {
                    start: Math.max(initViewport.start + viewportOffset),
                    end: Math.max(initViewport.end + viewportOffset),
                },
                shouldUpdate: true,
            };
            // console.log(chartViewConfig);
        }

        event.preventDefault();
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    // update cycle
    const update = () => {
        if (chartViewConfig.shouldUpdate) {
            canvas.width = calculateCanvasWidth(chartContainer.clientWidth, chartViewConfig.viewport);
            draw(canvas, data);
        }

        requestAnimationFrame(update);
    };

    // start drawing
    requestAnimationFrame(update);
};

const initState = (chartData) => {
    chartViewConfig = {
        ...chartViewConfig,
        viewport: {
            start: 0.0,
            end: 0.3,
        },
        chartDisplayState: chartData.reduce((acc, {label}) => {
            acc[label] = true;
            return acc;
        }, {}),
    }
};

const calculateCanvasWidth = (containerWidth, {start, end}) => {
    // TODO: add zero division protection
    return containerWidth / (end - start);
};

const getData = async () => {
    // replace with a call to actual API
    return Promise.resolve(chartData);
};

const makeLegendButtons = (chartData) => {
    return chartData.map(chart => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;

        checkbox.addEventListener('change', () => {
            chartViewConfig = {
                ...chartViewConfig,
                chartDisplayState: {
                    ...chartViewConfig.chartDisplayState,
                    [chart.label]: !chartViewConfig.chartDisplayState[chart.label],
                },
                shouldUpdate: true,
            };
        });

        return wrapLegendButton(checkbox, chart.label);
    });
};

const wrapLegendButton = (checkbox, labelText) => {
    const button = document.createElement('label');
    const text = document.createTextNode(labelText);
    const checkboxLabel = document.createElement('span');
    const checkboxBadge = document.createElement('span');

    button.classList.add('chart-legend__button', 'legend-button', `legend-button_${labelText}`);
    checkbox.classList.add('legend-button__checkbox-input');
    checkboxLabel.classList.add('legend-button__text');
    checkboxBadge.classList.add('legend-button__checkbox-badge');

    checkboxLabel.appendChild(text);
    button.appendChild(checkbox);
    button.appendChild(checkboxBadge);
    button.appendChild(checkboxLabel);

    return button;
};

const draw = (canvas, chartData) => {
    const ctx = canvas.getContext('2d');
    const {width, height} = canvas;

    ctx.clearRect(0, 0, width, height);

    console.log('init draw');
    const horizontalLines = 5;
    const labelsOffset = 40;
    const chartHeight = height - labelsOffset;
    const chartWidth = width;

    // calculations
    const displayedCharts = chartData.filter(c => chartViewConfig.chartDisplayState[c.label]);
    const maxPoint = Math.max(...displayedCharts.map(chart => Math.max(...chart.dataPoints)));
    const dimension = getDimension(maxPoint, horizontalLines);
    const multiplier = getMultiplier(chartHeight, maxPoint);
    const dates = chartData[0].dates.map(d => new Date(...d));
    const step = width / chartData[0].dataPoints.length;

    // drawing
    drawGrid(ctx, {canvasWidth: width, canvasHeight: height, labelsOffset, dimension, step, dates});

    chartData.forEach(chart => {
        if (chartViewConfig.chartDisplayState[chart.label]) {
            drawChart(ctx, {chartWidth, chartHeight, chart, step, multiplier});
        }
    });

    chartViewConfig = {
        ...chartViewConfig,
        shouldUpdate: false,
    };
};

const drawGrid = (ctx, {canvasWidth, canvasHeight, labelsOffset, dimension, step, dates}) => {
    console.log('drawing grid');

    // styling
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.lineWidth = 0.5;
    ctx.font = '18px Arial';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';

    const verticalLineStep = Math.floor(canvasHeight / 6);
    const chartHeight = canvasHeight - labelsOffset;
    const {viewport} = chartViewConfig;
    const labelsX = canvasWidth * viewport.start;

    // drawing
    for (let i = 0; i < 6; i++) {
        const height = Math.ceil(chartHeight - i * verticalLineStep);

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(canvasWidth, height);
        ctx.fillText(dimension * i, labelsX, height - 6);
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

const drawChart = (ctx, {chartWidth, chartHeight, chart, step, multiplier}) => {
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
