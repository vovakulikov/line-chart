import {chartData} from './chart_data.js';
import {formatDate, getDimension, getLabelWidth, getMultiplier, getViewportX} from './helpers.js';
import settings from "./settings.js";

// TODO: turn into a store and update with reducers
let chartViewConfig = {
    viewport: {
        start: 0.0,
        end: 0.0,
    },
    chartDisplayState: {},
    isNightMode: false,
    shouldUpdate: true,
};

const main = async () => {
    const data = (await getData())[0];

    const canvas = document.querySelector('.subscribers-chart');
    const chartContainer = document.querySelector('.chart-container');
    const legend = document.querySelector('.chart-legend');

    const legendButtons = makeLegendButtons(data);

    legendButtons.forEach(button => {
        legend.appendChild(button);
    });

    initState(data);
    canvas.width = calculateCanvasWidth(chartContainer.clientWidth, chartViewConfig.viewport);

    addScrollingListeners(canvas, chartContainer);

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
    scrollToViewport(canvas, chartContainer.clientWidth, chartViewConfig.viewport);
};

const addScrollingListeners = (canvas, chartContainer) => {
    // scrolling
    let isDragging = false;
    let lastX = 0;
    let offsetLeft = getViewportX(canvas.width, chartViewConfig.viewport.start);

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
            offsetLeft = Math.max(-(canvas.width - chartContainer.clientWidth), Math.min(offsetLeft + delta, 0));

            canvas.style.transform = `translateX(${offsetLeft}px)`;

            const viewportOffset = Math.abs(offsetLeft / canvas.width);
            const viewportWidth = chartViewConfig.viewport.end - chartViewConfig.viewport.start;

            chartViewConfig = {
                ...chartViewConfig,
                viewport: {
                    start: viewportOffset,
                    end: Math.min(viewportOffset + viewportWidth, 1),
                },
                shouldUpdate: true,
            };
        }

        event.preventDefault();
    });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
};

const scrollToViewport = (canvas, containerWidth, {start, end}) => {
    canvas.width = calculateCanvasWidth(containerWidth, {start, end});
    canvas.style.transform = `translateX(${getViewportX(canvas.width, start)}px)`;
};

const initState = (chartData) => {
    chartViewConfig = {
        ...chartViewConfig,
        viewport: settings.initViewport,
        chartDisplayState: Object.keys(chartData.names).reduce((acc, id) => {
            acc[id] = true;
            return acc;
        }, {}),
    };
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
    return Object.entries(chartData.names).map(([id, label]) => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = true;

        checkbox.addEventListener('change', () => {
            chartViewConfig = {
                ...chartViewConfig,
                chartDisplayState: {
                    ...chartViewConfig.chartDisplayState,
                    [id]: !chartViewConfig.chartDisplayState[id],
                },
                shouldUpdate: true,
            };
        });

        return wrapLegendButton(checkbox, label, chartData.colors[id]);
    });
};

const wrapLegendButton = (checkbox, labelText, color) => {
    const button = document.createElement('label');
    const text = document.createTextNode(labelText);
    const checkboxLabel = document.createElement('span');
    const checkboxBadge = document.createElement('span');

    button.classList.add('chart-legend__button', 'legend-button');
    button.style.color = color;
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

    const horizontalLines = 5;
    const labelsOffset = 40;
    const chartHeight = height - labelsOffset;
    const chartWidth = width;
    const xColumn = settings.data.xColumn;

    // calculations
    const displayedCharts = chartData.columns.filter(c => c[0] !== xColumn && chartViewConfig.chartDisplayState[c[0]]);

    const maxPoint = Math.max(...displayedCharts.map(points => Math.max(...points.slice(1))));

    const dimension = getDimension(maxPoint, horizontalLines);
    const multiplier = getMultiplier(chartHeight, maxPoint);

    const dates = chartData.columns
        .find(c => c[0] === xColumn)
        .slice(1)
        .map(timestamp => new Date(timestamp));

    const step = width / displayedCharts[0].length;

    // drawing
    drawGrid(ctx, {canvasWidth: width, canvasHeight: height, labelsOffset, dimension, step, dates});

    displayedCharts.forEach(chart => {
        const columnId = chart[0];

        if (chartViewConfig.chartDisplayState[columnId]) {
            drawChart(ctx, {chartWidth, chartHeight, dataPoints: chart.slice(1), step, multiplier, color: chartData.colors[columnId]});
        }
    });

    chartViewConfig = {
        ...chartViewConfig,
        shouldUpdate: false,
    };
};

const drawGrid = (ctx, {canvasWidth, canvasHeight, labelsOffset, dimension, step, dates}) => {
    // styling
    ctx.strokeStyle = settings.grid.strokeStyle;
    ctx.lineWidth = settings.grid.yLineWidth;
    ctx.font = `${settings.grid.fontSize}px ${settings.grid.font}`;
    ctx.fillStyle = settings.grid.fillStyle;

    const verticalLineStep = Math.floor(canvasHeight / 6);
    const chartHeight = canvasHeight - labelsOffset;
    const {viewport} = chartViewConfig;
    const labelsX = canvasWidth * viewport.start;

    // drawing
    // y-axis labels
    for (let i = 0; i < 6; i++) {
        const height = Math.ceil(chartHeight - i * verticalLineStep);

        ctx.save();

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(canvasWidth, height);
        ctx.fillText(dimension * i, labelsX, height - 6);
        ctx.stroke();

        ctx.restore();
    }

    ctx.lineWidth = settings.grid.xLineWidth;

    // x-axis labels
    let lastLabelEnd = 0;

    for (let i = 0; i < dates.length; i++) {
        const label = formatDate(dates[i]);
        const labelWidth = getLabelWidth(label, settings.grid.fontSize);
        const x = i === 0 ? 0 : step * i - labelWidth / 2;

        if (i === 0 || i ===  dates.length - 1 ||
            x > lastLabelEnd + settings.grid.marginBetweenLabels) {
            ctx.save();

            // TODO: remove vertical lines
            ctx.beginPath();
            ctx.moveTo(step * i, chartHeight);
            ctx.lineTo(step * i, 0);
            ctx.stroke();

            ctx.fillText(label, x, chartHeight + 20);
            ctx.restore();

            lastLabelEnd = x + labelWidth;
        }
    }
};

const drawChart = (ctx, {chartWidth, chartHeight, dataPoints, step, multiplier, color}) => {
    // styling
    ctx.lineWidth = settings.chart.lineWidth;

    let curX = 0;
    let curY = chartHeight - dataPoints[0] * multiplier;

    // drawing
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(curX, curY);
    ctx.strokeStyle = color;

    for (let i = 1; i < dataPoints.length; i++) {
        curX += step;
        curY = chartHeight - dataPoints[i] * multiplier;
        ctx.lineTo(curX, curY);
    }

    ctx.stroke();
    ctx.restore();
};

window.onload = main;
