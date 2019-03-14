import {chartData} from './chart_data.js';
import {formatDate, getDimension, getLabelWidth, getZoomRatio, getViewportX, calculateCanvasWidth} from './helpers.js';
import settings from "./settings.js";

// TODO: turn into a store and update with reducers
let chartViewConfig = {
    viewport: {
        start: 0.0,
        end: 0.0,
    },
    chartDisplayState: {
        y0: {
            display: true,
            opacity: 1.0,
            isFading: false,
            isReappearing: false,
        },
        y1: {
            display: true,
            opacity: 1.0,
            isFading: false,
            isReappearing: false,
        }
    },
    zoomRatio: 1,
    isNightMode: false,
    shouldUpdate: true,
    shouldAnimate: false,
};
const canvas = document.querySelector('.subscribers-chart');
const chartContainer = document.querySelector('.chart-container');
const animation = {
    duration: 300,
    styleFn: x => x * x,
    animationStep: null,
    valueToReach: 1,
};

const main = async () => {
    const data = (await getData())[4];
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
            draw(canvas, data, chartViewConfig.shouldAnimate);
        }

        requestAnimationFrame(update);
    };

    // start drawing
    requestAnimationFrame(update);
    scrollToViewport(canvas, chartContainer.clientWidth, chartViewConfig.viewport);
};

// reducer
export const updateViewConfig = (start, width) => {
    const containerWidth = chartContainer.clientWidth;
    const viewportStart = start / containerWidth;
    const viewportWidth = width / containerWidth;

    chartViewConfig = {
        ...chartViewConfig,
        viewport: {
            start: viewportStart,
            end: Math.min(viewportStart + viewportWidth, 1),
        },
        shouldUpdate: true,
    };
    scrollToViewport(canvas, containerWidth, chartViewConfig.viewport);
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

// legend buttons
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
                    [id]: {
                        ...chartViewConfig.chartDisplayState[id],
                        display: !chartViewConfig.chartDisplayState[id].display,
                    }
                },
                shouldAnimate: true,
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

const draw = (canvas, chartData, animate) => {
    const ctx = canvas.getContext('2d');
    const {width, height} = canvas;

    ctx.clearRect(0, 0, width, height);

    const horizontalLines = 5;
    const labelsOffset = 40;
    const chartHeight = height - labelsOffset;
    const chartWidth = width;
    const xColumn = settings.data.xColumn;

    // calculations
    const displayedCharts = chartData.columns
        .filter(c => c[0] !== xColumn && chartViewConfig.chartDisplayState[c[0]].display);

    const maxPoint = Math.max(...displayedCharts.map(points => Math.max(...points.slice(1))));

    const dimension = getDimension(maxPoint, horizontalLines);

    const newZoomRatio = getZoomRatio(chartHeight, maxPoint);

    const dates = chartData.columns
        .find(c => c[0] === xColumn)
        .slice(1)
        .map(timestamp => new Date(timestamp));

    const step = width / (displayedCharts[0].length - 2);

    // drawing
    drawGrid(ctx, {canvasWidth: width, canvasHeight: height, labelsOffset, dimension, step, dates});

    const animationStep = 60 * animation.duration / 1000;

    if (animate) {
        animation.valueToReach = newZoomRatio;

        if (animation.animationStep === null) {
            animation.animationStep = (animation.valueToReach - chartViewConfig.zoomRatio) / animationStep;
        }

        chartViewConfig = {
            ...chartViewConfig,
            zoomRatio: chartViewConfig.zoomRatio + animation.animationStep,
        };

        if (animation.animationStep > 0 && chartViewConfig.zoomRatio > animation.valueToReach ||
            animation.animationStep < 0 && chartViewConfig.zoomRatio < animation.valueToReach) {
            chartViewConfig = {
                ...chartViewConfig,
                shouldAnimate: false,
            };
            animation.animationStep = null;
            animation.valueToReach = 1;
        }
    } else {
        chartViewConfig = {
            ...chartViewConfig,
            zoomRatio: newZoomRatio,
        };
    }

    displayedCharts.forEach(chart => {
        const columnId = chart[0];
        const displayState = chartViewConfig.chartDisplayState[columnId];

        if (displayState.display) {
            drawChart(ctx, {
                chartWidth,
                chartHeight,
                dataPoints: chart.slice(1),
                step,
                zoomRatio: chartViewConfig.zoomRatio,
                color: chartData.colors[columnId],
            });
        }
    });

    chartViewConfig = {
        ...chartViewConfig,
        shouldUpdate: chartViewConfig.shouldAnimate,
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
    let previousLabelEnd = 0;

    for (let i = 0; i < dates.length; i++) {
        const label = formatDate(dates[i]);
        const labelWidth = getLabelWidth(label, settings.grid.fontSize);
        const margin = settings.grid.marginBetweenLabels;
        let x;

        if (i === 0) {
            x = 0;
        } else if (i === dates.length - 1) {
            x = step * i - labelWidth;
        } else {
            x = step * i - labelWidth / 2;
        }

        if (i === 0 || i === dates.length - 1 ||
            (x > previousLabelEnd + margin && x < canvasWidth - labelWidth - margin)) {
            ctx.save();

            // TODO: remove vertical lines
            ctx.beginPath();
            ctx.moveTo(step * i, chartHeight);
            ctx.lineTo(step * i, 0);
            ctx.stroke();

            ctx.fillText(label, x, chartHeight + 20);
            ctx.restore();

            previousLabelEnd = x + labelWidth;
        }
    }
};

const drawChart = (ctx, {chartWidth, chartHeight, dataPoints, step, zoomRatio, color}) => {
    // styling
    ctx.lineWidth = settings.chart.lineWidth;

    let curX = 0;
    let curY = chartHeight - dataPoints[0] * zoomRatio;

    // drawing
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(curX, curY);
    ctx.strokeStyle = color;

    for (let i = 1; i < dataPoints.length; i++) {
        curX += step;
        curY = chartHeight - dataPoints[i] * zoomRatio;
        ctx.lineTo(curX, curY);
    }

    ctx.stroke();
    ctx.restore();
};

const initState = (chartData) => {
    chartViewConfig = {
        ...chartViewConfig,
        viewport: settings.initViewport,
        chartDisplayState: Object.keys(chartData.names).reduce((acc, id) => {
            acc[id] = {
                display: true,
                opacity: 1.0,
                isFading: false,
                isReappearing: false,
            };
            return acc;
        }, {}),
    };
};

const getData = async () => {
    // replace with a call to actual API
    return Promise.resolve(chartData);
};

// window.onload = main;
